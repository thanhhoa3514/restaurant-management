package postgres

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"restaurant-management/internal/modules/catalog/domain"
	pg "restaurant-management/internal/platform/postgres"
	"restaurant-management/internal/shared/apperr"
)

// ComboRepository implements both domain.ComboRepository (writes + audit) and
// domain.ComboReadRepository (guest + admin reads). Combos are catalog content;
// the ordering-time fan-out lives in the ordering module.
type ComboRepository struct {
	pool       *pgxpool.Pool
	defaultRID uuid.UUID
}

func NewComboRepository(pool *pgxpool.Pool, defaultRID uuid.UUID) *ComboRepository {
	return &ComboRepository{pool: pool, defaultRID: defaultRID}
}

func (r *ComboRepository) q(ctx context.Context) pg.Querier { return pg.QuerierFromContext(ctx, r.pool) }

// ---- write side ----

func (r *ComboRepository) ComponentsResolvable(ctx context.Context, restaurantID uuid.UUID, components []domain.ComboComponentWrite) error {
	for _, c := range components {
		var ok bool
		if c.VariantID != nil {
			// Variant must belong to the referenced menu item, and both must be live.
			if err := r.q(ctx).QueryRow(ctx, `
				SELECT EXISTS (
					SELECT 1
					FROM menu_item_variants v
					JOIN menu_items mi ON mi.id = v.menu_item_id
					WHERE v.id = $1
					  AND v.menu_item_id = $2
					  AND v.restaurant_id = $3
					  AND v.deleted_at IS NULL
					  AND mi.deleted_at IS NULL
				)
			`, *c.VariantID, c.MenuItemID, restaurantID).Scan(&ok); err != nil {
				return err
			}
		} else {
			if err := r.q(ctx).QueryRow(ctx, `
				SELECT EXISTS (
					SELECT 1 FROM menu_items
					WHERE id = $1 AND restaurant_id = $2 AND deleted_at IS NULL
				)
			`, c.MenuItemID, restaurantID).Scan(&ok); err != nil {
				return err
			}
		}
		if !ok {
			return apperr.New(apperr.CodeInvalid, "combo references a menu item or variant that does not exist")
		}
	}
	return nil
}

func (r *ComboRepository) GetComboForUpdate(ctx context.Context, restaurantID, comboID uuid.UUID) (*domain.ComboForUpdate, error) {
	out := &domain.ComboForUpdate{}
	err := r.q(ctx).QueryRow(ctx, comboForUpdateSQL(`
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
		FOR UPDATE
	`), restaurantID, comboID).Scan(scanComboForUpdate(out)...)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "combo not found")
	}
	if err != nil {
		return nil, err
	}
	return out, nil
}

func (r *ComboRepository) CreateCombo(ctx context.Context, restaurantID uuid.UUID, combo domain.ComboWrite) (domain.ComboForUpdate, error) {
	var out domain.ComboForUpdate
	err := r.q(ctx).QueryRow(ctx, `
		INSERT INTO combos (
			id, restaurant_id, code, name, slug, description, image_url,
			combo_price_vnd, status, availability_status, is_featured,
			valid_from, valid_to, display_order, created_by, updated_by, version
		)
		VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), NULLIF($7, ''),
		        $8, $9, $10, $11, $12, $13, $14, $15, $15, 1)
		RETURNING id, restaurant_id, code, name, slug, COALESCE(description, ''),
		          COALESCE(image_url, ''), combo_price_vnd, status, availability_status,
		          is_featured, valid_from, valid_to, display_order, version
	`, combo.ID, restaurantID, combo.Code, combo.Name, combo.Slug, combo.Description, combo.ImageURL,
		combo.ComboPriceVND, combo.Status, combo.AvailabilityStatus, combo.IsFeatured,
		combo.ValidFrom, combo.ValidTo, combo.DisplayOrder, combo.ActorID).Scan(scanComboForUpdate(&out)...)
	if pg.IsUniqueViolation(err) {
		return out, apperr.New(apperr.CodeConflict, "combo code or slug already exists")
	}
	if err != nil {
		return out, err
	}
	if err := r.saveComboItems(ctx, restaurantID, combo.ID, combo.Components); err != nil {
		return out, err
	}
	return out, nil
}

func (r *ComboRepository) UpdateCombo(ctx context.Context, restaurantID uuid.UUID, combo domain.ComboWrite) (domain.ComboForUpdate, error) {
	var out domain.ComboForUpdate
	err := r.q(ctx).QueryRow(ctx, `
		UPDATE combos
		SET name = $3,
		    slug = $4,
		    description = NULLIF($5, ''),
		    image_url = NULLIF($6, ''),
		    combo_price_vnd = $7,
		    status = $8,
		    availability_status = $9,
		    is_featured = $10,
		    valid_from = $11,
		    valid_to = $12,
		    display_order = $13,
		    updated_by = $14,
		    version = version + 1,
		    updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND version = $15 AND deleted_at IS NULL
		RETURNING id, restaurant_id, code, name, slug, COALESCE(description, ''),
		          COALESCE(image_url, ''), combo_price_vnd, status, availability_status,
		          is_featured, valid_from, valid_to, display_order, version
	`, restaurantID, combo.ID, combo.Name, combo.Slug, combo.Description, combo.ImageURL,
		combo.ComboPriceVND, combo.Status, combo.AvailabilityStatus, combo.IsFeatured,
		combo.ValidFrom, combo.ValidTo, combo.DisplayOrder, combo.ActorID, combo.Version).Scan(scanComboForUpdate(&out)...)
	if errors.Is(err, pgx.ErrNoRows) {
		return out, apperr.New(apperr.CodeConflict, "combo was modified, reload")
	}
	if pg.IsUniqueViolation(err) {
		return out, apperr.New(apperr.CodeConflict, "combo slug already exists")
	}
	if err != nil {
		return out, err
	}
	if err := r.saveComboItems(ctx, restaurantID, combo.ID, combo.Components); err != nil {
		return out, err
	}
	return out, nil
}

// saveComboItems replaces the combo's component set (DELETE-then-INSERT).
// combo_items has no soft-delete column; a hard delete is correct here because
// order snapshots live on order_items, not on the combo definition.
func (r *ComboRepository) saveComboItems(ctx context.Context, restaurantID, comboID uuid.UUID, components []domain.ComboComponentWrite) error {
	if _, err := r.q(ctx).Exec(ctx, `DELETE FROM combo_items WHERE restaurant_id = $1 AND combo_id = $2`, restaurantID, comboID); err != nil {
		return err
	}
	for i, c := range components {
		disp := c.DisplayOrder
		if disp <= 0 {
			disp = i + 1
		}
		qty := c.Quantity
		if qty <= 0 {
			qty = 1
		}
		if _, err := r.q(ctx).Exec(ctx, `
			INSERT INTO combo_items (
				id, restaurant_id, combo_id, menu_item_id, menu_item_variant_id, quantity, display_order
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, uuid.New(), restaurantID, comboID, c.MenuItemID, c.VariantID, qty, disp); err != nil {
			return err
		}
	}
	return nil
}

func (r *ComboRepository) SoftDeleteCombo(ctx context.Context, restaurantID, comboID uuid.UUID, version int, actorID uuid.UUID) (domain.ComboForUpdate, error) {
	var out domain.ComboForUpdate
	err := r.q(ctx).QueryRow(ctx, `
		UPDATE combos
		SET deleted_at = NOW(),
		    updated_by = $4,
		    version = version + 1,
		    updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND version = $3 AND deleted_at IS NULL
		RETURNING id, restaurant_id, code, name, slug, COALESCE(description, ''),
		          COALESCE(image_url, ''), combo_price_vnd, status, availability_status,
		          is_featured, valid_from, valid_to, display_order, version
	`, restaurantID, comboID, version, actorID).Scan(scanComboForUpdate(&out)...)
	if errors.Is(err, pgx.ErrNoRows) {
		return out, apperr.New(apperr.CodeConflict, "combo was modified, reload")
	}
	return out, err
}

func (r *ComboRepository) ToggleComboAvailability(ctx context.Context, restaurantID uuid.UUID, toggle domain.ComboToggle) (domain.ComboForUpdate, error) {
	var out domain.ComboForUpdate
	err := r.q(ctx).QueryRow(ctx, `
		UPDATE combos
		SET availability_status = COALESCE($3, availability_status),
		    updated_by = $4,
		    version = version + 1,
		    updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND version = $5 AND deleted_at IS NULL
		RETURNING id, restaurant_id, code, name, slug, COALESCE(description, ''),
		          COALESCE(image_url, ''), combo_price_vnd, status, availability_status,
		          is_featured, valid_from, valid_to, display_order, version
	`, restaurantID, toggle.ID, toggle.AvailabilityStatus, toggle.ActorID, toggle.Version).Scan(scanComboForUpdate(&out)...)
	if errors.Is(err, pgx.ErrNoRows) {
		return out, apperr.New(apperr.CodeConflict, "combo was modified, reload")
	}
	return out, err
}

func (r *ComboRepository) WriteAuditLog(ctx context.Context, audit domain.AuditLogWrite) error {
	oldValues, err := json.Marshal(audit.OldValues)
	if err != nil {
		return err
	}
	newValues, err := json.Marshal(audit.NewValues)
	if err != nil {
		return err
	}
	metadata, err := json.Marshal(audit.Metadata)
	if err != nil {
		return err
	}
	_, err = r.q(ctx).Exec(ctx, `
		INSERT INTO audit_logs (
			restaurant_id, user_id, actor_type, action, entity_type, entity_id,
			old_values, new_values, metadata, ip_address, user_agent, trace_id
		)
		VALUES ($1, $2, 'USER', $3, $4, $5, $6, $7, $8, NULLIF($9, ''), NULLIF($10, ''), NULLIF($11, ''))
	`, audit.RestaurantID, audit.UserID, audit.Action, audit.EntityType, audit.EntityID, oldValues, newValues, metadata, audit.IPAddress, audit.UserAgent, audit.TraceID)
	return err
}

func comboForUpdateSQL(suffix string) string {
	return `
		SELECT id, restaurant_id, code, name, slug, COALESCE(description, ''),
		       COALESCE(image_url, ''), combo_price_vnd, status, availability_status,
		       is_featured, valid_from, valid_to, display_order, version
		FROM combos
	` + suffix
}

func scanComboForUpdate(c *domain.ComboForUpdate) []any {
	return []any{
		&c.ID,
		&c.RestaurantID,
		&c.Code,
		&c.Name,
		&c.Slug,
		&c.Description,
		&c.ImageURL,
		&c.ComboPriceVND,
		&c.Status,
		&c.AvailabilityStatus,
		&c.IsFeatured,
		&c.ValidFrom,
		&c.ValidTo,
		&c.DisplayOrder,
		&c.Version,
	}
}

// ---- read side ----

// comboReferenceSubquery sums each component's current à-la-carte price
// (pinned variant price when set, else the menu item base price) × quantity.
// SUM over an empty set is NULL → COALESCE-d to 0 by callers; combo definitions
// are validated non-empty at write time so 0 only appears for orphaned rows.
const comboReferenceSubquery = `
	LEFT JOIN LATERAL (
		SELECT SUM(COALESCE(v.price_vnd, mi.base_price_vnd) * ci.quantity) AS reference_price_vnd,
		       COUNT(*) AS component_count
		FROM combo_items ci
		JOIN menu_items mi ON mi.id = ci.menu_item_id AND mi.deleted_at IS NULL
		LEFT JOIN menu_item_variants v ON v.id = ci.menu_item_variant_id AND v.deleted_at IS NULL
		WHERE ci.combo_id = c.id AND ci.restaurant_id = c.restaurant_id
	) ref ON TRUE`

func savings(referencePrice, comboPrice int64) int64 {
	if referencePrice > comboPrice {
		return referencePrice - comboPrice
	}
	return 0
}

// guestComboPredicate: PUBLISHED, AVAILABLE, within the validity window, live.
// Used identically by ListCombos and GetCombo so a deep link cannot bypass it.
const guestComboPredicate = `
	AND c.status = 'PUBLISHED'
	AND c.availability_status = 'AVAILABLE'
	AND c.deleted_at IS NULL
	AND (c.valid_from IS NULL OR c.valid_from <= NOW())
	AND (c.valid_to IS NULL OR c.valid_to >= NOW())`

func (r *ComboRepository) ListCombos(ctx context.Context, restaurantID uuid.UUID) ([]domain.ComboSummary, error) {
	rows, err := r.q(ctx).Query(ctx, `
		SELECT c.id, c.code, c.name, c.slug, COALESCE(c.description, ''), COALESCE(c.image_url, ''),
		       c.combo_price_vnd, c.is_featured, c.availability_status,
		       COALESCE(ref.reference_price_vnd, 0)
		FROM combos c`+comboReferenceSubquery+`
		WHERE c.restaurant_id = $1`+guestComboPredicate+`
		ORDER BY c.display_order, c.name
	`, restaurantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []domain.ComboSummary{}
	for rows.Next() {
		var row domain.ComboSummary
		if err := rows.Scan(&row.ID, &row.Code, &row.Name, &row.Slug, &row.Description, &row.ImageURL,
			&row.ComboPriceVND, &row.IsFeatured, &row.AvailabilityStatus, &row.ReferencePriceVND); err != nil {
			return nil, err
		}
		row.SavingsVND = savings(row.ReferencePriceVND, row.ComboPriceVND)
		row.IsAvailable = row.AvailabilityStatus == "AVAILABLE"
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *ComboRepository) GetCombo(ctx context.Context, restaurantID, comboID uuid.UUID) (*domain.ComboDetail, error) {
	detail := &domain.ComboDetail{}
	err := r.q(ctx).QueryRow(ctx, `
		SELECT c.id, c.code, c.name, c.slug, COALESCE(c.description, ''), COALESCE(c.image_url, ''),
		       c.combo_price_vnd, c.is_featured, c.availability_status,
		       COALESCE(ref.reference_price_vnd, 0)
		FROM combos c`+comboReferenceSubquery+`
		WHERE c.restaurant_id = $1 AND c.id = $2`+guestComboPredicate, restaurantID, comboID).
		Scan(&detail.ID, &detail.Code, &detail.Name, &detail.Slug, &detail.Description, &detail.ImageURL,
			&detail.ComboPriceVND, &detail.IsFeatured, &detail.AvailabilityStatus, &detail.ReferencePriceVND)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "combo not found")
	}
	if err != nil {
		return nil, err
	}
	detail.SavingsVND = savings(detail.ReferencePriceVND, detail.ComboPriceVND)
	detail.IsAvailable = detail.AvailabilityStatus == "AVAILABLE"

	components, err := r.listComboComponents(ctx, restaurantID, comboID)
	if err != nil {
		return nil, err
	}
	detail.Components = components
	return detail, nil
}

func (r *ComboRepository) listComboComponents(ctx context.Context, restaurantID, comboID uuid.UUID) ([]domain.ComboComponentRead, error) {
	rows, err := r.q(ctx).Query(ctx, `
		SELECT ci.menu_item_id, ci.menu_item_variant_id, mi.name, COALESCE(v.name, ''),
		       COALESCE(mi.image_url, ''), ci.quantity, ci.display_order,
		       COALESCE(mi.station, ''), COALESCE(v.price_vnd, mi.base_price_vnd)
		FROM combo_items ci
		JOIN menu_items mi ON mi.id = ci.menu_item_id
		LEFT JOIN menu_item_variants v ON v.id = ci.menu_item_variant_id
		WHERE ci.restaurant_id = $1 AND ci.combo_id = $2
		ORDER BY ci.display_order, mi.name
	`, restaurantID, comboID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []domain.ComboComponentRead{}
	for rows.Next() {
		var row domain.ComboComponentRead
		var variantID uuid.NullUUID
		if err := rows.Scan(&row.MenuItemID, &variantID, &row.Name, &row.VariantName,
			&row.ImageURL, &row.Quantity, &row.DisplayOrder, &row.Station, &row.UnitPriceVND); err != nil {
			return nil, err
		}
		if variantID.Valid {
			id := variantID.UUID
			row.VariantID = &id
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *ComboRepository) ListCombosAdmin(ctx context.Context, restaurantID uuid.UUID, limit, offset int) ([]domain.ComboAdminSummary, domain.ComboStats, error) {
	var stats domain.ComboStats
	if err := r.q(ctx).QueryRow(ctx, `
		SELECT COUNT(*),
		       COUNT(*) FILTER (WHERE status = 'PUBLISHED' AND availability_status <> 'HIDDEN'),
		       COUNT(*) FILTER (WHERE availability_status <> 'AVAILABLE')
		FROM combos
		WHERE restaurant_id = $1 AND deleted_at IS NULL
	`, restaurantID).Scan(&stats.Total, &stats.Published, &stats.Unavailable); err != nil {
		return nil, domain.ComboStats{}, err
	}

	rows, err := r.q(ctx).Query(ctx, `
		SELECT c.id, c.code, c.name, c.slug, COALESCE(c.image_url, ''),
		       c.combo_price_vnd, COALESCE(ref.reference_price_vnd, 0),
		       c.status, c.availability_status, c.is_featured,
		       c.valid_from, c.valid_to, c.display_order,
		       COALESCE(ref.component_count, 0), c.version
		FROM combos c`+comboReferenceSubquery+`
		WHERE c.restaurant_id = $1 AND c.deleted_at IS NULL
		ORDER BY c.display_order, c.name
		LIMIT $2 OFFSET $3
	`, restaurantID, limit, offset)
	if err != nil {
		return nil, domain.ComboStats{}, err
	}
	defer rows.Close()

	out := []domain.ComboAdminSummary{}
	for rows.Next() {
		var row domain.ComboAdminSummary
		if err := rows.Scan(&row.ID, &row.Code, &row.Name, &row.Slug, &row.ImageURL,
			&row.ComboPriceVND, &row.ReferencePriceVND, &row.Status, &row.AvailabilityStatus,
			&row.IsFeatured, &row.ValidFrom, &row.ValidTo, &row.DisplayOrder,
			&row.ComponentCount, &row.Version); err != nil {
			return nil, domain.ComboStats{}, err
		}
		row.SavingsVND = savings(row.ReferencePriceVND, row.ComboPriceVND)
		row.IsAvailable = row.AvailabilityStatus == "AVAILABLE"
		out = append(out, row)
	}
	return out, stats, rows.Err()
}

func (r *ComboRepository) GetComboAdmin(ctx context.Context, restaurantID, comboID uuid.UUID) (*domain.ComboAdminDetail, error) {
	detail := &domain.ComboAdminDetail{}
	err := r.q(ctx).QueryRow(ctx, `
		SELECT c.id, c.code, c.name, c.slug, COALESCE(c.image_url, ''),
		       c.combo_price_vnd, COALESCE(ref.reference_price_vnd, 0),
		       c.status, c.availability_status, c.is_featured,
		       c.valid_from, c.valid_to, c.display_order,
		       COALESCE(ref.component_count, 0), c.version, COALESCE(c.description, '')
		FROM combos c`+comboReferenceSubquery+`
		WHERE c.restaurant_id = $1 AND c.id = $2 AND c.deleted_at IS NULL
	`, restaurantID, comboID).Scan(&detail.ID, &detail.Code, &detail.Name, &detail.Slug, &detail.ImageURL,
		&detail.ComboPriceVND, &detail.ReferencePriceVND, &detail.Status, &detail.AvailabilityStatus,
		&detail.IsFeatured, &detail.ValidFrom, &detail.ValidTo, &detail.DisplayOrder,
		&detail.ComponentCount, &detail.Version, &detail.Description)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "combo not found")
	}
	if err != nil {
		return nil, err
	}
	detail.SavingsVND = savings(detail.ReferencePriceVND, detail.ComboPriceVND)
	detail.IsAvailable = detail.AvailabilityStatus == "AVAILABLE"

	components, err := r.listComboComponents(ctx, restaurantID, comboID)
	if err != nil {
		return nil, err
	}
	detail.Components = components
	return detail, nil
}
