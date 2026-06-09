package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/catalog/domain"
	"restaurant-management/internal/platform/tenant"
	"restaurant-management/internal/shared/apperr"
)

type UpdateMenuItem struct {
	tx     TxRunner
	repo   domain.MenuRepository
	outbox domain.OutboxWriter
}

func NewUpdateMenuItem(tx TxRunner, repo domain.MenuRepository, outbox domain.OutboxWriter) *UpdateMenuItem {
	return &UpdateMenuItem{tx: tx, repo: repo, outbox: outbox}
}
func (s *UpdateMenuItem) Handle(ctx context.Context, in UpdateMenuItemRequest) (MenuItemCommandResponse, error) {
	var out MenuItemCommandResponse
	normalizeUpdate(&in)
	if in.ID == uuid.Nil {
		return out, apperr.New(apperr.CodeInvalid, "id is required")
	}
	if in.Version <= 0 {
		return out, apperr.New(apperr.CodeInvalid, "version is required")
	}
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
		oldItem, err := s.repo.GetItemForUpdate(ctx, restaurantID, in.ID)
		if err != nil {
			return err
		}
		if oldItem.Version != in.Version {
			return apperr.New(apperr.CodeConflict, "menu item was modified, reload")
		}
		updated, err := s.repo.UpdateItem(ctx, restaurantID, buildUpdate(in))
		if err != nil {
			return err
		}
		if err := writeAudit(ctx, s.repo, restaurantID, in.CommandMetadata, "catalog.item_updated", updated.ID, itemAuditValues(*oldItem), itemAuditValues(updated)); err != nil {
			return err
		}
		if err := writeItemEvent(ctx, s.outbox, restaurantID, in.CommandMetadata, "catalog.item_updated", updated); err != nil {
			return err
		}
		out = commandResponse(updated)
		return nil
	})
	return out, err
}
