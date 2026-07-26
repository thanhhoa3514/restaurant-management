package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/billing/domain"
	"restaurant-management/internal/platform/guest"
	"restaurant-management/internal/shared/apperr"
)

type GuestCheckoutRepository interface {
	ListSessionInvoices(ctx context.Context, restaurantID, diningSessionID uuid.UUID) ([]*domain.Invoice, error)
	GuestSessionStatus(ctx context.Context, restaurantID, diningSessionID uuid.UUID) (string, error)
}

type GuestCheckoutResponse struct {
	SessionStatus string       `json:"session_status"`
	Invoices      []InvoiceDTO `json:"invoices"`
}

type GuestCheckout struct {
	repo                GuestCheckoutRepository
	defaultRestaurantID uuid.UUID
}

func NewGuestCheckout(repo GuestCheckoutRepository, defaultRestaurantID uuid.UUID) *GuestCheckout {
	return &GuestCheckout{repo: repo, defaultRestaurantID: defaultRestaurantID}
}

func (s *GuestCheckout) Handle(ctx context.Context) (GuestCheckoutResponse, error) {
	session, ok := guest.SessionFromContext(ctx)
	if !ok || session.SessionID == uuid.Nil {
		return GuestCheckoutResponse{}, apperr.New(apperr.CodeUnauthorized, "missing guest session")
	}
	restaurantID := session.RestaurantID
	if restaurantID == uuid.Nil {
		restaurantID = s.defaultRestaurantID
	}
	if restaurantID == uuid.Nil {
		return GuestCheckoutResponse{}, apperr.New(apperr.CodeUnauthorized, "missing guest restaurant")
	}

	sessionStatus, err := s.repo.GuestSessionStatus(ctx, restaurantID, session.SessionID)
	if err != nil {
		return GuestCheckoutResponse{}, err
	}

	invoices, err := s.repo.ListSessionInvoices(ctx, restaurantID, session.SessionID)
	if err != nil {
		return GuestCheckoutResponse{}, err
	}
	dtos := make([]InvoiceDTO, 0, len(invoices))
	for _, invoice := range invoices {
		dtos = append(dtos, toResponse(invoice).Invoice)
	}
	return GuestCheckoutResponse{SessionStatus: sessionStatus, Invoices: dtos}, nil
}
