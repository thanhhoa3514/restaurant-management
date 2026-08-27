package application

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/catalog/domain"
	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/shared/apperr"
)

// ---- normalization / validation helpers ----

func normalizeComboCreate(req *CreateComboRequest) {
	req.Name = strings.TrimSpace(req.Name)
	req.Description = strings.TrimSpace(req.Description)
	req.ImageURL = strings.TrimSpace(req.ImageURL)
	req.Status = strings.ToUpper(strings.TrimSpace(req.Status))
	if req.Status == "" {
		req.Status = "DRAFT"
	}
	req.AvailabilityStatus = strings.ToUpper(strings.TrimSpace(req.AvailabilityStatus))
	if req.AvailabilityStatus == "" {
		req.AvailabilityStatus = "AVAILABLE"
	}
}

func normalizeComboUpdate(req *UpdateComboRequest) {
	req.Name = strings.TrimSpace(req.Name)
	req.Description = strings.TrimSpace(req.Description)
	req.ImageURL = strings.TrimSpace(req.ImageURL)
	req.Status = strings.ToUpper(strings.TrimSpace(req.Status))
	if req.Status == "" {
		req.Status = "DRAFT"
	}
	req.AvailabilityStatus = strings.ToUpper(strings.TrimSpace(req.AvailabilityStatus))
	if req.AvailabilityStatus == "" {
		req.AvailabilityStatus = "AVAILABLE"
	}
}

func validateComboFields(name string, price int64, status, availabilityStatus string, components []WriteComboComponentDTO, validFrom, validTo *time.Time) error {
	if name == "" {
		return apperr.New(apperr.CodeInvalid, "name is required")
	}
	if price < 0 {
		return apperr.New(apperr.CodeInvalid, "combo_price_vnd must be non-negative")
	}
	if !validPublishStatus(status) {
		return apperr.New(apperr.CodeInvalid, "invalid status")
	}
	if !validAvailabilityStatus(availabilityStatus) {
		return apperr.New(apperr.CodeInvalid, "invalid availability_status")
	}
	if len(components) == 0 {
		return apperr.New(apperr.CodeInvalid, "a combo must contain at least one component")
	}
	for _, c := range components {
		if c.MenuItemID == uuid.Nil {
			return apperr.New(apperr.CodeInvalid, "each combo component requires a menu_item_id")
		}
		if c.Quantity <= 0 {
			return apperr.New(apperr.CodeInvalid, "each combo component requires a positive quantity")
		}
	}
	if validFrom != nil && validTo != nil && validTo.Before(*validFrom) {
		return apperr.New(apperr.CodeInvalid, "valid_to must be on or after valid_from")
	}
	return nil
}

func comboCodeFor(id uuid.UUID) string {
	return "COMBO-" + strings.ToUpper(shortID(id))
}

func mapComboComponents(dtos []WriteComboComponentDTO) []domain.ComboComponentWrite {
	out := make([]domain.ComboComponentWrite, 0, len(dtos))
	for i, c := range dtos {
		disp := c.DisplayOrder
		if disp <= 0 {
			disp = i + 1
		}
		out = append(out, domain.ComboComponentWrite{
			MenuItemID:   c.MenuItemID,
			VariantID:    c.VariantID,
			Quantity:     c.Quantity,
			DisplayOrder: disp,
		})
	}
	return out
}

func buildComboCreate(req CreateComboRequest, id uuid.UUID) domain.ComboWrite {
	return domain.ComboWrite{
		ID:                 id,
		Code:               comboCodeFor(id),
		Name:               req.Name,
		Slug:               slugFor(req.Name, id),
		Description:        req.Description,
		ImageURL:           req.ImageURL,
		ComboPriceVND:      req.ComboPriceVND,
		Status:             req.Status,
		AvailabilityStatus: req.AvailabilityStatus,
		IsFeatured:         req.IsFeatured,
		ValidFrom:          req.ValidFrom,
		ValidTo:            req.ValidTo,
		DisplayOrder:       req.DisplayOrder,
		ActorID:            req.ActorID,
		Version:            1,
		Components:         mapComboComponents(req.Components),
	}
}

func buildComboUpdate(req UpdateComboRequest) domain.ComboWrite {
	return domain.ComboWrite{
		ID:                 req.ID,
		Name:               req.Name,
		Slug:               slugFor(req.Name, req.ID),
		Description:        req.Description,
		ImageURL:           req.ImageURL,
		ComboPriceVND:      req.ComboPriceVND,
		Status:             req.Status,
		AvailabilityStatus: req.AvailabilityStatus,
		IsFeatured:         req.IsFeatured,
		ValidFrom:          req.ValidFrom,
		ValidTo:            req.ValidTo,
		DisplayOrder:       req.DisplayOrder,
		ActorID:            req.ActorID,
		Version:            req.Version,
		Components:         mapComboComponents(req.Components),
	}
}

func comboAuditValues(combo domain.ComboForUpdate) map[string]any {
	return map[string]any{
		"id":                  combo.ID,
		"code":                combo.Code,
		"name":                combo.Name,
		"slug":                combo.Slug,
		"description":         combo.Description,
		"image_url":           combo.ImageURL,
		"combo_price_vnd":     combo.ComboPriceVND,
		"status":              combo.Status,
		"availability_status": combo.AvailabilityStatus,
		"is_featured":         combo.IsFeatured,
		"valid_from":          combo.ValidFrom,
		"valid_to":            combo.ValidTo,
		"display_order":       combo.DisplayOrder,
		"version":             combo.Version,
	}
}

func writeComboAudit(ctx context.Context, repo domain.ComboRepository, restaurantID uuid.UUID, meta CommandMetadata, action string, comboID uuid.UUID, oldValues, newValues any) error {
	return repo.WriteAuditLog(ctx, domain.AuditLogWrite{
		RestaurantID: restaurantID,
		UserID:       meta.ActorID,
		Action:       action,
		EntityType:   "combo",
		EntityID:     comboID,
		OldValues:    oldValues,
		NewValues:    newValues,
		Metadata:     auditMeta(meta, action),
		IPAddress:    meta.IPAddress,
		UserAgent:    meta.UserAgent,
		TraceID:      meta.TraceID,
	})
}

func writeComboEvent(ctx context.Context, writer domain.OutboxWriter, restaurantID uuid.UUID, meta CommandMetadata, action string, combo domain.ComboForUpdate) error {
	if writer == nil {
		return nil
	}
	return writer.Write(ctx, outbox.WriteEvent{
		RestaurantID:  restaurantID,
		AggregateType: "combo",
		AggregateID:   combo.ID,
		EventType:     action,
		Payload: map[string]any{
			"id":                  combo.ID,
			"status":              combo.Status,
			"availability_status": combo.AvailabilityStatus,
			"version":             combo.Version,
		},
		Metadata: map[string]any{
			"actor_type": "USER",
			"actor_id":   meta.ActorID,
			"action":     action,
			"user_agent": meta.UserAgent,
			"trace_id":   meta.TraceID,
		},
		Priority:         3,
		SuppressRealtime: true,
	})
}

func comboCommandResponse(combo domain.ComboForUpdate) ComboCommandResponse {
	return ComboCommandResponse{ID: combo.ID, Status: combo.Status, Version: combo.Version}
}

// ---- CreateCombo ----

type CreateCombo struct {
	tx                  TxRunner
	repo                domain.ComboRepository
	outbox              domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewCreateCombo(tx TxRunner, repo domain.ComboRepository, outbox domain.OutboxWriter, defaultRestaurantID uuid.UUID) *CreateCombo {
	return &CreateCombo{tx: tx, repo: repo, outbox: outbox, defaultRestaurantID: defaultRestaurantID}
}

func (s *CreateCombo) Handle(ctx context.Context, in CreateComboRequest) (ComboCommandResponse, error) {
	var out ComboCommandResponse
	normalizeComboCreate(&in)
	if err := validateCommandMetadata(in.CommandMetadata); err != nil {
		return out, err
	}
	if err := validateComboFields(in.Name, in.ComboPriceVND, in.Status, in.AvailabilityStatus, in.Components, in.ValidFrom, in.ValidTo); err != nil {
		return out, err
	}
	write := buildComboCreate(in, uuid.New())
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		if err := s.repo.ComponentsResolvable(ctx, s.defaultRestaurantID, write.Components); err != nil {
			return err
		}
		created, err := s.repo.CreateCombo(ctx, s.defaultRestaurantID, write)
		if err != nil {
			return err
		}
		if err := writeComboAudit(ctx, s.repo, s.defaultRestaurantID, in.CommandMetadata, "catalog.combo_created", created.ID, nil, comboAuditValues(created)); err != nil {
			return err
		}
		if err := writeComboEvent(ctx, s.outbox, s.defaultRestaurantID, in.CommandMetadata, "catalog.combo_created", created); err != nil {
			return err
		}
		out = comboCommandResponse(created)
		return nil
	})
	return out, err
}

// ---- UpdateCombo ----

type UpdateCombo struct {
	tx                  TxRunner
	repo                domain.ComboRepository
	outbox              domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewUpdateCombo(tx TxRunner, repo domain.ComboRepository, outbox domain.OutboxWriter, defaultRestaurantID uuid.UUID) *UpdateCombo {
	return &UpdateCombo{tx: tx, repo: repo, outbox: outbox, defaultRestaurantID: defaultRestaurantID}
}

func (s *UpdateCombo) Handle(ctx context.Context, in UpdateComboRequest) (ComboCommandResponse, error) {
	var out ComboCommandResponse
	normalizeComboUpdate(&in)
	if in.ID == uuid.Nil {
		return out, apperr.New(apperr.CodeInvalid, "id is required")
	}
	if in.Version <= 0 {
		return out, apperr.New(apperr.CodeInvalid, "version is required")
	}
	if err := validateCommandMetadata(in.CommandMetadata); err != nil {
		return out, err
	}
	if err := validateComboFields(in.Name, in.ComboPriceVND, in.Status, in.AvailabilityStatus, in.Components, in.ValidFrom, in.ValidTo); err != nil {
		return out, err
	}
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		if err := s.repo.ComponentsResolvable(ctx, s.defaultRestaurantID, mapComboComponents(in.Components)); err != nil {
			return err
		}
		oldCombo, err := s.repo.GetComboForUpdate(ctx, s.defaultRestaurantID, in.ID)
		if err != nil {
			return err
		}
		if oldCombo.Version != in.Version {
			return apperr.New(apperr.CodeConflict, "combo was modified, reload")
		}
		updated, err := s.repo.UpdateCombo(ctx, s.defaultRestaurantID, buildComboUpdate(in))
		if err != nil {
			return err
		}
		if err := writeComboAudit(ctx, s.repo, s.defaultRestaurantID, in.CommandMetadata, "catalog.combo_updated", updated.ID, comboAuditValues(*oldCombo), comboAuditValues(updated)); err != nil {
			return err
		}
		if err := writeComboEvent(ctx, s.outbox, s.defaultRestaurantID, in.CommandMetadata, "catalog.combo_updated", updated); err != nil {
			return err
		}
		out = comboCommandResponse(updated)
		return nil
	})
	return out, err
}

// ---- DeleteCombo ----

type DeleteCombo struct {
	tx                  TxRunner
	repo                domain.ComboRepository
	outbox              domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewDeleteCombo(tx TxRunner, repo domain.ComboRepository, outbox domain.OutboxWriter, defaultRestaurantID uuid.UUID) *DeleteCombo {
	return &DeleteCombo{tx: tx, repo: repo, outbox: outbox, defaultRestaurantID: defaultRestaurantID}
}

func (s *DeleteCombo) Handle(ctx context.Context, in DeleteComboRequest) (ComboCommandResponse, error) {
	var out ComboCommandResponse
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
		oldCombo, err := s.repo.GetComboForUpdate(ctx, s.defaultRestaurantID, in.ID)
		if err != nil {
			return err
		}
		if oldCombo.Version != in.Version {
			return apperr.New(apperr.CodeConflict, "combo was modified, reload")
		}
		deleted, err := s.repo.SoftDeleteCombo(ctx, s.defaultRestaurantID, in.ID, in.Version, in.ActorID)
		if err != nil {
			return err
		}
		oldValues := comboAuditValues(*oldCombo)
		oldValues["is_deleted"] = false
		newValues := comboAuditValues(deleted)
		newValues["is_deleted"] = true
		if err := writeComboAudit(ctx, s.repo, s.defaultRestaurantID, in.CommandMetadata, "catalog.combo_deleted", deleted.ID, oldValues, newValues); err != nil {
			return err
		}
		if err := writeComboEvent(ctx, s.outbox, s.defaultRestaurantID, in.CommandMetadata, "catalog.combo_deleted", deleted); err != nil {
			return err
		}
		out = comboCommandResponse(deleted)
		return nil
	})
	return out, err
}

// ---- ToggleComboAvailability ----

type ToggleComboAvailability struct {
	tx                  TxRunner
	repo                domain.ComboRepository
	outbox              domain.OutboxWriter
	defaultRestaurantID uuid.UUID
}

func NewToggleComboAvailability(tx TxRunner, repo domain.ComboRepository, outbox domain.OutboxWriter, defaultRestaurantID uuid.UUID) *ToggleComboAvailability {
	return &ToggleComboAvailability{tx: tx, repo: repo, outbox: outbox, defaultRestaurantID: defaultRestaurantID}
}

func (s *ToggleComboAvailability) Handle(ctx context.Context, in ToggleComboAvailabilityRequest) (ComboCommandResponse, error) {
	var out ComboCommandResponse
	if in.ID == uuid.Nil {
		return out, apperr.New(apperr.CodeInvalid, "id is required")
	}
	if in.Version <= 0 {
		return out, apperr.New(apperr.CodeInvalid, "version is required")
	}
	// Combos carry no is_available boolean; availability is a single status.
	// Resolve the target status from an explicit value, else derive it from the flag.
	var status string
	if in.AvailabilityStatus != nil {
		status = strings.ToUpper(strings.TrimSpace(*in.AvailabilityStatus))
	} else if in.IsAvailable {
		status = "AVAILABLE"
	} else {
		status = "OUT_OF_STOCK"
	}
	if !validAvailabilityStatus(status) {
		return out, apperr.New(apperr.CodeInvalid, "invalid availability_status")
	}
	if err := validateCommandMetadata(in.CommandMetadata); err != nil {
		return out, err
	}
	err := s.tx.Run(ctx, func(ctx context.Context) error {
		oldCombo, err := s.repo.GetComboForUpdate(ctx, s.defaultRestaurantID, in.ID)
		if err != nil {
			return err
		}
		if oldCombo.Version != in.Version {
			return apperr.New(apperr.CodeConflict, "combo was modified, reload")
		}
		updated, err := s.repo.ToggleComboAvailability(ctx, s.defaultRestaurantID, domain.ComboToggle{
			ID:                 in.ID,
			AvailabilityStatus: &status,
			ActorID:            in.ActorID,
			Version:            in.Version,
		})
		if err != nil {
			return err
		}
		if err := writeComboAudit(ctx, s.repo, s.defaultRestaurantID, in.CommandMetadata, "catalog.combo_availability_toggled", updated.ID, comboAuditValues(*oldCombo), comboAuditValues(updated)); err != nil {
			return err
		}
		if err := writeComboEvent(ctx, s.outbox, s.defaultRestaurantID, in.CommandMetadata, "catalog.combo_availability_toggled", updated); err != nil {
			return err
		}
		out = comboCommandResponse(updated)
		return nil
	})
	return out, err
}
