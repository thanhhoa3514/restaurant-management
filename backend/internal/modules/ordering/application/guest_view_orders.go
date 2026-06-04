package application

import (
	"context"
	"time"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/ordering/domain"
	"restaurant-management/internal/platform/guest"
	"restaurant-management/internal/platform/tenant"
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
	Items       []GuestOrderItemDTO `json:"items"`
}

type GuestViewOrders struct{ repo domain.OrderReadRepository }

func NewGuestViewOrders(repo domain.OrderReadRepository) *GuestViewOrders {
	return &GuestViewOrders{repo: repo}
}

func (s *GuestViewOrders) Handle(ctx context.Context) (GuestOrdersResponse, error) {
	var out GuestOrdersResponse
	restaurantID, err := tenant.MustRestaurantID(ctx)
	if err != nil {
		return out, apperr.New(apperr.CodeUnauthorized, "missing restaurant tenant")
	}
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
				options = append(options, GuestOrderOptionDTO{NameSnapshot: opt.NameSnapshot, PriceDeltaSnapshotVND: opt.PriceDeltaSnapshotVND, Quantity: opt.Quantity})
			}
			items = append(items, GuestOrderItemDTO{OrderItemID: item.ID, MenuItemID: item.MenuItemID, NameSnapshot: item.NameSnapshot, VariantNameSnapshot: item.VariantNameSnapshot, Quantity: item.Quantity, UnitPriceVND: item.UnitPriceVND, OptionsTotalVND: item.OptionsTotalVND, SubtotalVND: item.SubtotalVND, TotalAmountVND: item.TotalAmountVND, Status: item.Status, Station: item.Station, Options: options})
		}
		orders = append(orders, GuestOrderDTO{ID: order.ID, OrderNumber: order.OrderNumber, OrderType: order.OrderType, Status: order.Status, SubmittedAt: order.SubmittedAt, Note: order.Note, Items: items})
	}
	return GuestOrdersResponse{Orders: orders, SessionTotalVND: view.SessionTotalVND}, nil
}
