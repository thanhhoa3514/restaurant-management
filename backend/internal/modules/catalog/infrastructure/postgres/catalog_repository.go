package postgres

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"restaurant-management/internal/modules/catalog/domain"
	pg "restaurant-management/internal/platform/postgres"
	"restaurant-management/internal/shared/apperr"
)

type Repository struct{ pool *pgxpool.Pool }

func NewRepository(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool} }

func (r *Repository) q(ctx context.Context) pg.Querier { return pg.QuerierFromContext(ctx, r.pool) }

func (r *Repository) Save(ctx context.Context, aggregate *domain.MenuItem) error {
	_ = ctx
	_ = aggregate
	_ = r.pool
	return apperr.ErrNotImplemented
}
func (r *Repository) Get(ctx context.Context, restaurantID uuid.UUID, id uuid.UUID) (*domain.MenuItem, error) {
	_ = ctx
	_ = restaurantID
	_ = id
	_ = r.pool
	return nil, apperr.ErrNotImplemented
}

func (r *Repository) CategoryExists(ctx context.Context, restaurantID, categoryID uuid.UUID) (bool, error) {
	var exists bool
	err := r.q(ctx).QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM categories
			WHERE restaurant_id = $1 AND id = $2 AND is_active = TRUE AND deleted_at IS NULL
		)
	`, restaurantID, categoryID).Scan(&exists)
	return exists, err
}

func (r *Repository) ListCategories(ctx context.Context, restaurantID uuid.UUID) ([]domain.CategoryRead, error) {
	rows, err := r.q(ctx).Query(ctx, `
		SELECT id, name, slug, COALESCE(description, ''), COALESCE(image_url, ''), COALESCE(icon, ''), display_order
		FROM categories
		WHERE restaurant_id = $1 AND is_active = TRUE AND deleted_at IS NULL
		ORDER BY display_order, name
	`, restaurantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []domain.CategoryRead{}
	for rows.Next() {
		var row domain.CategoryRead
		if err := rows.Scan(&row.ID, &row.Name, &row.Slug, &row.Description, &row.ImageURL, &row.Icon, &row.DisplayOrder); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *Repository) ListItems(ctx context.Context, restaurantID uuid.UUID, categoryID *uuid.UUID) ([]domain.MenuItemSummary, error) {
	query := `
		SELECT mi.id, mi.category_id, mi.name, mi.slug, COALESCE(mi.short_description, ''), COALESCE(mi.image_url, ''),
		       mi.base_price_vnd, mi.availability_status, mi.is_available,
		       COALESCE(va.has_variants, FALSE), va.price_from_vnd
		FROM menu_items mi
		LEFT JOIN LATERAL (
			SELECT COUNT(*) > 0 AS has_variants, MIN(price_vnd) AS price_from_vnd
			FROM menu_item_variants v
			WHERE v.restaurant_id = mi.restaurant_id
			  AND v.menu_item_id = mi.id
			  AND v.is_available = TRUE
			  AND v.deleted_at IS NULL
		) va ON TRUE
		WHERE mi.restaurant_id = $1
		  AND mi.status = 'PUBLISHED'
		  AND mi.availability_status <> 'HIDDEN'
		  AND mi.deleted_at IS NULL`
	args := []any{restaurantID}
	if categoryID != nil {
		query += ` AND mi.category_id = $2`
		args = append(args, *categoryID)
	}
	query += ` ORDER BY mi.display_order, mi.name`

	rows, err := r.q(ctx).Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []domain.MenuItemSummary{}
	for rows.Next() {
		var row domain.MenuItemSummary
		var price pgtype.Int8
		if err := rows.Scan(&row.ID, &row.CategoryID, &row.Name, &row.Slug, &row.ShortDescription, &row.ImageURL, &row.BasePriceVND, &row.AvailabilityStatus, &row.IsAvailable, &row.HasVariants, &price); err != nil {
			return nil, err
		}
		if price.Valid {
			v := price.Int64
			row.PriceFromVND = &v
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *Repository) ListItemsAdmin(ctx context.Context, restaurantID uuid.UUID, categoryID *uuid.UUID) ([]domain.AdminMenuItemSummary, error) {
	query := `
		SELECT mi.id, mi.category_id, mi.name, mi.slug, COALESCE(mi.short_description, ''), COALESCE(mi.image_url, ''),
		       mi.base_price_vnd, mi.availability_status, mi.is_available,
		       COALESCE(va.has_variants, FALSE), va.price_from_vnd,
		       mi.status, mi.is_featured, COALESCE(mi.station, ''), mi.display_order, mi.version
		FROM menu_items mi
		LEFT JOIN LATERAL (
			SELECT COUNT(*) > 0 AS has_variants, MIN(price_vnd) AS price_from_vnd
			FROM menu_item_variants v
			WHERE v.restaurant_id = mi.restaurant_id
			  AND v.menu_item_id = mi.id
			  AND v.deleted_at IS NULL
		) va ON TRUE
		WHERE mi.restaurant_id = $1
		  AND mi.deleted_at IS NULL`
	args := []any{restaurantID}
	if categoryID != nil {
		query += ` AND mi.category_id = $2`
		args = append(args, *categoryID)
	}
	query += ` ORDER BY mi.display_order, mi.name`

	rows, err := r.q(ctx).Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []domain.AdminMenuItemSummary{}
	for rows.Next() {
		var row domain.AdminMenuItemSummary
		var price pgtype.Int8
		if err := rows.Scan(&row.ID, &row.CategoryID, &row.Name, &row.Slug, &row.ShortDescription, &row.ImageURL, &row.BasePriceVND, &row.AvailabilityStatus, &row.IsAvailable, &row.HasVariants, &price, &row.Status, &row.IsFeatured, &row.Station, &row.DisplayOrder, &row.Version); err != nil {
			return nil, err
		}
		if price.Valid {
			v := price.Int64
			row.PriceFromVND = &v
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *Repository) GetItem(ctx context.Context, restaurantID uuid.UUID, itemID uuid.UUID) (*domain.MenuItemDetail, error) {
	item := &domain.MenuItemDetail{}
	var rawImages []byte
	err := r.q(ctx).QueryRow(ctx, `
		SELECT id, category_id, name, slug, COALESCE(description, ''), COALESCE(short_description, ''), COALESCE(image_url, ''),
		       COALESCE(images, '[]'::jsonb), base_price_vnd, availability_status, is_available, is_spicy
		FROM menu_items
		WHERE restaurant_id = $1
		  AND id = $2
		  AND status = 'PUBLISHED'
		  AND availability_status <> 'HIDDEN'
		  AND deleted_at IS NULL
	`, restaurantID, itemID).Scan(&item.ID, &item.CategoryID, &item.Name, &item.Slug, &item.Description, &item.ShortDescription, &item.ImageURL, &rawImages, &item.BasePriceVND, &item.AvailabilityStatus, &item.IsAvailable, &item.IsSpicy)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "menu item not found")
	}
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(rawImages, &item.Images); err != nil {
		return nil, err
	}

	variants, err := r.listVariants(ctx, restaurantID, itemID)
	if err != nil {
		return nil, err
	}
	groups, err := r.listOptionGroups(ctx, restaurantID, itemID)
	if err != nil {
		return nil, err
	}
	if len(groups) > 0 {
		groupIDs := make([]uuid.UUID, 0, len(groups))
		for _, group := range groups {
			groupIDs = append(groupIDs, group.ID)
		}
		options, err := r.listOptions(ctx, restaurantID, groupIDs)
		if err != nil {
			return nil, err
		}
		for i := range groups {
			groups[i].Options = options[groups[i].ID]
			if groups[i].Options == nil {
				groups[i].Options = []domain.OptionRead{}
			}
		}
	}
	item.Variants = variants
	item.OptionGroups = groups
	return item, nil
}

func (r *Repository) GetItemAdmin(ctx context.Context, restaurantID uuid.UUID, itemID uuid.UUID) (*domain.AdminMenuItemDetail, error) {
	item := &domain.AdminMenuItemDetail{}
	var rawImages []byte
	err := r.q(ctx).QueryRow(ctx, `
		SELECT id, category_id, name, slug, COALESCE(description, ''), COALESCE(short_description, ''), COALESCE(image_url, ''),
		       COALESCE(images, '[]'::jsonb), base_price_vnd, availability_status, is_available,
		       status, is_featured, is_spicy, COALESCE(station, ''), display_order, version
		FROM menu_items
		WHERE restaurant_id = $1
		  AND id = $2
		  AND deleted_at IS NULL
	`, restaurantID, itemID).Scan(&item.ID, &item.CategoryID, &item.Name, &item.Slug, &item.Description, &item.ShortDescription, &item.ImageURL, &rawImages, &item.BasePriceVND, &item.AvailabilityStatus, &item.IsAvailable, &item.Status, &item.IsFeatured, &item.IsSpicy, &item.Station, &item.DisplayOrder, &item.Version)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "menu item not found")
	}
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(rawImages, &item.Images); err != nil {
		return nil, err
	}

	variants, err := r.listVariants(ctx, restaurantID, itemID)
	if err != nil {
		return nil, err
	}
	groups, err := r.listOptionGroups(ctx, restaurantID, itemID)
	if err != nil {
		return nil, err
	}
	if len(groups) > 0 {
		groupIDs := make([]uuid.UUID, 0, len(groups))
		for _, group := range groups {
			groupIDs = append(groupIDs, group.ID)
		}
		options, err := r.listOptions(ctx, restaurantID, groupIDs)
		if err != nil {
			return nil, err
		}
		for i := range groups {
			groups[i].Options = options[groups[i].ID]
			if groups[i].Options == nil {
				groups[i].Options = []domain.OptionRead{}
			}
		}
	}
	item.Variants = variants
	item.OptionGroups = groups
	return item, nil
}

func (r *Repository) GetItemForUpdate(ctx context.Context, restaurantID, itemID uuid.UUID) (*domain.MenuItemForUpdate, error) {
	item := &domain.MenuItemForUpdate{}
	err := r.q(ctx).QueryRow(ctx, menuItemForUpdateSQL(`
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
		FOR UPDATE
	`), restaurantID, itemID).Scan(scanMenuItemForUpdate(item)...)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "menu item not found")
	}
	if err != nil {
		return nil, err
	}
	return item, nil
}

func (r *Repository) CreateItem(ctx context.Context, restaurantID uuid.UUID, item domain.MenuItemWrite) (domain.MenuItemForUpdate, error) {
	var out domain.MenuItemForUpdate
	err := r.q(ctx).QueryRow(ctx, `
		INSERT INTO menu_items (
			id, restaurant_id, category_id, code, name, slug, description, short_description,
			base_price_vnd, image_url, images, is_available, availability_status, is_featured,
			is_spicy, tags, display_order, station, status, created_by, updated_by, version
		)
		VALUES ($1, $2, $3, $4, $5, $6, NULLIF($7, ''), NULLIF($8, ''), $9, NULLIF($10, ''),
		        '[]'::jsonb, $11, $12, $13, $14, '[]'::jsonb, $15, NULLIF($16, ''), $17, $18, $18, 1)
		RETURNING id, restaurant_id, category_id, code, name, slug, COALESCE(description, ''),
		          COALESCE(short_description, ''), base_price_vnd, COALESCE(image_url, ''),
		          is_available, availability_status, status, is_featured, is_spicy,
		          COALESCE(station, ''), display_order, version
	`, item.ID, restaurantID, item.CategoryID, item.Code, item.Name, item.Slug, item.Description, item.ShortDescription, item.BasePriceVND, item.ImageURL, item.IsAvailable, item.AvailabilityStatus, item.IsFeatured, item.IsSpicy, item.DisplayOrder, item.Station, item.Status, item.ActorID).Scan(scanMenuItemForUpdate(&out)...)
	if pg.IsUniqueViolation(err) {
		return out, apperr.New(apperr.CodeConflict, "menu item code or slug already exists")
	}
	return out, err
}

func (r *Repository) UpdateItem(ctx context.Context, restaurantID uuid.UUID, item domain.MenuItemWrite) (domain.MenuItemForUpdate, error) {
	var out domain.MenuItemForUpdate
	err := r.q(ctx).QueryRow(ctx, `
		UPDATE menu_items
		SET category_id = $3,
		    name = $4,
		    slug = $5,
		    description = NULLIF($6, ''),
		    short_description = NULLIF($7, ''),
		    base_price_vnd = $8,
		    image_url = NULLIF($9, ''),
		    is_available = $10,
		    availability_status = $11,
		    status = $12,
		    is_featured = $13,
		    is_spicy = $14,
		    station = NULLIF($15, ''),
		    display_order = $16,
		    updated_by = $17,
		    version = version + 1,
		    updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND version = $18 AND deleted_at IS NULL
		RETURNING id, restaurant_id, category_id, code, name, slug, COALESCE(description, ''),
		          COALESCE(short_description, ''), base_price_vnd, COALESCE(image_url, ''),
		          is_available, availability_status, status, is_featured, is_spicy,
		          COALESCE(station, ''), display_order, version
	`, restaurantID, item.ID, item.CategoryID, item.Name, item.Slug, item.Description, item.ShortDescription, item.BasePriceVND, item.ImageURL, item.IsAvailable, item.AvailabilityStatus, item.Status, item.IsFeatured, item.IsSpicy, item.Station, item.DisplayOrder, item.ActorID, item.Version).Scan(scanMenuItemForUpdate(&out)...)
	if errors.Is(err, pgx.ErrNoRows) {
		return out, apperr.New(apperr.CodeConflict, "menu item was modified, reload")
	}
	if pg.IsUniqueViolation(err) {
		return out, apperr.New(apperr.CodeConflict, "menu item slug already exists")
	}
	return out, err
}

func (r *Repository) SoftDeleteItem(ctx context.Context, restaurantID, itemID uuid.UUID, version int, actorID uuid.UUID) (domain.MenuItemForUpdate, error) {
	var out domain.MenuItemForUpdate
	err := r.q(ctx).QueryRow(ctx, `
		UPDATE menu_items
		SET deleted_at = NOW(),
		    updated_by = $4,
		    version = version + 1,
		    updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND version = $3 AND deleted_at IS NULL
		RETURNING id, restaurant_id, category_id, code, name, slug, COALESCE(description, ''),
		          COALESCE(short_description, ''), base_price_vnd, COALESCE(image_url, ''),
		          is_available, availability_status, status, is_featured, is_spicy,
		          COALESCE(station, ''), display_order, version
	`, restaurantID, itemID, version, actorID).Scan(scanMenuItemForUpdate(&out)...)
	if errors.Is(err, pgx.ErrNoRows) {
		return out, apperr.New(apperr.CodeConflict, "menu item was modified, reload")
	}
	return out, err
}

func (r *Repository) ToggleAvailability(ctx context.Context, restaurantID uuid.UUID, item domain.MenuItemToggle) (domain.MenuItemForUpdate, error) {
	var out domain.MenuItemForUpdate
	err := r.q(ctx).QueryRow(ctx, `
		UPDATE menu_items
		SET is_available = $3,
		    availability_status = COALESCE($4, availability_status),
		    updated_by = $5,
		    version = version + 1,
		    updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND version = $6 AND deleted_at IS NULL
		RETURNING id, restaurant_id, category_id, code, name, slug, COALESCE(description, ''),
		          COALESCE(short_description, ''), base_price_vnd, COALESCE(image_url, ''),
		          is_available, availability_status, status, is_featured, is_spicy,
		          COALESCE(station, ''), display_order, version
	`, restaurantID, item.ID, item.IsAvailable, item.AvailabilityStatus, item.ActorID, item.Version).Scan(scanMenuItemForUpdate(&out)...)
	if errors.Is(err, pgx.ErrNoRows) {
		return out, apperr.New(apperr.CodeConflict, "menu item was modified, reload")
	}
	return out, err
}

func (r *Repository) WriteAuditLog(ctx context.Context, audit domain.AuditLogWrite) error {
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

func menuItemForUpdateSQL(suffix string) string {
	return `
		SELECT id, restaurant_id, category_id, code, name, slug, COALESCE(description, ''),
		       COALESCE(short_description, ''), base_price_vnd, COALESCE(image_url, ''),
		       is_available, availability_status, status, is_featured, is_spicy,
		       COALESCE(station, ''), display_order, version
		FROM menu_items
	` + suffix
}

func scanMenuItemForUpdate(item *domain.MenuItemForUpdate) []any {
	return []any{
		&item.ID,
		&item.RestaurantID,
		&item.CategoryID,
		&item.Code,
		&item.Name,
		&item.Slug,
		&item.Description,
		&item.ShortDescription,
		&item.BasePriceVND,
		&item.ImageURL,
		&item.IsAvailable,
		&item.AvailabilityStatus,
		&item.Status,
		&item.IsFeatured,
		&item.IsSpicy,
		&item.Station,
		&item.DisplayOrder,
		&item.Version,
	}
}

func (r *Repository) listVariants(ctx context.Context, restaurantID, itemID uuid.UUID) ([]domain.VariantRead, error) {
	rows, err := r.q(ctx).Query(ctx, `
		SELECT id, name, COALESCE(unit, ''), price_vnd, is_default, is_available, display_order
		FROM menu_item_variants
		WHERE restaurant_id = $1 AND menu_item_id = $2 AND deleted_at IS NULL
		ORDER BY display_order, name
	`, restaurantID, itemID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.VariantRead{}
	for rows.Next() {
		var row domain.VariantRead
		if err := rows.Scan(&row.ID, &row.Name, &row.Unit, &row.PriceVND, &row.IsDefault, &row.IsAvailable, &row.DisplayOrder); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *Repository) listOptionGroups(ctx context.Context, restaurantID, itemID uuid.UUID) ([]domain.OptionGroupRead, error) {
	rows, err := r.q(ctx).Query(ctx, `
		SELECT og.id, og.name, COALESCE(og.description, ''), og.selection_type,
		       COALESCE(miog.is_required_override, og.is_required), og.min_selections,
		       og.max_selections, miog.display_order
		FROM menu_item_option_groups miog
		JOIN option_groups og ON og.id = miog.option_group_id
		WHERE miog.restaurant_id = $1
		  AND miog.menu_item_id = $2
		  AND og.restaurant_id = $1
		  AND og.deleted_at IS NULL
		ORDER BY miog.display_order, og.name
	`, restaurantID, itemID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.OptionGroupRead{}
	for rows.Next() {
		var row domain.OptionGroupRead
		var max pgtype.Int4
		if err := rows.Scan(&row.ID, &row.Name, &row.Description, &row.SelectionType, &row.IsRequired, &row.MinSelections, &max, &row.DisplayOrder); err != nil {
			return nil, err
		}
		if max.Valid {
			v := int(max.Int32)
			row.MaxSelections = &v
		}
		row.Options = []domain.OptionRead{}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *Repository) listOptions(ctx context.Context, restaurantID uuid.UUID, groupIDs []uuid.UUID) (map[uuid.UUID][]domain.OptionRead, error) {
	rows, err := r.q(ctx).Query(ctx, `
		SELECT option_group_id, id, name, price_delta_vnd, is_default, is_available, display_order
		FROM options
		WHERE restaurant_id = $1 AND option_group_id = ANY($2) AND deleted_at IS NULL
		ORDER BY display_order, name
	`, restaurantID, groupIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[uuid.UUID][]domain.OptionRead{}
	for rows.Next() {
		var groupID uuid.UUID
		var row domain.OptionRead
		if err := rows.Scan(&groupID, &row.ID, &row.Name, &row.PriceDeltaVND, &row.IsDefault, &row.IsAvailable, &row.DisplayOrder); err != nil {
			return nil, err
		}
		out[groupID] = append(out[groupID], row)
	}
	return out, rows.Err()
}
