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

// StaffUser is a read projection for the staff-management screen.
type StaffUser struct {
	ID          uuid.UUID
	Username    string
	FullName    string
	Email       *string
	Phone       *string
	RoleName    string
	Status      UserStatus
	LastLoginAt *time.Time
	CreatedAt   time.Time
}

type RoleInfo struct {
	ID          uuid.UUID
	Name        string
	DisplayName string
}

type NewUser struct {
	RestaurantID uuid.UUID
	Username     string
	Email        *string
	Phone        *string
	PasswordHash string
	FullName     string
	RoleID       uuid.UUID
}

// UserUpdate carries optional profile changes; nil fields are left unchanged.
type UserUpdate struct {
	FullName *string
	Email    *string
	Phone    *string
	RoleID   *uuid.UUID
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
	ListStaff(ctx context.Context, restaurantID uuid.UUID) ([]StaffUser, error)
	ListRoles(ctx context.Context) ([]RoleInfo, error)
	FindRoleByName(ctx context.Context, name string) (*RoleInfo, error)
	CreateUser(ctx context.Context, u NewUser) (uuid.UUID, error)
	UpdateUser(ctx context.Context, restaurantID, userID uuid.UUID, upd UserUpdate) error
	SetUserStatus(ctx context.Context, restaurantID, userID uuid.UUID, status UserStatus) error
	SetUserPassword(ctx context.Context, restaurantID, userID uuid.UUID, passwordHash string) error
}

type OutboxWriter interface {
	Write(ctx context.Context, event any) error
}
