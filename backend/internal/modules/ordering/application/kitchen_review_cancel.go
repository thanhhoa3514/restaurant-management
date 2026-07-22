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

// CancelRequestDTO is a pending guest cancel request shown on the kitchen screen
// so staff can approve (dish is discarded, item -> CANCELLED) or reject (keep cooking).
type CancelRequestDTO struct {
	ID           uuid.UUID `json:"id"`
	OrderItemID  uuid.UUID `json:"order_item_id"`
	OrderID      uuid.UUID `json:"order_id"`
	SessionID    uuid.UUID `json:"session_id"`
	TableCode    string    `json:"table_code"`
	NameSnapshot string    `json:"name_snapshot"`
	Quantity     int       `json:"quantity"`
	ItemStatus   string    `json:"item_status"`
	Reason       string    `json:"reason"`
	Status       string    `json:"status"`
	RequestedAt  time.Time `json:"requested_at"`
}

type CancelRequestReviewResult struct {
	CancelRequestID uuid.UUID `json:"cancel_request_id"`
	OrderItemID     uuid.UUID `json:"order_item_id"`
	SessionID       uuid.UUID `json:"session_id"`
	Status          string    `json:"status"`      // APPROVED / REJECTED
	ItemStatus      string    `json:"item_status"` // resulting order_item status
}

type ReviewCancelRequestRequest struct {
	Action string `json:"action"` // approve | reject
	Note   string `json:"note"`
}

type PendingCancelRequestsResponse struct {
	CancelRequests []CancelRequestDTO `json:"cancel_requests"`
}

// KitchenListCancelRequests returns pending guest cancel requests for the kitchen queue.
type KitchenListCancelRequests struct {
	repo                StaffReadRepository
	defaultRestaurantID uuid.UUID
}

func NewKitchenListCancelRequests(repo StaffReadRepository, defaultRestaurantID uuid.UUID) *KitchenListCancelRequests {
	return &KitchenListCancelRequests{repo: repo, defaultRestaurantID: defaultRestaurantID}
}

func (s *KitchenListCancelRequests) Handle(ctx context.Context) (PendingCancelRequestsResponse, error) {
	list, err := s.repo.ListPendingCancelRequests(ctx, s.defaultRestaurantID)
	if err != nil {
		return PendingCancelRequestsResponse{}, err
	}
	return PendingCancelRequestsResponse{CancelRequests: list}, nil
}

// KitchenReviewCancelRequest approves or rejects a pending guest cancel request.
// Approve -> order_item becomes CANCELLED and drops off the cooking queue.
// Reject  -> request closed, item keeps cooking. Realtime tells the guest either way.
type KitchenReviewCancelRequest struct {
	tx                  TxRunner
	repo                StaffReadRepository
	outbox              domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewKitchenReviewCancelRequest(tx TxRunner, repo StaffReadRepository, outboxWriter domain.OutboxWriter, defaultRestaurantID uuid.UUID) *KitchenReviewCancelRequest {
	return &KitchenReviewCancelRequest{tx: tx, repo: repo, outbox: outboxWriter, defaultRestaurantID: defaultRestaurantID}
}

func (s *KitchenReviewCancelRequest) Handle(ctx context.Context, cancelRequestID uuid.UUID, req ReviewCancelRequestRequest, actorID *uuid.UUID) (CancelRequestReviewResult, error) {
	var out CancelRequestReviewResult
	action := strings.ToLower(strings.TrimSpace(req.Action))
	var approve bool
	switch action {
	case "approve":
		approve = true
	case "reject":
		approve = false
	default:
		return out, apperr.New(apperr.CodeInvalid, "action must be approve or reject")
	}
	restaurantID := s.defaultRestaurantID
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		var err error
		out, err = s.repo.ReviewCancelRequest(ctx, restaurantID, cancelRequestID, approve, actorID, req.Note)
		if err != nil {
			return err
		}
		if s.outbox != nil {
			return s.outbox.Write(ctx, outbox.WriteEvent{
				RestaurantID:  restaurantID,
				AggregateType: "cancel_request",
				AggregateID:   cancelRequestID,
				EventType:     "cancel_request.reviewed",
				Payload: map[string]any{
					"cancel_request_id": out.CancelRequestID,
					"order_item_id":     out.OrderItemID,
					"session_id":        out.SessionID,
					"status":            out.Status,
					"item_status":       out.ItemStatus,
				},
			})
		}
		return nil
	})
	return out, err
}
