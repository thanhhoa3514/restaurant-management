package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/catalog/domain"
	"restaurant-management/internal/platform/tenant"
	"restaurant-management/internal/shared/apperr"
)

type CreateMenuItem struct {
	tx     TxRunner
	repo   domain.MenuRepository
	outbox domain.OutboxWriter
}

func NewCreateMenuItem(tx TxRunner, repo domain.MenuRepository, outbox domain.OutboxWriter) *CreateMenuItem {
	return &CreateMenuItem{tx: tx, repo: repo, outbox: outbox}
}
func (s *CreateMenuItem) Handle(ctx context.Context, in CreateMenuItemRequest) (MenuItemCommandResponse, error) {
	var out MenuItemCommandResponse
	normalizeCreate(&in)
	if err := validateCommandMetadata(in.CommandMetadata); err != nil {
		return out, err
	}
	if err := validateMenuItemFields(in.CategoryID, in.Name, in.BasePriceVND, in.AvailabilityStatus, in.Status, in.Station); err != nil {
		return out, err
	}
	restaurantID, err := tenant.MustRestaurantID(ctx)
	if err != nil {
		return out, err
	}
	err = s.tx.Run(ctx, func(ctx context.Context) error {
		ok, err := s.repo.CategoryExists(ctx, restaurantID, in.CategoryID)
		if err != nil {
			return err
		}
		if !ok {
			return domainCategoryNotFound()
		}
		itemID := uuid.New()
		created, err := s.repo.CreateItem(ctx, restaurantID, buildWrite(in, itemID))
		if err != nil {
			return err
		}
		if err := writeAudit(ctx, s.repo, restaurantID, in.CommandMetadata, "catalog.item_created", created.ID, nil, itemAuditValues(created)); err != nil {
			return err
		}
		if err := writeItemEvent(ctx, s.outbox, restaurantID, in.CommandMetadata, "catalog.item_created", created); err != nil {
			return err
		}
		out = commandResponse(created)
		return nil
	})
	return out, err
}

func domainCategoryNotFound() error {
	return apperr.New(apperr.CodeNotFound, "category not found")
}
