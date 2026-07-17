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
	CreatedBy    *uuid.UUID
}

// TableWithQR is a read projection joining a table to its current active QR
// code (if any). QR fields are nil when the table has no active QR.
type TableWithQR struct {
	TableID   uuid.UUID
	TableCode string
	TableName string
	Status    string
	Capacity  int
	AreaName  string
	AreaOrder int
	QRCodeID  *uuid.UUID
	QRToken   *string
}

type DiningSession struct {
	ID           uuid.UUID
	RestaurantID uuid.UUID
	TableID      uuid.UUID
	QRCodeID     *uuid.UUID
	SessionCode  string
	// SessionToken is stored raw because the token is a shared per-session
	// bearer value returned by join-session. Per-guest hashed tokens are deferred.
	SessionToken  string
	Status        SessionStatus
	OpenedVia     OpenedVia
	OpenedBy      *uuid.UUID
	CustomerName  string
	MergeGroupID  *uuid.UUID
	Version       int
	ClosedAt      *time.Time
}

// MergeGroup represents a group of dining sessions merged together
// for a single party occupying multiple tables.
type MergeGroup struct {
	ID           uuid.UUID
	RestaurantID uuid.UUID
	MergedBy     *uuid.UUID
	Note         string
	IsActive     bool
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

type DiningRepository interface {
	FindTable(ctx context.Context, restaurantID, tableID uuid.UUID) (*Table, error)
	ActiveQRForTable(ctx context.Context, restaurantID, tableID uuid.UUID) (*QRCode, error)
	CreateSession(ctx context.Context, session *DiningSession) error
	FindQRByToken(ctx context.Context, qrToken string) (*QRCode, error)
	FindActiveSessionByTable(ctx context.Context, restaurantID, tableID uuid.UUID) (*DiningSession, error)
	ListTablesWithActiveQR(ctx context.Context, restaurantID uuid.UUID) ([]TableWithQR, error)
	CloseSession(ctx context.Context, restaurantID, sessionID uuid.UUID, closedBy *uuid.UUID) (*DiningSession, bool, error)
	DeactivateActiveQR(ctx context.Context, restaurantID, tableID uuid.UUID, deactivatedBy *uuid.UUID, reason string) error
	CreateQR(ctx context.Context, qr *QRCode) error
	UpdateSessionCustomerName(ctx context.Context, sessionID uuid.UUID, name string) error

	FindSessionByID(ctx context.Context, restaurantID, sessionID uuid.UUID) (*DiningSession, error)

	// Merge group operations
	CreateMergeGroup(ctx context.Context, g *MergeGroup) error
	DeactivateMergeGroup(ctx context.Context, restaurantID, groupID uuid.UUID) error
	FindActiveMergeGroup(ctx context.Context, restaurantID, groupID uuid.UUID) (*MergeGroup, error)
	FindSessionsByMergeGroup(ctx context.Context, restaurantID, groupID uuid.UUID) ([]DiningSession, error)
	UpdateSessionMergeGroup(ctx context.Context, sessionID uuid.UUID, mergeGroupID *uuid.UUID) error
}

type OutboxWriter interface {
	Write(ctx context.Context, event any) error
}
