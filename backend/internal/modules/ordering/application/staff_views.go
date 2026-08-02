package application

import (
	"context"
	"maps"
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
	ID        uuid.UUID        `json:"id"`
	Code      string           `json:"code"`
	Name      string           `json:"name"`
	Capacity  int              `json:"capacity"`
	Status    string           `json:"status"`
	AreaName  string           `json:"area_name"`
	PositionX *int             `json:"position_x"`
	PositionY *int             `json:"position_y"`
	Session   *StaffSessionDTO `json:"session"`
}

type StaffSessionDTO struct {
	ID               uuid.UUID       `json:"id"`
	SessionCode      string          `json:"session_code"`
	Status           string          `json:"status"`
	CustomerCount    int             `json:"customer_count"`
	GuestName        string          `json:"guest_name"`
	OpenedAt         time.Time       `json:"opened_at"`
	BillRequestedAt  *time.Time      `json:"bill_requested_at"`
	WaiterCalledAt   *time.Time      `json:"waiter_called_at"`
	WaiterCallReason string          `json:"waiter_call_reason"`
	MergeGroupID     *uuid.UUID      `json:"merge_group_id"`
	Orders           []StaffOrderDTO `json:"orders"`
	TotalVND         int64           `json:"total_vnd"`
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
	IsTakeaway          bool             `json:"is_takeaway"`
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
	Status        string    `json:"status"`
	FromStatus    *string   `json:"from_status"`
	ToStatus      string    `json:"to_status"`
	Timestamp     time.Time `json:"timestamp"`
	ChangedByName *string   `json:"changed_by_name"`
	ChangedByRole *string   `json:"changed_by_role"`
	Reason        *string   `json:"reason"`
	Note          *string   `json:"note"`
}

type KitchenQueueResponse struct {
	Tickets []KitchenTicketDTO `json:"tickets"`
}

type KitchenTicketDTO struct {
	ID          uuid.UUID              `json:"id"`
	OrderID     uuid.UUID              `json:"order_id"`
	SessionID   *uuid.UUID             `json:"session_id,omitempty"`
	TableID     *uuid.UUID             `json:"table_id,omitempty"`
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
	IsTakeaway          bool             `json:"is_takeaway"`
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
	// SessionID để outbox định tuyến realtime tới đúng máy khách của phiên đó.
	// nil với đơn mang về (takeaway) — không gắn phiên nào.
	SessionID *uuid.UUID `json:"session_id,omitempty"`
	// ItemName để thông báo realtime gọi đúng tên món thay vì "món ăn".
	ItemName string `json:"item_name"`
	// TableCode để toast của nhân viên nói rõ bàn nào thay vì chung chung.
	TableCode string `json:"table_code,omitempty"`
}

// itemEventPayload gom payload chung cho 4 event trạng thái món.
// Đơn mang về không có phiên/bàn → bỏ hẳn key, tránh outbox route tới topic rỗng.
func itemEventPayload(itemID uuid.UUID, out UpdateItemStatusResponse, extra map[string]any) map[string]any {
	payload := map[string]any{"item_id": itemID, "status": out.Status, "item_name": out.ItemName}
	if out.SessionID != nil {
		payload["session_id"] = *out.SessionID
	}
	if out.TableCode != "" {
		payload["table_code"] = out.TableCode
	}
	maps.Copy(payload, extra)
	return payload
}

type RequestBillResponse struct {
	SessionID uuid.UUID  `json:"session_id"`
	Status    string     `json:"status"`
	Requested *time.Time `json:"requested_at"`
	TableCode string     `json:"table_code,omitempty"`
	Reason    string     `json:"reason,omitempty"`
}

type StaffReadRepository interface {
	ListStaffTables(ctx context.Context, restaurantID uuid.UUID) ([]StaffTableDTO, error)
	ListKitchenQueue(ctx context.Context, restaurantID uuid.UUID) ([]KitchenTicketDTO, error)
	RequestBill(ctx context.Context, restaurantID, sessionID uuid.UUID) (RequestBillResponse, error)
	ReopenSession(ctx context.Context, restaurantID, sessionID uuid.UUID) (RequestBillResponse, error)
	CallWaiter(ctx context.Context, restaurantID, sessionID uuid.UUID, reason string) (RequestBillResponse, error)
	AckWaiterCall(ctx context.Context, restaurantID, sessionID uuid.UUID) (RequestBillResponse, error)
	UpdateOrderItemStatus(ctx context.Context, restaurantID, itemID uuid.UUID, status string, actorID *uuid.UUID, actorRole string) (UpdateItemStatusResponse, error)
	ConfirmOrderItem(ctx context.Context, restaurantID, itemID uuid.UUID, actorID *uuid.UUID, actorRole string) (UpdateItemStatusResponse, error)
	RejectOrderItem(ctx context.Context, restaurantID, itemID uuid.UUID, reason string, actorID *uuid.UUID, actorRole string) (UpdateItemStatusResponse, error)
	MarkItemUnavailable(ctx context.Context, restaurantID, itemID uuid.UUID, reason string, actorID *uuid.UUID) (UpdateItemStatusResponse, error)
	ListPendingCancelRequests(ctx context.Context, restaurantID uuid.UUID) ([]CancelRequestDTO, error)
	ReviewCancelRequest(ctx context.Context, restaurantID, cancelRequestID uuid.UUID, approve bool, reviewedBy *uuid.UUID, note string) (CancelRequestReviewResult, error)
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

type StaffReopenSession struct {
	tx                  TxRunner
	repo                StaffReadRepository
	outbox              domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewStaffReopenSession(tx TxRunner, repo StaffReadRepository, outboxWriter domain.OutboxWriter, defaultRestaurantID uuid.UUID) *StaffReopenSession {
	return &StaffReopenSession{tx: tx, repo: repo, outbox: outboxWriter, defaultRestaurantID: defaultRestaurantID}
}

func (s *StaffReopenSession) Handle(ctx context.Context, sessionID uuid.UUID) (RequestBillResponse, error) {
	var out RequestBillResponse
	restaurantID := s.defaultRestaurantID
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		var err error
		out, err = s.repo.ReopenSession(ctx, restaurantID, sessionID)
		if err != nil {
			return err
		}
		if s.outbox != nil {
			return s.outbox.Write(ctx, outbox.WriteEvent{RestaurantID: restaurantID, AggregateType: "dining_session", AggregateID: sessionID, EventType: "dining.session_reopened", Payload: map[string]any{"session_id": sessionID, "status": out.Status}})
		}
		return nil
	})
	return out, err
}

type GuestCallWaiter struct {
	tx                  TxRunner
	repo                StaffReadRepository
	outbox              domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewGuestCallWaiter(tx TxRunner, repo StaffReadRepository, outboxWriter domain.OutboxWriter, defaultRestaurantID uuid.UUID) *GuestCallWaiter {
	return &GuestCallWaiter{tx: tx, repo: repo, outbox: outboxWriter, defaultRestaurantID: defaultRestaurantID}
}

func (s *GuestCallWaiter) Handle(ctx context.Context, sessionID uuid.UUID, reason string) (RequestBillResponse, error) {
	var out RequestBillResponse
	restaurantID := s.defaultRestaurantID
	reason = strings.TrimSpace(reason)
	if len([]rune(reason)) > 120 {
		reason = string([]rune(reason)[:120])
	}
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		var err error
		out, err = s.repo.CallWaiter(ctx, restaurantID, sessionID, reason)
		if err != nil {
			return err
		}
		if s.outbox != nil {
			return s.outbox.Write(ctx, outbox.WriteEvent{RestaurantID: restaurantID, AggregateType: "dining_session", AggregateID: sessionID, EventType: "dining.waiter_called", Payload: map[string]any{
				"session_id": sessionID,
				"table_code": out.TableCode,
				"reason":     out.Reason,
			}})
		}
		return nil
	})
	return out, err
}

// StaffAckWaiterCall clears the waiter-call flag once staff attends the table.
type StaffAckWaiterCall struct {
	tx                  TxRunner
	repo                StaffReadRepository
	outbox              domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewStaffAckWaiterCall(tx TxRunner, repo StaffReadRepository, outboxWriter domain.OutboxWriter, defaultRestaurantID uuid.UUID) *StaffAckWaiterCall {
	return &StaffAckWaiterCall{tx: tx, repo: repo, outbox: outboxWriter, defaultRestaurantID: defaultRestaurantID}
}

func (s *StaffAckWaiterCall) Handle(ctx context.Context, sessionID uuid.UUID) (RequestBillResponse, error) {
	var out RequestBillResponse
	restaurantID := s.defaultRestaurantID
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		var err error
		out, err = s.repo.AckWaiterCall(ctx, restaurantID, sessionID)
		if err != nil {
			return err
		}
		if s.outbox != nil {
			return s.outbox.Write(ctx, outbox.WriteEvent{RestaurantID: restaurantID, AggregateType: "dining_session", AggregateID: sessionID, EventType: "dining.waiter_call_acked", Payload: map[string]any{"session_id": sessionID}})
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
			return s.outbox.Write(ctx, outbox.WriteEvent{RestaurantID: restaurantID, AggregateType: "order_item", AggregateID: itemID, EventType: "ordering.item_status_updated", Payload: itemEventPayload(itemID, out, nil)})
		}
		return nil
	})
	return out, err
}

type ServerReviewOrderItem struct {
	tx                  TxRunner
	repo                StaffReadRepository
	outbox              domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewServerReviewOrderItem(tx TxRunner, repo StaffReadRepository, outboxWriter domain.OutboxWriter, defaultRestaurantID uuid.UUID) *ServerReviewOrderItem {
	return &ServerReviewOrderItem{tx: tx, repo: repo, outbox: outboxWriter, defaultRestaurantID: defaultRestaurantID}
}

func (s *ServerReviewOrderItem) Confirm(ctx context.Context, itemID uuid.UUID, actorID *uuid.UUID, actorRole string) (UpdateItemStatusResponse, error) {
	var out UpdateItemStatusResponse
	restaurantID := s.defaultRestaurantID
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		var err error
		out, err = s.repo.ConfirmOrderItem(ctx, restaurantID, itemID, actorID, actorRole)
		if err != nil {
			return err
		}
		if s.outbox != nil {
			return s.outbox.Write(ctx, outbox.WriteEvent{RestaurantID: restaurantID, AggregateType: "order_item", AggregateID: itemID, EventType: "ordering.item_confirmed", Payload: itemEventPayload(itemID, out, nil)})
		}
		return nil
	})
	return out, err
}

func (s *ServerReviewOrderItem) Reject(ctx context.Context, itemID uuid.UUID, reason string, actorID *uuid.UUID, actorRole string) (UpdateItemStatusResponse, error) {
	var out UpdateItemStatusResponse
	restaurantID := s.defaultRestaurantID
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		var err error
		out, err = s.repo.RejectOrderItem(ctx, restaurantID, itemID, strings.TrimSpace(reason), actorID, actorRole)
		if err != nil {
			return err
		}
		if s.outbox != nil {
			return s.outbox.Write(ctx, outbox.WriteEvent{RestaurantID: restaurantID, AggregateType: "order_item", AggregateID: itemID, EventType: "ordering.item_rejected", Payload: itemEventPayload(itemID, out, map[string]any{"reason": reason})})
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
