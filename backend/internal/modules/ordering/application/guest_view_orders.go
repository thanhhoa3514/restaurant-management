package application

import (
	"context"
	"time"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/ordering/domain"
	"restaurant-management/internal/platform/guest"
	"restaurant-management/internal/shared/apperr"
)

type GuestOrdersResponse struct {
	Orders          []GuestOrderDTO `json:"orders"`
	SessionTotalVND int64           `json:"session_total_vnd"`
}

type GuestOrderDTO struct {
	ID          uuid.UUID           `json:"id"`
	OrderNumber string              `json:"order_number"`
	OrderType   string              `json:"order_type"`
	Status      string              `json:"status"`
	SubmittedAt time.Time           `json:"submitted_at"`
	Note        string              `json:"note"`
	Version     int                 `json:"version"`
	Items       []GuestOrderItemDTO `json:"items"`
}

type GuestViewOrders struct {
	repo                domain.OrderReadRepository
	defaultRestaurantID uuid.UUID
}

func NewGuestViewOrders(repo domain.OrderReadRepository, defaultRestaurantID uuid.UUID) *GuestViewOrders {
	return &GuestViewOrders{repo: repo, defaultRestaurantID: defaultRestaurantID}
}

func (s *GuestViewOrders) Handle(ctx context.Context) (GuestOrdersResponse, error) {
	var out GuestOrdersResponse
	restaurantID := s.defaultRestaurantID
	gs, ok := guest.SessionFromContext(ctx)
	if !ok || gs.SessionID == uuid.Nil {
		return out, apperr.New(apperr.CodeUnauthorized, "missing guest session")
	}
	view, err := s.repo.ViewSessionOrders(ctx, restaurantID, gs.SessionID)
	if err != nil {
		return out, err
	}
	orders := make([]GuestOrderDTO, 0, len(view.Orders))
	for _, order := range view.Orders {
		items := make([]GuestOrderItemDTO, 0, len(order.Items))
		for _, item := range order.Items {
			options := make([]GuestOrderOptionDTO, 0, len(item.Options))
			for _, opt := range item.Options {
				options = append(options, GuestOrderOptionDTO{OptionID: opt.OptionID, OptionGroupID: opt.OptionGroupID, NameSnapshot: opt.NameSnapshot, PriceDeltaSnapshotVND: opt.PriceDeltaSnapshotVND, Quantity: opt.Quantity})
			}
			items = append(items, GuestOrderItemDTO{OrderItemID: item.ID, MenuItemID: item.MenuItemID, NameSnapshot: item.NameSnapshot, VariantNameSnapshot: item.VariantNameSnapshot, Quantity: item.Quantity, UnitPriceVND: item.UnitPriceVND, OptionsTotalVND: item.OptionsTotalVND, SubtotalVND: item.SubtotalVND, TotalAmountVND: item.TotalAmountVND, Status: item.Status, Station: item.Station, Options: options, UnavailableReason: item.UnavailableReason})
		}
		orders = append(orders, GuestOrderDTO{ID: order.ID, OrderNumber: order.OrderNumber, OrderType: order.OrderType, Status: order.Status, SubmittedAt: order.SubmittedAt, Note: order.Note, Version: order.Version, Items: items})
	}
	return GuestOrdersResponse{Orders: orders, SessionTotalVND: view.SessionTotalVND}, nil
}
