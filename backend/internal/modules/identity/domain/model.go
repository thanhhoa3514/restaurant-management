package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type Role string

const (
	RoleGuest   Role = "GUEST"
	RoleServer  Role = "SERVER"
	RoleKitchen Role = "KITCHEN"
	RoleCashier Role = "CASHIER"
	RoleManager Role = "MANAGER"
)

type UserStatus string

const (
	UserStatusActive   UserStatus = "ACTIVE"
	UserStatusInactive UserStatus = "INACTIVE"
	UserStatusLocked   UserStatus = "LOCKED"
)

type User struct {
	ID           uuid.UUID
	RestaurantID uuid.UUID
	Username     string
	PasswordHash string
	FullName     string
	Status       UserStatus
	RoleID       uuid.UUID
	RoleName     string
	LockedUntil  *time.Time
	Version      int
	DeletedAt    *time.Time
}

type Event struct {
	ID           uuid.UUID
	RestaurantID uuid.UUID
	Type         string
	Payload      any
	OccurredAt   time.Time
}

type UserRepository interface {
	FindByUsername(ctx context.Context, restaurantID uuid.UUID, username string) (*User, error)
	FindByID(ctx context.Context, restaurantID, userID uuid.UUID) (*User, error)
	ResolvePermissionCodes(ctx context.Context, restaurantID, userID uuid.UUID) ([]string, error)
	ResolveRestaurantIDByCode(ctx context.Context, code string) (uuid.UUID, error)
	RecordLoginSuccess(ctx context.Context, restaurantID, userID uuid.UUID) error
	RecordLoginFailure(ctx context.Context, restaurantID, userID uuid.UUID) error
}

type OutboxWriter interface {
	Write(ctx context.Context, event any) error
}
