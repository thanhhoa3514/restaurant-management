package application

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"restaurant-management/internal/modules/identity/domain"
	"restaurant-management/internal/platform/auth"
	"restaurant-management/internal/shared/apperr"
)

type AuthenticateRequest struct {
	RestaurantCode string `json:"restaurant_code"`
	Username       string `json:"username"`
	Password       string `json:"password"`
}

type AuthenticateResponse struct {
	Token        string    `json:"token"`
	UserID       uuid.UUID `json:"user_id"`
	Role         string    `json:"role"`
	RestaurantID uuid.UUID `json:"restaurant_id"`
	ExpiresAt    time.Time `json:"expires_at"`
}

type Authenticate struct {
	tx        TxRunner
	repo      domain.UserRepository
	outbox    domain.OutboxWriter
	jwtSecret string
	jwtTTL    time.Duration
}

func NewAuthenticate(tx TxRunner, repo domain.UserRepository, outbox domain.OutboxWriter, jwtSecret string, jwtTTL time.Duration) *Authenticate {
	return &Authenticate{tx: tx, repo: repo, outbox: outbox, jwtSecret: jwtSecret, jwtTTL: jwtTTL}
}

func (s *Authenticate) Handle(ctx context.Context, req AuthenticateRequest) (AuthenticateResponse, error) {
	var out AuthenticateResponse
	if strings.TrimSpace(req.RestaurantCode) == "" || strings.TrimSpace(req.Username) == "" || req.Password == "" {
		return out, apperr.New(apperr.CodeInvalid, "restaurant_code, username, and password are required")
	}

	var authErr error
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		// Login is the bootstrap exception: no JWT exists yet, so tenant is
		// resolved from restaurant_code. Authenticated use-cases read tenant from context.
		restaurantID, err := s.repo.ResolveRestaurantIDByCode(ctx, strings.TrimSpace(req.RestaurantCode))
		if err != nil {
			if apperr.Is(err, apperr.CodeNotFound) {
				return apperr.New(apperr.CodeUnauthorized, "invalid credentials")
			}
			return err
		}

		user, err := s.repo.FindByUsername(ctx, restaurantID, strings.TrimSpace(req.Username))
		if err != nil {
			if apperr.Is(err, apperr.CodeNotFound) {
				return apperr.New(apperr.CodeUnauthorized, "invalid credentials")
			}
			return err
		}
		if user.Status == domain.UserStatusInactive || user.Status == domain.UserStatusLocked || (user.LockedUntil != nil && user.LockedUntil.After(time.Now())) {
			return apperr.New(apperr.CodeForbidden, "user is inactive or locked")
		}
		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
			if recErr := s.repo.RecordLoginFailure(ctx, restaurantID, user.ID); recErr != nil {
				return recErr
			}
			authErr = apperr.New(apperr.CodeUnauthorized, "invalid credentials")
			return nil
		}

		role := strings.ToUpper(user.RoleName)
		token, err := auth.Issue(s.jwtSecret, auth.Claims{UserID: user.ID.String(), RestaurantID: restaurantID.String(), Role: role}, s.jwtTTL)
		if err != nil {
			return err
		}
		if err := s.repo.RecordLoginSuccess(ctx, restaurantID, user.ID); err != nil {
			return err
		}
		out = AuthenticateResponse{Token: token, UserID: user.ID, Role: role, RestaurantID: restaurantID, ExpiresAt: time.Now().Add(s.jwtTTL)}
		_ = s.outbox // reserved for later identity audit events; no outbox event in Batch A.
		return nil
	})
	if err == nil && authErr != nil {
		return out, authErr
	}
	return out, err
}
