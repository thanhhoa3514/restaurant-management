package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type SessionStatus string

const (
	SessionPendingVerification SessionStatus = "PENDING_VERIFICATION"
	SessionActive              SessionStatus = "ACTIVE"
	SessionAwaitingPayment     SessionStatus = "AWAITING_PAYMENT"
	SessionClosed              SessionStatus = "CLOSED"
)

type OpenedVia string

const (
	OpenedViaQRScan OpenedVia = "QR_SCAN"
	OpenedViaStaff  OpenedVia = "STAFF"
)

// DeviceStatus gates a single physical phone that joined a session. Only an
// APPROVED device holds a usable access token; a PENDING device waits for a
// waiter, so a shared QR link can never bypass the confirmation gate.
type DeviceStatus string

const (
	DevicePending  DeviceStatus = "PENDING"
	DeviceApproved DeviceStatus = "APPROVED"
	DeviceRejected DeviceStatus = "REJECTED"
)

// SessionDevice is one phone attached to a dining session. The session still
// owns the table and the bill; devices only decide who is allowed to order.
// The first device to open a table is the owner and its name becomes the
// session's single displayed customer name (one name per table).
type SessionDevice struct {
	ID           uuid.UUID
	RestaurantID uuid.UUID
	SessionID    uuid.UUID
	DeviceID     string
	GuestName    string
	Status       DeviceStatus
	AccessToken  string
	IsOwner      bool
	ApprovedBy   *uuid.UUID
	ApprovedAt   *time.Time
}

// PendingDeviceDTO is one waiting phone as the waiter sees it: which table,
// which name typed, and whether it is the table's first (owner) device.
type PendingDeviceDTO struct {
	DeviceID  uuid.UUID `json:"device_id"` // session_devices.id (opaque row id)
	SessionID uuid.UUID `json:"session_id"`
	TableID   uuid.UUID `json:"table_id"`
	TableCode string    `json:"table_code"`
	TableName string    `json:"table_name"`
	GuestName string    `json:"customer_name"`
	IsOwner   bool      `json:"is_owner"`
	CreatedAt time.Time `json:"created_at"`
}

type Area struct {
	ID           uuid.UUID
	RestaurantID uuid.UUID
	Name         string
	Description  string
	DisplayOrder int
	IsActive     bool
}

type Table struct {
	ID           uuid.UUID
	RestaurantID uuid.UUID
	AreaID       uuid.UUID
	Code         string
	Name         string
	Capacity     int
	Status       string
	PositionX    *int // % chiều ngang trên sơ đồ bàn; nil = chưa xếp chỗ
	PositionY    *int
	Version      int
	DeletedAt    *time.Time
}

// TablePosition là một ô trên sơ đồ bàn, toạ độ theo % khung (0–100).
type TablePosition struct {
	TableID uuid.UUID
	X       int
	Y       int
}

type QRCode struct {
	ID           uuid.UUID
	RestaurantID uuid.UUID
	TableID      uuid.UUID
	Token        string
	IsActive     bool
	CreatedBy    *uuid.UUID
}
type ListTableTest struct {
	TableId   uuid.UUID
	Tablename string
}

type TableWithQR struct {
	TableID          uuid.UUID
	TableCode        string
	TableName        string
	Status           string
	Capacity         int
	AreaID           *uuid.UUID
	AreaName         string
	AreaOrder        int
	PositionX        *int
	PositionY        *int
	QRCodeID         *uuid.UUID
	QRToken          *string
	HasActiveSession bool
}

type DiningSession struct {
	ID           uuid.UUID
	RestaurantID uuid.UUID
	TableID      uuid.UUID
	QRCodeID     *uuid.UUID
	SessionCode  string
	Status       SessionStatus
	OpenedVia    OpenedVia
	OpenedBy     *uuid.UUID
	CustomerName string
	MergeGroupID *uuid.UUID
	Version      int
	ClosedAt     *time.Time
}
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
	ListAreas(ctx context.Context, restaurantID uuid.UUID) ([]Area, error)
	CreateTable(ctx context.Context, t *Table) error
	UpdateTable(ctx context.Context, t *Table) error
	UpdateTablePositions(ctx context.Context, restaurantID uuid.UUID, positions []TablePosition) error
	SoftDeleteTable(ctx context.Context, restaurantID, tableID uuid.UUID) error
	CloseSession(ctx context.Context, restaurantID, sessionID uuid.UUID, closedBy *uuid.UUID) (*DiningSession, bool, error)
	AbandonPendingSession(ctx context.Context, restaurantID, sessionID uuid.UUID, closedBy *uuid.UUID) error
	DeactivateActiveQR(ctx context.Context, restaurantID, tableID uuid.UUID, deactivatedBy *uuid.UUID, reason string) error
	CreateQR(ctx context.Context, qr *QRCode) error
	CreateArea(ctx context.Context, a *Area) error
	UpdateArea(ctx context.Context, a *Area) error
	FindArea(ctx context.Context, restaurantID, areaID uuid.UUID) (*Area, error)
	DeleteArea(ctx context.Context, restaurantID, areaID uuid.UUID) error

	FindSessionByID(ctx context.Context, restaurantID, sessionID uuid.UUID) (*DiningSession, error)
	FindSessionsPendingVerification(ctx context.Context, restaurantID uuid.UUID) ([]DiningSession, error)
	VerifySession(ctx context.Context, restaurantID, sessionID uuid.UUID, verifiedBy *uuid.UUID) error

	// Per-device join gate.
	CreateSessionDevice(ctx context.Context, d *SessionDevice) error
	FindSessionDevice(ctx context.Context, sessionID uuid.UUID, deviceID string) (*SessionDevice, error)
	FindSessionDeviceByID(ctx context.Context, restaurantID, rowID uuid.UUID) (*SessionDevice, error)
	FindDeviceByToken(ctx context.Context, token string) (*SessionDevice, error)
	FindPendingDevices(ctx context.Context, restaurantID uuid.UUID) ([]PendingDeviceDTO, error)
	SetDeviceStatus(ctx context.Context, restaurantID, rowID uuid.UUID, status DeviceStatus, actorID *uuid.UUID) (*SessionDevice, error)

	ListDailySessions(ctx context.Context, restaurantID uuid.UUID, filter ListDailySessionsFilter) (ListDailySessionsResponse, error)
	GetSessionDetail(ctx context.Context, restaurantID, sessionID uuid.UUID) (SessionDetailDTO, error)

	CreateMergeGroup(ctx context.Context, g *MergeGroup) error
	DeactivateMergeGroup(ctx context.Context, restaurantID, groupID uuid.UUID) error
	FindActiveMergeGroup(ctx context.Context, restaurantID, groupID uuid.UUID) (*MergeGroup, error)
	FindSessionsByMergeGroup(ctx context.Context, restaurantID, groupID uuid.UUID) ([]DiningSession, error)
	UpdateSessionMergeGroup(ctx context.Context, sessionID uuid.UUID, mergeGroupID *uuid.UUID) error
	FindListTableTest(ctx context.Context, restaurantId uuid.UUID) ([]ListTableTest, error)
}

type OutboxWriter interface {
	Write(ctx context.Context, event any) error
}

type DailySessionItemDTO struct {
	ID              uuid.UUID  `json:"id"`
	SessionCode     string     `json:"session_code"`
	TableID         uuid.UUID  `json:"table_id"`
	TableCode       string     `json:"table_code"`
	TableName       string     `json:"table_name"`
	AreaName        string     `json:"area_name"`
	Status          string     `json:"status"`
	OpenedVia       string     `json:"opened_via"`
	OpenedAt        time.Time  `json:"opened_at"`
	OpenedByName    string     `json:"opened_by_name"`
	ClosedAt        *time.Time `json:"closed_at"`
	ClosedByName    string     `json:"closed_by_name"`
	CustomerName    string     `json:"customer_name"`
	DurationMinutes int        `json:"duration_minutes"`
	TotalItemsCount int        `json:"total_items_count"`
	TotalAmountVND  int64      `json:"total_amount_vnd"`
}

type DailySessionsStatsDTO struct {
	TotalSessions   int   `json:"total_sessions"`
	ActiveSessions  int   `json:"active_sessions"`
	ClosedSessions  int   `json:"closed_sessions"`
	TotalRevenueVND int64 `json:"total_revenue_vnd"`
}

type ListDailySessionsResponse struct {
	Sessions []DailySessionItemDTO `json:"sessions"`
	Stats    DailySessionsStatsDTO `json:"stats"`
}

type ListDailySessionsFilter struct {
	Date   string `json:"date"`   // YYYY-MM-DD
	Status string `json:"status"` // ACTIVE, CLOSED, AWAITING_PAYMENT, PENDING_VERIFICATION, ALL
	Search string `json:"search"` // Table code or session code
}

type SessionDetailDTO struct {
	DailySessionItemDTO
	Orders   []SessionOrderDetailDTO   `json:"orders"`
	Invoices []SessionInvoiceDetailDTO `json:"invoices"`
}

type SessionOrderDetailDTO struct {
	OrderID     uuid.UUID                   `json:"order_id"`
	OrderNumber string                      `json:"order_number"`
	SubmittedAt time.Time                   `json:"submitted_at"`
	Status      string                      `json:"status"`
	Items       []SessionOrderItemDetailDTO `json:"items"`
}

type SessionOrderItemDetailDTO struct {
	OrderItemID     uuid.UUID `json:"order_item_id"`
	MenuItemName    string    `json:"menu_item_name"`
	VariantName     *string   `json:"variant_name"`
	Quantity        int       `json:"quantity"`
	UnitPriceVND    int64     `json:"unit_price_vnd"`
	OptionsTotalVND int64     `json:"options_total_vnd"`
	SubtotalVND     int64     `json:"subtotal_vnd"`
	Status          string    `json:"status"`
	Station         string    `json:"station"`
	Note            string    `json:"note"`
}

type SessionInvoiceDetailDTO struct {
	ID             uuid.UUID  `json:"id"`
	InvoiceNumber  string     `json:"invoice_number"`
	Status         string     `json:"status"`
	TotalAmountVND int64      `json:"total_amount_vnd"`
	PaymentMethod  *string    `json:"payment_method"`
	PaidAt         *time.Time `json:"paid_at"`
}
