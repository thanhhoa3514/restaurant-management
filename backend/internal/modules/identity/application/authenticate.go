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
	Username string `json:"username"`
	Password string `json:"password"`
}

type AuthenticateResponse struct {
	Token        string    `json:"token"`
	RefreshToken string    `json:"refresh_token"`
	UserID       uuid.UUID `json:"user_id"`
	Role         string    `json:"role"`
	Name         string    `json:"name"`
	Permissions  []string  `json:"permissions"`
	ExpiresAt    time.Time `json:"expires_at"`
}

var RefreshTokenTTL = 7 * 24 * time.Hour

type Authenticate struct {
	tx                  TxRunner
	repo                domain.UserRepository
	sessions            domain.SessionRepository
	outbox              domain.OutboxWriter
	jwtSecret           string
	jwtTTL              time.Duration
	defaultRestaurantID uuid.UUID
}

func NewAuthenticate(tx TxRunner, repo domain.UserRepository, sessions domain.SessionRepository, outbox domain.OutboxWriter, jwtSecret string, jwtTTL time.Duration, defaultRestaurantID uuid.UUID) *Authenticate {
	return &Authenticate{tx: tx, repo: repo, sessions: sessions, outbox: outbox, jwtSecret: jwtSecret, jwtTTL: jwtTTL, defaultRestaurantID: defaultRestaurantID}
}

func (s *Authenticate) Handle(ctx context.Context, req AuthenticateRequest) (AuthenticateResponse, error) {
	var out AuthenticateResponse
	if strings.TrimSpace(req.Username) == "" || req.Password == "" {
		return out, apperr.New(apperr.CodeInvalid, "username and password are required")
	}

	restaurantID := s.defaultRestaurantID

	var authErr error
	err := s.tx.Run(ctx, func(ctx context.Context) error {
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
		now := time.Now()

		sessionID := uuid.New()
		rawRefresh, hashedRefresh, err := auth.GenerateRefreshToken()
		if err != nil {
			return err
		}
		session := &domain.UserSession{
			ID:               sessionID,
			RestaurantID:     restaurantID,
			UserID:           user.ID,
			RefreshTokenHash: hashedRefresh,
			ExpiresAt:        now.Add(RefreshTokenTTL),
		}
		if err := s.sessions.CreateSession(ctx, session); err != nil {
			return err
		}

		token, err := auth.Issue(s.jwtSecret, auth.Claims{
			UserID: user.ID.String(),
			Role:   role, SessionID: sessionID.String(),
		}, s.jwtTTL)
		if err != nil {
			return err
		}
		if err := s.repo.RecordLoginSuccess(ctx, restaurantID, user.ID); err != nil {
			return err
		}
		permissions, err := s.repo.ResolvePermissionCodes(ctx, restaurantID, user.ID)
		if err != nil {
			return err
		}
		out = AuthenticateResponse{
			Token: token, RefreshToken: rawRefresh, UserID: user.ID, Role: role, Name: user.FullName,
			Permissions: permissions, ExpiresAt: now.Add(s.jwtTTL),
		}
		_ = s.outbox // reserved for later identity audit events; no outbox event in Batch A.
		return nil
	})
	if err == nil && authErr != nil {
		return out, authErr
	}
	return out, err
}
