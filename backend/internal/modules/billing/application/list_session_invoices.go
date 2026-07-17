package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/billing/domain"
	"restaurant-management/internal/shared/apperr"
)

type ListSessionInvoicesResponse struct {
	Invoices []InvoiceDTO `json:"invoices"`
}

type ListSessionInvoices struct {
	repo                domain.InvoiceRepository
	defaultRestaurantID uuid.UUID
}

func NewListSessionInvoices(repo domain.InvoiceRepository, defaultRestaurantID uuid.UUID) *ListSessionInvoices {
	return &ListSessionInvoices{repo: repo, defaultRestaurantID: defaultRestaurantID}
}

func (s *ListSessionInvoices) Handle(ctx context.Context, diningSessionID uuid.UUID) (ListSessionInvoicesResponse, error) {
	if diningSessionID == uuidNil {
		return ListSessionInvoicesResponse{}, apperr.New(apperr.CodeInvalid, "dining_session_id is required")
	}
	invoices, err := s.repo.ListSessionInvoices(ctx, s.defaultRestaurantID, diningSessionID)
	if err != nil {
		return ListSessionInvoicesResponse{}, err
	}
	dtos := make([]InvoiceDTO, 0, len(invoices))
	for _, inv := range invoices {
		dtos = append(dtos, toResponse(inv).Invoice)
	}
	return ListSessionInvoicesResponse{Invoices: dtos}, nil
}
