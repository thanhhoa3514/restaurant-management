package application

import (
	"context"
	"strings"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/catalog/domain"
	"restaurant-management/internal/platform/tenant"
	"restaurant-management/internal/shared/apperr"
)

type ToggleAvailability struct {
	tx     TxRunner
	repo   domain.MenuRepository
	outbox domain.OutboxWriter
}

func NewToggleAvailability(tx TxRunner, repo domain.MenuRepository, outbox domain.OutboxWriter) *ToggleAvailability {
	return &ToggleAvailability{tx: tx, repo: repo, outbox: outbox}
}
func (s *ToggleAvailability) Handle(ctx context.Context, in ToggleAvailabilityRequest) (MenuItemCommandResponse, error) {
	var out MenuItemCommandResponse
	if in.ID == uuid.Nil {
		return out, apperr.New(apperr.CodeInvalid, "id is required")
	}
	if in.Version <= 0 {
		return out, apperr.New(apperr.CodeInvalid, "version is required")
	}
	if in.AvailabilityStatus != nil {
		normalized := strings.ToUpper(strings.TrimSpace(*in.AvailabilityStatus))
		if !validAvailabilityStatus(normalized) {
			return out, apperr.New(apperr.CodeInvalid, "invalid availability_status")
		}
		in.AvailabilityStatus = &normalized
	}
	if err := validateCommandMetadata(in.CommandMetadata); err != nil {
		return out, err
	}
	restaurantID, err := tenant.MustRestaurantID(ctx)
	if err != nil {
		return out, err
	}
	err = s.tx.Run(ctx, func(ctx context.Context) error {
		oldItem, err := s.repo.GetItemForUpdate(ctx, restaurantID, in.ID)
		if err != nil {
			return err
		}
		if oldItem.Version != in.Version {
			return apperr.New(apperr.CodeConflict, "menu item was modified, reload")
		}
		updated, err := s.repo.ToggleAvailability(ctx, restaurantID, domain.MenuItemToggle{
			ID:                 in.ID,
			IsAvailable:        in.IsAvailable,
			AvailabilityStatus: in.AvailabilityStatus,
			ActorID:            in.ActorID,
			Version:            in.Version,
		})
		if err != nil {
			return err
		}
		if err := writeAudit(ctx, s.repo, restaurantID, in.CommandMetadata, "catalog.item_availability_toggled", updated.ID, itemAuditValues(*oldItem), itemAuditValues(updated)); err != nil {
			return err
		}
		if err := writeItemEvent(ctx, s.outbox, restaurantID, in.CommandMetadata, "catalog.item_availability_toggled", updated); err != nil {
			return err
		}
		out = commandResponse(updated)
		return nil
	})
	return out, err
}
