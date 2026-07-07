package application

import (
	"context"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/catalog/domain"
	"restaurant-management/internal/shared/apperr"
)

type DeleteMenuItem struct {
	tx                 TxRunner
	repo               domain.MenuRepository
	outbox             domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewDeleteMenuItem(tx TxRunner, repo domain.MenuRepository, outbox domain.OutboxWriter, defaultRestaurantID uuid.UUID) *DeleteMenuItem {
	return &DeleteMenuItem{tx: tx, repo: repo, outbox: outbox, defaultRestaurantID: defaultRestaurantID}
}
func (s *DeleteMenuItem) Handle(ctx context.Context, in DeleteMenuItemRequest) (MenuItemCommandResponse, error) {
	var out MenuItemCommandResponse
	if in.ID == uuid.Nil {
		return out, apperr.New(apperr.CodeInvalid, "id is required")
	}
	if in.Version <= 0 {
		return out, apperr.New(apperr.CodeInvalid, "version is required")
	}
	if err := validateCommandMetadata(in.CommandMetadata); err != nil {
		return out, err
	}
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		oldItem, err := s.repo.GetItemForUpdate(ctx, s.defaultRestaurantID, in.ID)
		if err != nil {
			return err
		}
		if oldItem.Version != in.Version {
			return apperr.New(apperr.CodeConflict, "menu item was modified, reload")
		}
		deleted, err := s.repo.SoftDeleteItem(ctx, s.defaultRestaurantID, in.ID, in.Version, in.ActorID)
		if err != nil {
			return err
		}
		oldValues := itemAuditValues(*oldItem)
		oldValues["is_deleted"] = false
		newValues := itemAuditValues(deleted)
		newValues["is_deleted"] = true
		if err := writeAudit(ctx, s.repo, s.defaultRestaurantID, in.CommandMetadata, "catalog.item_deleted", deleted.ID, oldValues, newValues); err != nil {
			return err
		}
		if err := writeItemEvent(ctx, s.outbox, s.defaultRestaurantID, in.CommandMetadata, "catalog.item_deleted", deleted); err != nil {
			return err
		}
		out = commandResponse(deleted)
		return nil
	})
	return out, err
}
