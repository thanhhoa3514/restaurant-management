package application

import (
	"context"
	"regexp"
	"strings"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"restaurant-management/internal/modules/identity/domain"
	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/shared/apperr"
)

// ManageUsersRequest is an action-style command (US-004): one endpoint, the
// action field selects create / update / set_status / reset_password.
type ManageUsersRequest struct {
	Action   string     `json:"action"`
	UserID   uuid.UUID  `json:"user_id"`
	Username string     `json:"username"`
	FullName *string    `json:"full_name"`
	Email    *string    `json:"email"`
	Phone    *string    `json:"phone"`
	Role     *string    `json:"role"`
	Password string     `json:"password"`
	Status   string     `json:"status"`
	// Populated by the HTTP handler from JWT claims, never from JSON.
	RestaurantID uuid.UUID `json:"-"`
	ActorID      uuid.UUID `json:"-"`
}

type ManageUsersResponse struct {
	ID     uuid.UUID `json:"id"`
	Action string    `json:"action"`
	Status string    `json:"status"`
}

type ManageUsers struct {
	tx     TxRunner
	repo   domain.UserRepository
	outbox domain.OutboxWriter
}

func NewManageUsers(tx TxRunner, repo domain.UserRepository, outbox domain.OutboxWriter) *ManageUsers {
	return &ManageUsers{tx: tx, repo: repo, outbox: outbox}
}

var usernameRe = regexp.MustCompile(`^[a-z0-9][a-z0-9._-]{2,79}$`)

func (s *ManageUsers) Handle(ctx context.Context, in ManageUsersRequest) (ManageUsersResponse, error) {
	var out ManageUsersResponse
	action := strings.ToLower(strings.TrimSpace(in.Action))
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		var err error
		switch action {
		case "create":
			out, err = s.create(ctx, in)
		case "update":
			out, err = s.update(ctx, in)
		case "set_status":
			out, err = s.setStatus(ctx, in)
		case "reset_password":
			out, err = s.resetPassword(ctx, in)
		default:
			return apperr.New(apperr.CodeInvalid, "action must be one of create, update, set_status, reset_password")
		}
		if err != nil {
			return err
		}
		return s.writeEvent(ctx, in, out)
	})
	return out, err
}

func (s *ManageUsers) create(ctx context.Context, in ManageUsersRequest) (ManageUsersResponse, error) {
	var out ManageUsersResponse
	username := strings.ToLower(strings.TrimSpace(in.Username))
	if !usernameRe.MatchString(username) {
		return out, apperr.New(apperr.CodeInvalid, "username must be 3-80 chars: lowercase letters, digits, . _ -")
	}
	if in.FullName == nil || strings.TrimSpace(*in.FullName) == "" {
		return out, apperr.New(apperr.CodeInvalid, "full_name is required")
	}
	if err := validatePassword(in.Password); err != nil {
		return out, err
	}
	if in.Role == nil {
		return out, apperr.New(apperr.CodeInvalid, "role is required")
	}
	role, err := s.repo.FindRoleByName(ctx, *in.Role)
	if err != nil {
		return out, err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		return out, err
	}
	id, err := s.repo.CreateUser(ctx, domain.NewUser{
		RestaurantID: in.RestaurantID,
		Username:     username,
		Email:        normalizeOptional(in.Email),
		Phone:        normalizeOptional(in.Phone),
		PasswordHash: string(hash),
		FullName:     strings.TrimSpace(*in.FullName),
		RoleID:       role.ID,
	})
	if err != nil {
		return out, err
	}
	return ManageUsersResponse{ID: id, Action: "create", Status: "ok"}, nil
}

func (s *ManageUsers) update(ctx context.Context, in ManageUsersRequest) (ManageUsersResponse, error) {
	var out ManageUsersResponse
	if in.UserID == uuid.Nil {
		return out, apperr.New(apperr.CodeInvalid, "user_id is required")
	}
	upd := domain.UserUpdate{
		Email: normalizeOptional(in.Email),
		Phone: normalizeOptional(in.Phone),
	}
	if in.FullName != nil {
		name := strings.TrimSpace(*in.FullName)
		if name == "" {
			return out, apperr.New(apperr.CodeInvalid, "full_name cannot be empty")
		}
		upd.FullName = &name
	}
	if in.Role != nil {
		// Changing your own role can lock you out of this very screen.
		if in.UserID == in.ActorID {
			return out, apperr.New(apperr.CodeInvalid, "cannot change your own role")
		}
		role, err := s.repo.FindRoleByName(ctx, *in.Role)
		if err != nil {
			return out, err
		}
		upd.RoleID = &role.ID
	}
	if upd.FullName == nil && upd.Email == nil && upd.Phone == nil && upd.RoleID == nil {
		return out, apperr.New(apperr.CodeInvalid, "nothing to update")
	}
	if err := s.repo.UpdateUser(ctx, in.RestaurantID, in.UserID, upd); err != nil {
		return out, err
	}
	return ManageUsersResponse{ID: in.UserID, Action: "update", Status: "ok"}, nil
}

func (s *ManageUsers) setStatus(ctx context.Context, in ManageUsersRequest) (ManageUsersResponse, error) {
	var out ManageUsersResponse
	if in.UserID == uuid.Nil {
		return out, apperr.New(apperr.CodeInvalid, "user_id is required")
	}
	if in.UserID == in.ActorID {
		return out, apperr.New(apperr.CodeInvalid, "cannot change your own status")
	}
	status := domain.UserStatus(strings.ToUpper(strings.TrimSpace(in.Status)))
	if status != domain.UserStatusActive && status != domain.UserStatusInactive {
		return out, apperr.New(apperr.CodeInvalid, "status must be ACTIVE or INACTIVE")
	}
	if err := s.repo.SetUserStatus(ctx, in.RestaurantID, in.UserID, status); err != nil {
		return out, err
	}
	return ManageUsersResponse{ID: in.UserID, Action: "set_status", Status: "ok"}, nil
}

func (s *ManageUsers) resetPassword(ctx context.Context, in ManageUsersRequest) (ManageUsersResponse, error) {
	var out ManageUsersResponse
	if in.UserID == uuid.Nil {
		return out, apperr.New(apperr.CodeInvalid, "user_id is required")
	}
	if err := validatePassword(in.Password); err != nil {
		return out, err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
	if err != nil {
		return out, err
	}
	if err := s.repo.SetUserPassword(ctx, in.RestaurantID, in.UserID, string(hash)); err != nil {
		return out, err
	}
	return ManageUsersResponse{ID: in.UserID, Action: "reset_password", Status: "ok"}, nil
}

func (s *ManageUsers) writeEvent(ctx context.Context, in ManageUsersRequest, res ManageUsersResponse) error {
	if s.outbox == nil {
		return nil
	}
	return s.outbox.Write(ctx, outbox.WriteEvent{
		RestaurantID:  in.RestaurantID,
		AggregateType: "user",
		AggregateID:   res.ID,
		EventType:     "identity.user_managed",
		Payload: map[string]any{
			"user_id": res.ID,
			"action":  res.Action,
		},
		Metadata: map[string]any{
			"actor_type": "STAFF",
			"actor_id":   in.ActorID,
			"action":     "user." + res.Action,
		},
		// Account changes are tenant-sensitive; keep them off the unauthenticated
		// global websocket hub.
		SuppressRealtime: true,
		Priority:         3,
	})
}

func validatePassword(pw string) error {
	if len(pw) < 8 {
		return apperr.New(apperr.CodeInvalid, "password must be at least 8 characters")
	}
	return nil
}

// normalizeOptional trims and nils-out empty strings so unique indexes on
// email/phone never see ''.
func normalizeOptional(v *string) *string {
	if v == nil {
		return nil
	}
	t := strings.TrimSpace(*v)
	if t == "" {
		return nil
	}
	return &t
}
