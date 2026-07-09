package application

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/ordering/domain"
	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/shared/apperr"
)

type StaffTablesResponse struct {
	Tables []StaffTableDTO `json:"tables"`
}

type StaffTableDTO struct {
	ID       uuid.UUID        `json:"id"`
	Code     string           `json:"code"`
	Name     string           `json:"name"`
	Capacity int              `json:"capacity"`
	Status   string           `json:"status"`
	AreaName string           `json:"area_name"`
	Session  *StaffSessionDTO `json:"session"`
}

type StaffSessionDTO struct {
	ID              uuid.UUID       `json:"id"`
	SessionCode     string          `json:"session_code"`
	Status          string          `json:"status"`
	CustomerCount   int             `json:"customer_count"`
	GuestName       string          `json:"guest_name"`
	OpenedAt        time.Time       `json:"opened_at"`
	BillRequestedAt *time.Time      `json:"bill_requested_at"`
	Orders          []StaffOrderDTO `json:"orders"`
	TotalVND        int64           `json:"total_vnd"`
}

type StaffOrderDTO struct {
	ID          uuid.UUID           `json:"id"`
	OrderNumber string              `json:"order_number"`
	OrderType   string              `json:"order_type"`
	Status      string              `json:"status"`
	SubmittedAt time.Time           `json:"submitted_at"`
	Note        string              `json:"note"`
	Items       []StaffOrderItemDTO `json:"items"`
}

type StaffOrderItemDTO struct {
	ID                  uuid.UUID        `json:"id"`
	OrderID             uuid.UUID        `json:"order_id"`
	MenuItemID          uuid.UUID        `json:"menu_item_id"`
	NameSnapshot        string           `json:"name_snapshot"`
	VariantNameSnapshot *string          `json:"variant_name_snapshot"`
	Quantity            int              `json:"quantity"`
	UnitPriceVND        int64            `json:"unit_price_vnd"`
	OptionsTotalVND     int64            `json:"options_total_vnd"`
	SubtotalVND         int64            `json:"subtotal_vnd"`
	TotalAmountVND      int64            `json:"total_amount_vnd"`
	Status              string           `json:"status"`
	Station             string           `json:"station"`
	Note                string           `json:"note"`
	Options             []StaffOptionDTO `json:"options"`
	StatusHistory       []StaffStatusDTO `json:"status_history"`
}

type StaffOptionDTO struct {
	NameSnapshot            string `json:"name_snapshot"`
	OptionGroupNameSnapshot string `json:"option_group_name_snapshot"`
	PriceDeltaSnapshotVND   int64  `json:"price_delta_snapshot_vnd"`
	Quantity                int    `json:"quantity"`
}

type StaffStatusDTO struct {
	Status    string    `json:"status"`
	Timestamp time.Time `json:"timestamp"`
}

type KitchenQueueResponse struct {
	Tickets []KitchenTicketDTO `json:"tickets"`
}

type KitchenTicketDTO struct {
	ID          uuid.UUID              `json:"id"`
	OrderID     uuid.UUID              `json:"order_id"`
	SessionID   uuid.UUID              `json:"session_id"`
	TableID     uuid.UUID              `json:"table_id"`
	TableCode   string                 `json:"table_code"`
	TableName   string                 `json:"table_name"`
	Number      string                 `json:"ticket_number"`
	Station     string                 `json:"station"`
	Priority    string                 `json:"priority"`
	Status      string                 `json:"status"`
	SubmittedAt time.Time              `json:"submitted_at"`
	Items       []KitchenTicketItemDTO `json:"items"`
}

type KitchenTicketItemDTO struct {
	ID                  uuid.UUID        `json:"id"`
	OrderItemID         uuid.UUID        `json:"order_item_id"`
	MenuItemID          uuid.UUID        `json:"menu_item_id"`
	NameSnapshot        string           `json:"name_snapshot"`
	VariantNameSnapshot *string          `json:"variant_name_snapshot"`
	Quantity            int              `json:"quantity"`
	Status              string           `json:"status"`
	Note                string           `json:"note"`
	Options             []StaffOptionDTO `json:"options"`
	StatusHistory       []StaffStatusDTO `json:"status_history"`
}

type UpdateItemStatusRequest struct {
	Status string `json:"status"`
}

type UpdateItemStatusResponse struct {
	ID     uuid.UUID `json:"id"`
	Status string    `json:"status"`
}

type RequestBillResponse struct {
	SessionID uuid.UUID  `json:"session_id"`
	Status    string     `json:"status"`
	Requested *time.Time `json:"requested_at"`
}

type StaffReadRepository interface {
	ListStaffTables(ctx context.Context, restaurantID uuid.UUID) ([]StaffTableDTO, error)
	ListKitchenQueue(ctx context.Context, restaurantID uuid.UUID) ([]KitchenTicketDTO, error)
	RequestBill(ctx context.Context, restaurantID, sessionID uuid.UUID) (RequestBillResponse, error)
	UpdateOrderItemStatus(ctx context.Context, restaurantID, itemID uuid.UUID, status string, actorID *uuid.UUID, actorRole string) (UpdateItemStatusResponse, error)
}

type StaffTables struct {
	repo                StaffReadRepository
	defaultRestaurantID uuid.UUID
}

func NewStaffTables(repo StaffReadRepository, defaultRestaurantID uuid.UUID) *StaffTables {
	return &StaffTables{repo: repo, defaultRestaurantID: defaultRestaurantID}
}

func (s *StaffTables) Handle(ctx context.Context) (StaffTablesResponse, error) {
	restaurantID := s.defaultRestaurantID
	tables, err := s.repo.ListStaffTables(ctx, restaurantID)
	if err != nil {
		return StaffTablesResponse{}, err
	}
	return StaffTablesResponse{Tables: tables}, nil
}

type KitchenQueue struct {
	repo                StaffReadRepository
	defaultRestaurantID uuid.UUID
}

func NewKitchenQueue(repo StaffReadRepository, defaultRestaurantID uuid.UUID) *KitchenQueue {
	return &KitchenQueue{repo: repo, defaultRestaurantID: defaultRestaurantID}
}

func (s *KitchenQueue) Handle(ctx context.Context) (KitchenQueueResponse, error) {
	restaurantID := s.defaultRestaurantID
	tickets, err := s.repo.ListKitchenQueue(ctx, restaurantID)
	if err != nil {
		return KitchenQueueResponse{}, err
	}
	return KitchenQueueResponse{Tickets: tickets}, nil
}

type StaffRequestBill struct {
	tx                  TxRunner
	repo                StaffReadRepository
	outbox              domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewStaffRequestBill(tx TxRunner, repo StaffReadRepository, outboxWriter domain.OutboxWriter, defaultRestaurantID uuid.UUID) *StaffRequestBill {
	return &StaffRequestBill{tx: tx, repo: repo, outbox: outboxWriter, defaultRestaurantID: defaultRestaurantID}
}

func (s *StaffRequestBill) Handle(ctx context.Context, sessionID uuid.UUID) (RequestBillResponse, error) {
	var out RequestBillResponse
	restaurantID := s.defaultRestaurantID
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		var err error
		out, err = s.repo.RequestBill(ctx, restaurantID, sessionID)
		if err != nil {
			return err
		}
		if s.outbox != nil {
			return s.outbox.Write(ctx, outbox.WriteEvent{RestaurantID: restaurantID, AggregateType: "dining_session", AggregateID: sessionID, EventType: "dining.bill_requested", Payload: map[string]any{"session_id": sessionID, "status": out.Status}})
		}
		return nil
	})
	return out, err
}

type StaffUpdateItemStatus struct {
	tx                  TxRunner
	repo                StaffReadRepository
	outbox              domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewStaffUpdateItemStatus(tx TxRunner, repo StaffReadRepository, outboxWriter domain.OutboxWriter, defaultRestaurantID uuid.UUID) *StaffUpdateItemStatus {
	return &StaffUpdateItemStatus{tx: tx, repo: repo, outbox: outboxWriter, defaultRestaurantID: defaultRestaurantID}
}

func (s *StaffUpdateItemStatus) Handle(ctx context.Context, itemID uuid.UUID, status string, actorID *uuid.UUID, actorRole string) (UpdateItemStatusResponse, error) {
	var out UpdateItemStatusResponse
	next := strings.ToUpper(strings.TrimSpace(status))
	if !validStaffStatus(next) {
		return out, apperr.New(apperr.CodeInvalid, "invalid item status")
	}
	restaurantID := s.defaultRestaurantID
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		var err error
		out, err = s.repo.UpdateOrderItemStatus(ctx, restaurantID, itemID, next, actorID, actorRole)
		if err != nil {
			return err
		}
		if s.outbox != nil {
			return s.outbox.Write(ctx, outbox.WriteEvent{RestaurantID: restaurantID, AggregateType: "order_item", AggregateID: itemID, EventType: "ordering.item_status_updated", Payload: map[string]any{"item_id": itemID, "status": out.Status}})
		}
		return nil
	})
	return out, err
}

func validStaffStatus(status string) bool {
	switch domain.OrderItemStatus(status) {
	case domain.StatusPending, domain.StatusAcknowledged, domain.StatusPreparing, domain.StatusReady, domain.StatusServed:
		return true
	default:
		return false
	}
}
