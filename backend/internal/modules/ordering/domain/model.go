package domain

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type OrderItemStatus string

const (
	StatusPending      OrderItemStatus = "PENDING"
	StatusAcknowledged OrderItemStatus = "ACKNOWLEDGED"
	StatusPreparing    OrderItemStatus = "PREPARING"
	StatusReady        OrderItemStatus = "READY"
	StatusServed       OrderItemStatus = "SERVED"
	StatusUnavailable  OrderItemStatus = "UNAVAILABLE"
)

var allowedTransitions = map[OrderItemStatus][]OrderItemStatus{
	StatusPending:      {StatusAcknowledged, StatusUnavailable},
	StatusAcknowledged: {StatusPreparing, StatusUnavailable},
	StatusPreparing:    {StatusReady},
	StatusReady:        {StatusServed},
}

func (s OrderItemStatus) CanMoveTo(next OrderItemStatus) bool {
	for _, candidate := range allowedTransitions[s] {
		if candidate == next {
			return true
		}
	}
	return false
}

type SessionForOrder struct {
	ID           uuid.UUID
	RestaurantID uuid.UUID
	TableID      uuid.UUID
	Status       string
}

type MenuItemForOrder struct {
	ID                 uuid.UUID
	Code               string
	Name               string
	BasePriceVND       int64
	Station            string
	Status             string
	IsAvailable        bool
	AvailabilityStatus string
	Orderable          bool
}

type VariantForOrder struct {
	ID       uuid.UUID
	Name     string
	PriceVND int64
}

type OptionGroupRule struct {
	ID            uuid.UUID
	Name          string
	SelectionType string
	IsRequired    bool
	MinSelections int
	MaxSelections *int
}

type OptionForOrder struct {
	ID            uuid.UUID
	GroupID       uuid.UUID
	Name          string
	GroupName     string
	PriceDeltaVND int64
}

type OrderCreate struct {
	ID              uuid.UUID
	RestaurantID    uuid.UUID
	SessionID       uuid.UUID
	TableID         uuid.UUID
	OrderNumber     string
	OrderType       string
	Note            string
	PlacedBy        string // GUEST or STAFF
	PlacedByUserID  *uuid.UUID
	CustomerName    string  // takeaway: customer name
	CustomerPhone   string  // takeaway: customer phone
	PickupTime      *time.Time
	Lines           []OrderLineCreate
	KitchenTickets  []KitchenTicketCreate
	SessionTotalVND int64
}

type OrderLineCreate struct {
	ID                  uuid.UUID
	MenuItemID          uuid.UUID
	VariantID           *uuid.UUID
	ItemNameSnapshot    string
	ItemCodeSnapshot    string
	VariantNameSnapshot *string
	UnitPriceVND        int64
	Quantity            int
	OptionsTotalVND     int64
	SubtotalVND         int64
	DiscountAmountVND   int64
	TotalAmountVND      int64
	Status              string
	Station             string
	Note                string
	Options             []OrderOptionCreate
}

type OrderOptionCreate struct {
	OptionID                uuid.UUID
	OptionGroupID           uuid.UUID
	OptionNameSnapshot      string
	OptionGroupNameSnapshot string
	PriceDeltaSnapshotVND   int64
	Quantity                int
}

type KitchenTicketCreate struct {
	ID           uuid.UUID
	TicketNumber string
	Station      string
	ItemIndexes  []int
}

type OrderView struct {
	Orders          []OrderRead
	SessionTotalVND int64
}

type OrderRead struct {
	ID          uuid.UUID
	OrderNumber string
	OrderType   string
	Status      string
	Version     int
	SubmittedAt time.Time
	Note        string
	Items       []OrderItemRead
}

type OrderItemRead struct {
	ID                  uuid.UUID
	OrderID             uuid.UUID
	MenuItemID          uuid.UUID
	NameSnapshot        string
	VariantNameSnapshot *string
	Quantity            int
	UnitPriceVND        int64
	OptionsTotalVND     int64
	SubtotalVND         int64
	TotalAmountVND      int64
	Status              string
	Station             string
	Note                string
	UnavailableReason   *string
	Options             []OrderOptionRead
}

type OrderOptionRead struct {
	OptionID                uuid.UUID
	OptionGroupID           uuid.UUID
	NameSnapshot            string
	OptionGroupNameSnapshot string
	PriceDeltaSnapshotVND   int64
	Quantity                int
}

type OrderForEdit struct {
	ID          uuid.UUID
	OrderNumber string
	OrderType   string
	Status      string
	Version     int
}

type OrderLineForEdit struct {
	ID                  uuid.UUID
	OrderID             uuid.UUID
	MenuItemID          uuid.UUID
	VariantID           *uuid.UUID
	Status              string
	Quantity            int
	UnitPriceVND        int64
	Note                string
	VariantNameSnapshot *string
}

type OrderLineOptionForEdit struct {
	OrderItemID             uuid.UUID
	OptionID                uuid.UUID
	OptionGroupID           uuid.UUID
	OptionNameSnapshot      string
	OptionGroupNameSnapshot string
	PriceDeltaSnapshotVND   int64
	Quantity                int
}

type CancelRequestCreate struct {
	ID          uuid.UUID
	OrderItemID uuid.UUID
	Reason      string
	Status      string
}

type OrderPlacementRepository interface {
	LockSessionForOrder(ctx context.Context, restaurantID, sessionID uuid.UUID) (*SessionForOrder, error)
	FindMenuItemForOrder(ctx context.Context, restaurantID, menuItemID uuid.UUID) (*MenuItemForOrder, error)
	FindVariantForOrder(ctx context.Context, restaurantID, menuItemID, variantID uuid.UUID) (*VariantForOrder, error)
	ListOptionGroupRules(ctx context.Context, restaurantID, menuItemID uuid.UUID) ([]OptionGroupRule, error)
	ListOptionsForOrder(ctx context.Context, restaurantID, menuItemID uuid.UUID, optionIDs []uuid.UUID) ([]OptionForOrder, error)
	HasPriorOrders(ctx context.Context, restaurantID, sessionID uuid.UUID) (bool, error)
	CreateOrderGraph(ctx context.Context, order *OrderCreate) error
	SessionTotal(ctx context.Context, restaurantID, sessionID uuid.UUID) (int64, error)
}

type OrderReadRepository interface {
	ViewSessionOrders(ctx context.Context, restaurantID, sessionID uuid.UUID) (OrderView, error)
}

type OrderEditRepository interface {
	LockSessionForOrder(ctx context.Context, restaurantID, sessionID uuid.UUID) (*SessionForOrder, error)
	LockOrderForGuest(ctx context.Context, restaurantID, sessionID, orderID uuid.UUID) (*OrderForEdit, error)
	LoadOrderLinesForEdit(ctx context.Context, restaurantID, sessionID, orderID uuid.UUID) ([]OrderLineForEdit, error)
	LoadOrderLineOptionsForEdit(ctx context.Context, restaurantID uuid.UUID, lineIDs []uuid.UUID) (map[uuid.UUID][]OrderLineOptionForEdit, error)
	FindMenuItemForOrder(ctx context.Context, restaurantID, menuItemID uuid.UUID) (*MenuItemForOrder, error)
	FindVariantForOrder(ctx context.Context, restaurantID, menuItemID, variantID uuid.UUID) (*VariantForOrder, error)
	ListOptionGroupRules(ctx context.Context, restaurantID, menuItemID uuid.UUID) ([]OptionGroupRule, error)
	ListOptionsForOrder(ctx context.Context, restaurantID, menuItemID uuid.UUID, optionIDs []uuid.UUID) ([]OptionForOrder, error)
	UpdateOrderLine(ctx context.Context, restaurantID uuid.UUID, line OrderLineCreate) error
	CancelOrderLines(ctx context.Context, restaurantID, orderID uuid.UUID, lineIDs []uuid.UUID, reason string) error
	FinishOrderMutation(ctx context.Context, restaurantID, orderID uuid.UUID, cancelIfAllLinesCancelled bool, reason string) (int, string, error)
	SessionTotal(ctx context.Context, restaurantID, sessionID uuid.UUID) (int64, error)
	ViewSessionOrders(ctx context.Context, restaurantID, sessionID uuid.UUID) (OrderView, error)
	LockOrderLineForCancelRequest(ctx context.Context, restaurantID, sessionID, orderID, orderItemID uuid.UUID) (*OrderLineForEdit, error)
	OpenCancelRequestExists(ctx context.Context, restaurantID, orderItemID uuid.UUID) (bool, error)
	CreateCancelRequest(ctx context.Context, restaurantID uuid.UUID, req *CancelRequestCreate) error
}

type OutboxWriter interface {
	Write(ctx context.Context, event any) error
}
