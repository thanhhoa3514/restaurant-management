package application

import (
	"context"
	"regexp"
	"strings"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/catalog/domain"
	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/shared/apperr"
)

var nonSlugChars = regexp.MustCompile(`[^a-z0-9]+`)

func normalizeCreate(req *CreateMenuItemRequest) {
	req.Name = strings.TrimSpace(req.Name)
	req.Description = strings.TrimSpace(req.Description)
	req.ShortDescription = strings.TrimSpace(req.ShortDescription)
	req.ImageURL = strings.TrimSpace(req.ImageURL)
	req.AvailabilityStatus = strings.ToUpper(strings.TrimSpace(req.AvailabilityStatus))
	if req.AvailabilityStatus == "" {
		req.AvailabilityStatus = "AVAILABLE"
	}
	req.Status = strings.ToUpper(strings.TrimSpace(req.Status))
	if req.Status == "" {
		req.Status = "PUBLISHED"
	}
	req.Station = strings.ToUpper(strings.TrimSpace(req.Station))
}

func normalizeUpdate(req *UpdateMenuItemRequest) {
	req.Name = strings.TrimSpace(req.Name)
	req.Description = strings.TrimSpace(req.Description)
	req.ShortDescription = strings.TrimSpace(req.ShortDescription)
	req.ImageURL = strings.TrimSpace(req.ImageURL)
	// Update is full-replace (PUT semantics), so mirror create's defaulting:
	// an omitted status/availability falls back to the same defaults instead of
	// failing validation, keeping the two command paths consistent.
	req.AvailabilityStatus = strings.ToUpper(strings.TrimSpace(req.AvailabilityStatus))
	if req.AvailabilityStatus == "" {
		req.AvailabilityStatus = "AVAILABLE"
	}
	req.Status = strings.ToUpper(strings.TrimSpace(req.Status))
	if req.Status == "" {
		req.Status = "PUBLISHED"
	}
	req.Station = strings.ToUpper(strings.TrimSpace(req.Station))
}

func validateMenuItemFields(categoryID uuid.UUID, name string, price int64, availabilityStatus, status, station string) error {
	if categoryID == uuid.Nil {
		return apperr.New(apperr.CodeInvalid, "category_id is required")
	}
	if strings.TrimSpace(name) == "" {
		return apperr.New(apperr.CodeInvalid, "name is required")
	}
	if price < 0 {
		return apperr.New(apperr.CodeInvalid, "base_price_vnd must be non-negative")
	}
	if !validAvailabilityStatus(availabilityStatus) {
		return apperr.New(apperr.CodeInvalid, "invalid availability_status")
	}
	if !validPublishStatus(status) {
		return apperr.New(apperr.CodeInvalid, "invalid status")
	}
	if station != "" && !validStation(station) {
		return apperr.New(apperr.CodeInvalid, "invalid station")
	}
	return nil
}

func validateCommandMetadata(meta CommandMetadata) error {
	if meta.ActorID == uuid.Nil {
		return apperr.New(apperr.CodeUnauthorized, "invalid user claim")
	}
	return nil
}

func validPublishStatus(v string) bool {
	switch v {
	case "DRAFT", "PUBLISHED", "ARCHIVED":
		return true
	default:
		return false
	}
}

func validAvailabilityStatus(v string) bool {
	switch v {
	case "AVAILABLE", "OUT_OF_STOCK", "TEMPORARILY_UNAVAILABLE", "HIDDEN":
		return true
	default:
		return false
	}
}

func validStation(v string) bool {
	switch v {
	case "HOTPOT", "GRILL", "NOODLE", "DRINK", "DESSERT", "GENERAL":
		return true
	default:
		return false
	}
}

func slugFor(name string, id uuid.UUID) string {
	base := strings.ToLower(strings.TrimSpace(name))
	base = nonSlugChars.ReplaceAllString(base, "-")
	base = strings.Trim(base, "-")
	if base == "" {
		base = "item"
	}
	return base + "-" + shortID(id)
}

func codeFor(id uuid.UUID) string {
	return "MI-" + strings.ToUpper(shortID(id))
}

func shortID(id uuid.UUID) string {
	return strings.ReplaceAll(id.String(), "-", "")[:8]
}

func buildWrite(req CreateMenuItemRequest, id uuid.UUID) domain.MenuItemWrite {
	return domain.MenuItemWrite{
		ID:                 id,
		CategoryID:         req.CategoryID,
		Code:               codeFor(id),
		Name:               req.Name,
		Slug:               slugFor(req.Name, id),
		Description:        req.Description,
		ShortDescription:   req.ShortDescription,
		BasePriceVND:       req.BasePriceVND,
		ImageURL:           req.ImageURL,
		IsAvailable:        req.IsAvailable,
		AvailabilityStatus: req.AvailabilityStatus,
		Status:             req.Status,
		IsFeatured:         req.IsFeatured,
		IsSpicy:            req.IsSpicy,
		Station:            req.Station,
		DisplayOrder:       req.DisplayOrder,
		ActorID:            req.ActorID,
		Version:            1,
	}
}

func buildUpdate(req UpdateMenuItemRequest) domain.MenuItemWrite {
	return domain.MenuItemWrite{
		ID:                 req.ID,
		CategoryID:         req.CategoryID,
		Name:               req.Name,
		Slug:               slugFor(req.Name, req.ID),
		Description:        req.Description,
		ShortDescription:   req.ShortDescription,
		BasePriceVND:       req.BasePriceVND,
		ImageURL:           req.ImageURL,
		IsAvailable:        req.IsAvailable,
		AvailabilityStatus: req.AvailabilityStatus,
		Status:             req.Status,
		IsFeatured:         req.IsFeatured,
		IsSpicy:            req.IsSpicy,
		Station:            req.Station,
		DisplayOrder:       req.DisplayOrder,
		ActorID:            req.ActorID,
		Version:            req.Version,
	}
}

func itemAuditValues(item domain.MenuItemForUpdate) map[string]any {
	return map[string]any{
		"id":                  item.ID,
		"category_id":         item.CategoryID,
		"code":                item.Code,
		"name":                item.Name,
		"slug":                item.Slug,
		"description":         item.Description,
		"short_description":   item.ShortDescription,
		"base_price_vnd":      item.BasePriceVND,
		"image_url":           item.ImageURL,
		"is_available":        item.IsAvailable,
		"availability_status": item.AvailabilityStatus,
		"status":              item.Status,
		"is_featured":         item.IsFeatured,
		"is_spicy":            item.IsSpicy,
		"station":             item.Station,
		"display_order":       item.DisplayOrder,
		"version":             item.Version,
	}
}

func auditMeta(meta CommandMetadata, action string) map[string]any {
	return map[string]any{
		"actor_id": meta.ActorID,
		"action":   action,
	}
}

func writeAudit(ctx context.Context, repo domain.MenuRepository, restaurantID uuid.UUID, meta CommandMetadata, action string, itemID uuid.UUID, oldValues, newValues any) error {
	return repo.WriteAuditLog(ctx, domain.AuditLogWrite{
		RestaurantID: restaurantID,
		UserID:       meta.ActorID,
		Action:       action,
		EntityType:   "menu_item",
		EntityID:     itemID,
		OldValues:    oldValues,
		NewValues:    newValues,
		Metadata:     auditMeta(meta, action),
		IPAddress:    meta.IPAddress,
		UserAgent:    meta.UserAgent,
		TraceID:      meta.TraceID,
	})
}

func writeItemEvent(ctx context.Context, writer domain.OutboxWriter, restaurantID uuid.UUID, meta CommandMetadata, action string, item domain.MenuItemForUpdate) error {
	if writer == nil {
		return nil
	}
	return writer.Write(ctx, outbox.WriteEvent{
		RestaurantID:  restaurantID,
		AggregateType: "menu_item",
		AggregateID:   item.ID,
		EventType:     action,
		Payload: map[string]any{
			"id":                  item.ID,
			"category_id":         item.CategoryID,
			"status":              item.Status,
			"is_available":        item.IsAvailable,
			"availability_status": item.AvailabilityStatus,
			"version":             item.Version,
		},
		Metadata: map[string]any{
			// USER matches the audit_logs.actor_type taxonomy (USER|GUEST|SYSTEM);
			// guest-driven events use GUEST.
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

func commandResponse(item domain.MenuItemForUpdate) MenuItemCommandResponse {
	return MenuItemCommandResponse{ID: item.ID, Status: item.Status, Version: item.Version}
}
