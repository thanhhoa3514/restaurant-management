package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/identity/domain"
	"restaurant-management/internal/shared/apperr"
)

type LogoutRequest struct {
	UserID    uuid.UUID
	SessionID uuid.UUID
}

type LogoutResponse struct {
	Status string `json:"status"`
}

type Logout struct {
	sessions           domain.SessionRepository
	defaultRestaurantID uuid.UUID
}

func NewLogout(sessions domain.SessionRepository, defaultRestaurantID uuid.UUID) *Logout {
	return &Logout{sessions: sessions, defaultRestaurantID: defaultRestaurantID}
}

func (s *Logout) Handle(ctx context.Context, req LogoutRequest) (LogoutResponse, error) {
	if req.SessionID != uuid.Nil {
		if err := s.sessions.RevokeSession(ctx, req.SessionID); err != nil {
			if apperr.Is(err, apperr.CodeNotFound) {
				return LogoutResponse{Status: "ok"}, nil
			}
			return LogoutResponse{}, err
		}
	} else if req.UserID != uuid.Nil {
		if err := s.sessions.RevokeUserSessions(ctx, s.defaultRestaurantID, req.UserID); err != nil {
			return LogoutResponse{}, err
		}
	}
	return LogoutResponse{Status: "ok"}, nil
}
