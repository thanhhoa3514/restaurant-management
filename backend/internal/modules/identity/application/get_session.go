package application

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/identity/domain"
)

type TESTRESPONSE struct {
	UserId uuid.UUID `json:"cc"`
	Name   string    `json:"ss"`
	Age    int32     `json:"age"`
	Dest   string    `json:"des"`
}

type SessionResponse struct {
	UserID      uuid.UUID `json:"user_id"`
	Username    string    `json:"username"`
	Name        string    `json:"name"`
	Role        string    `json:"role"`
	Permissions []string  `json:"permissions"`
}

type GetSession struct {
	repo domain.UserRepository
}

func NewGetSession(repo domain.UserRepository) *GetSession {
	return &GetSession{repo: repo}
}

func (s *GetSession) Handle(ctx context.Context, restaurantID, userID uuid.UUID) (SessionResponse, error) {
	user, err := s.repo.FindByID(ctx, restaurantID, userID)
	if err != nil {
		return SessionResponse{}, err
	}
	permissions, err := s.repo.ResolvePermissionCodes(ctx, restaurantID, userID)
	if err != nil {
		return SessionResponse{}, err
	}
	return SessionResponse{
		UserID: user.ID, Username: user.Username, Name: user.FullName,
		Role: strings.ToUpper(user.RoleName), Permissions: permissions,
	}, nil
}
