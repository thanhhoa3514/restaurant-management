package application

import (
	"context"
	"time"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/identity/domain"
	"restaurant-management/internal/platform/tenant"
	"restaurant-management/internal/shared/apperr"
)

type StaffUserDTO struct {
	ID          uuid.UUID  `json:"id"`
	Username    string     `json:"username"`
	FullName    string     `json:"full_name"`
	Email       *string    `json:"email,omitempty"`
	Phone       *string    `json:"phone,omitempty"`
	Role        string     `json:"role"`
	Status      string     `json:"status"`
	LastLoginAt *time.Time `json:"last_login_at,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
}

type RoleDTO struct {
	Name        string `json:"name"`
	DisplayName string `json:"display_name"`
}

type ListStaff struct{ repo domain.UserRepository }

func NewListStaff(repo domain.UserRepository) *ListStaff { return &ListStaff{repo: repo} }

func (s *ListStaff) Handle(ctx context.Context) ([]StaffUserDTO, error) {
	restaurantID, err := tenant.MustRestaurantID(ctx)
	if err != nil {
		return nil, apperr.New(apperr.CodeUnauthorized, "missing restaurant tenant")
	}
	rows, err := s.repo.ListStaff(ctx, restaurantID)
	if err != nil {
		return nil, err
	}
	out := make([]StaffUserDTO, 0, len(rows))
	for _, u := range rows {
		out = append(out, StaffUserDTO{
			ID:          u.ID,
			Username:    u.Username,
			FullName:    u.FullName,
			Email:       u.Email,
			Phone:       u.Phone,
			Role:        u.RoleName,
			Status:      string(u.Status),
			LastLoginAt: u.LastLoginAt,
			CreatedAt:   u.CreatedAt,
		})
	}
	return out, nil
}

type ListRoles struct{ repo domain.UserRepository }

func NewListRoles(repo domain.UserRepository) *ListRoles { return &ListRoles{repo: repo} }

func (s *ListRoles) Handle(ctx context.Context) ([]RoleDTO, error) {
	rows, err := s.repo.ListRoles(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]RoleDTO, 0, len(rows))
	for _, ro := range rows {
		out = append(out, RoleDTO{Name: ro.Name, DisplayName: ro.DisplayName})
	}
	return out, nil
}
