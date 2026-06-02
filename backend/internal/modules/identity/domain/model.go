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

type User struct {
	ID           uuid.UUID
	RestaurantID uuid.UUID
	Email        string
	Role         Role
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
	Save(ctx context.Context, aggregate *User) error
	Get(ctx context.Context, restaurantID uuid.UUID, id uuid.UUID) (*User, error)
}

type OutboxWriter interface {
	Write(ctx context.Context, event any) error
}
