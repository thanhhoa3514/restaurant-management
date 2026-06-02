package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type SessionStatus string

const (
	SessionActive          SessionStatus = "ACTIVE"
	SessionAwaitingPayment SessionStatus = "AWAITING_PAYMENT"
	SessionClosed          SessionStatus = "CLOSED"
)

type OpenedVia string

const (
	OpenedViaQRScan OpenedVia = "QR_SCAN"
	OpenedViaStaff  OpenedVia = "STAFF"
)

type Area struct {
	ID           uuid.UUID
	RestaurantID uuid.UUID
	Name         string
}

type Table struct {
	ID           uuid.UUID
	RestaurantID uuid.UUID
	AreaID       uuid.UUID
	Code         string
	Name         string
	Version      int
	DeletedAt    *time.Time
}

type QRCode struct {
	ID           uuid.UUID
	RestaurantID uuid.UUID
	TableID      uuid.UUID
	Token        string
	IsActive     bool
}

type DiningSession struct {
	ID           uuid.UUID
	RestaurantID uuid.UUID
	TableID      uuid.UUID
	QRCodeID     *uuid.UUID
	SessionCode  string
	// SessionToken is stored raw because the token is a shared per-session
	// bearer value returned by join-session. Per-guest hashed tokens are deferred.
	SessionToken string
	Status       SessionStatus
	OpenedVia    OpenedVia
	OpenedBy     *uuid.UUID
	Version      int
	ClosedAt     *time.Time
}

type Event struct {
	ID           uuid.UUID
	RestaurantID uuid.UUID
	Type         string
	Payload      any
	OccurredAt   time.Time
}

type DiningRepository interface {
	FindTable(ctx context.Context, restaurantID, tableID uuid.UUID) (*Table, error)
	ActiveQRForTable(ctx context.Context, restaurantID, tableID uuid.UUID) (*QRCode, error)
	CreateSession(ctx context.Context, session *DiningSession) error
	ResolveQRToken(ctx context.Context, qrToken string) (restaurantID, tableID uuid.UUID, err error)
	FindActiveSessionByTable(ctx context.Context, restaurantID, tableID uuid.UUID) (*DiningSession, error)
}

type OutboxWriter interface {
	Write(ctx context.Context, event any) error
}
