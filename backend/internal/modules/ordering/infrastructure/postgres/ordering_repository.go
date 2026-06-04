package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	"restaurant-management/internal/modules/ordering/domain"
	pg "restaurant-management/internal/platform/postgres"
	"restaurant-management/internal/shared/apperr"
)

type Repository struct{ pool *pgxpool.Pool }

func NewRepository(pool *pgxpool.Pool) *Repository { return &Repository{pool: pool} }

func (r *Repository) q(ctx context.Context) pg.Querier { return pg.QuerierFromContext(ctx, r.pool) }

func (r *Repository) Save(ctx context.Context, aggregate *domain.Order) error {
	_ = ctx
	_ = aggregate
	_ = r.pool
	return apperr.ErrNotImplemented
}
func (r *Repository) Get(ctx context.Context, restaurantID uuid.UUID, id uuid.UUID) (*domain.Order, error) {
	_ = ctx
	_ = restaurantID
	_ = id
	_ = r.pool
	return nil, apperr.ErrNotImplemented
}

func (r *Repository) LockSessionForOrder(ctx context.Context, restaurantID, sessionID uuid.UUID) (*domain.SessionForOrder, error) {
	var s domain.SessionForOrder
	err := r.q(ctx).QueryRow(ctx, `
		SELECT id, restaurant_id, table_id, status
		FROM dining_sessions
		WHERE id = $1 AND restaurant_id = $2 AND deleted_at IS NULL
		FOR UPDATE
	`, sessionID, restaurantID).Scan(&s.ID, &s.RestaurantID, &s.TableID, &s.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "session not found")
	}
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Repository) FindMenuItemForOrder(ctx context.Context, restaurantID, menuItemID uuid.UUID) (*domain.MenuItemForOrder, error) {
	var item domain.MenuItemForOrder
	err := r.q(ctx).QueryRow(ctx, `
		SELECT id, code, name, base_price_vnd, COALESCE(station, 'GENERAL'), status, is_available, availability_status,
		       (status = 'PUBLISHED' AND is_available = TRUE AND availability_status = 'AVAILABLE') AS orderable
		FROM menu_items
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
	`, restaurantID, menuItemID).Scan(&item.ID, &item.Code, &item.Name, &item.BasePriceVND, &item.Station, &item.Status, &item.IsAvailable, &item.AvailabilityStatus, &item.Orderable)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "menu item not found")
	}
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *Repository) FindVariantForOrder(ctx context.Context, restaurantID, menuItemID, variantID uuid.UUID) (*domain.VariantForOrder, error) {
	var variant domain.VariantForOrder
	err := r.q(ctx).QueryRow(ctx, `
		SELECT id, name, price_vnd
		FROM menu_item_variants
		WHERE restaurant_id = $1 AND menu_item_id = $2 AND id = $3 AND is_available = TRUE AND deleted_at IS NULL
	`, restaurantID, menuItemID, variantID).Scan(&variant.ID, &variant.Name, &variant.PriceVND)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "variant not found")
	}
	if err != nil {
		return nil, err
	}
	return &variant, nil
}

func (r *Repository) ListOptionGroupRules(ctx context.Context, restaurantID, menuItemID uuid.UUID) ([]domain.OptionGroupRule, error) {
	rows, err := r.q(ctx).Query(ctx, `
		SELECT og.id, og.name, og.selection_type, COALESCE(miog.is_required_override, og.is_required), og.min_selections, og.max_selections
		FROM menu_item_option_groups miog
		JOIN option_groups og ON og.id = miog.option_group_id
		WHERE miog.restaurant_id = $1 AND miog.menu_item_id = $2 AND og.restaurant_id = $1 AND og.deleted_at IS NULL
		ORDER BY miog.display_order, og.name
	`, restaurantID, menuItemID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.OptionGroupRule{}
	for rows.Next() {
		var row domain.OptionGroupRule
		var max pgtype.Int4
		if err := rows.Scan(&row.ID, &row.Name, &row.SelectionType, &row.IsRequired, &row.MinSelections, &max); err != nil {
			return nil, err
		}
		if max.Valid {
			v := int(max.Int32)
			row.MaxSelections = &v
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *Repository) ListOptionsForOrder(ctx context.Context, restaurantID, menuItemID uuid.UUID, optionIDs []uuid.UUID) ([]domain.OptionForOrder, error) {
	if len(optionIDs) == 0 {
		return []domain.OptionForOrder{}, nil
	}
	rows, err := r.q(ctx).Query(ctx, `
		SELECT o.id, o.option_group_id, o.name, og.name, o.price_delta_vnd
		FROM options o
		JOIN option_groups og ON og.id = o.option_group_id AND og.restaurant_id = o.restaurant_id AND og.deleted_at IS NULL
		JOIN menu_item_option_groups miog ON miog.restaurant_id = o.restaurant_id AND miog.option_group_id = o.option_group_id AND miog.menu_item_id = $2
		WHERE o.restaurant_id = $1 AND o.id = ANY($3) AND o.is_available = TRUE AND o.deleted_at IS NULL
	`, restaurantID, menuItemID, optionIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.OptionForOrder{}
	for rows.Next() {
		var row domain.OptionForOrder
		if err := rows.Scan(&row.ID, &row.GroupID, &row.Name, &row.GroupName, &row.PriceDeltaVND); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *Repository) HasPriorOrders(ctx context.Context, restaurantID, sessionID uuid.UUID) (bool, error) {
	var exists bool
	err := r.q(ctx).QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM orders WHERE restaurant_id = $1 AND dining_session_id = $2 AND deleted_at IS NULL)
	`, restaurantID, sessionID).Scan(&exists)
	return exists, err
}

func (r *Repository) CreateOrderGraph(ctx context.Context, order *domain.OrderCreate) error {
	err := r.q(ctx).QueryRow(ctx, `
		INSERT INTO orders (restaurant_id, dining_session_id, order_number, order_type, status, placed_by, note)
		VALUES ($1, $2, $3, $4, 'SUBMITTED', 'GUEST', $5)
		RETURNING id
	`, order.RestaurantID, order.SessionID, order.OrderNumber, order.OrderType, nullString(order.Note)).Scan(&order.ID)
	if pg.IsUniqueViolation(err) {
		return apperr.New(apperr.CodeConflict, "order number conflict")
	}
	if err != nil {
		return err
	}
	for i := range order.Lines {
		line := &order.Lines[i]
		err := r.q(ctx).QueryRow(ctx, `
			INSERT INTO order_items (restaurant_id, order_id, dining_session_id, menu_item_id, menu_item_variant_id,
			 item_name_snapshot, item_code_snapshot, variant_name_snapshot, unit_price_vnd, quantity,
			 options_total_vnd, subtotal_vnd, discount_amount_vnd, total_amount_vnd, status, station, note)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'PENDING', $15, $16)
			RETURNING id
		`, order.RestaurantID, order.ID, order.SessionID, line.MenuItemID, line.VariantID, line.ItemNameSnapshot, nullString(line.ItemCodeSnapshot), line.VariantNameSnapshot, line.UnitPriceVND, line.Quantity, line.OptionsTotalVND, line.SubtotalVND, line.DiscountAmountVND, line.TotalAmountVND, line.Station, nullString(line.Note)).Scan(&line.ID)
		if err != nil {
			return err
		}
		for _, opt := range line.Options {
			if _, err := r.q(ctx).Exec(ctx, `
				INSERT INTO order_item_options (restaurant_id, order_item_id, option_id, option_group_id, option_name_snapshot, option_group_name_snapshot, price_delta_snapshot_vnd, quantity)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			`, order.RestaurantID, line.ID, opt.OptionID, opt.OptionGroupID, opt.OptionNameSnapshot, opt.OptionGroupNameSnapshot, opt.PriceDeltaSnapshotVND, opt.Quantity); err != nil {
				return err
			}
		}
	}
	for i := range order.KitchenTickets {
		ticket := &order.KitchenTickets[i]
		err := r.q(ctx).QueryRow(ctx, `
			INSERT INTO kitchen_tickets (restaurant_id, order_id, dining_session_id, table_id, ticket_number, station, priority, status)
			VALUES ($1, $2, $3, $4, $5, $6, 'NORMAL', 'PENDING')
			RETURNING id
		`, order.RestaurantID, order.ID, order.SessionID, order.TableID, ticket.TicketNumber, ticket.Station).Scan(&ticket.ID)
		if pg.IsUniqueViolation(err) {
			return apperr.New(apperr.CodeConflict, "ticket number conflict")
		}
		if err != nil {
			return err
		}
		for _, itemIndex := range ticket.ItemIndexes {
			if _, err := r.q(ctx).Exec(ctx, `
				INSERT INTO kitchen_ticket_items (restaurant_id, kitchen_ticket_id, order_item_id, status)
				VALUES ($1, $2, $3, 'PENDING')
			`, order.RestaurantID, ticket.ID, order.Lines[itemIndex].ID); err != nil {
				return err
			}
		}
	}
	return nil
}

func (r *Repository) SessionTotal(ctx context.Context, restaurantID, sessionID uuid.UUID) (int64, error) {
	var total int64
	err := r.q(ctx).QueryRow(ctx, `
		SELECT COALESCE(SUM(oi.total_amount_vnd), 0)
		FROM order_items oi
		JOIN orders o ON o.id = oi.order_id AND o.restaurant_id = oi.restaurant_id
		WHERE oi.restaurant_id = $1 AND oi.dining_session_id = $2
		  AND oi.deleted_at IS NULL AND oi.status <> 'CANCELLED'
		  AND o.deleted_at IS NULL AND o.status <> 'CANCELLED'
	`, restaurantID, sessionID).Scan(&total)
	return total, err
}

func (r *Repository) ViewSessionOrders(ctx context.Context, restaurantID, sessionID uuid.UUID) (domain.OrderView, error) {
	orders, err := r.fetchOrders(ctx, restaurantID, sessionID)
	if err != nil {
		return domain.OrderView{}, err
	}
	if len(orders) == 0 {
		total, err := r.SessionTotal(ctx, restaurantID, sessionID)
		return domain.OrderView{Orders: []domain.OrderRead{}, SessionTotalVND: total}, err
	}
	orderIDs := make([]uuid.UUID, 0, len(orders))
	orderIndex := map[uuid.UUID]int{}
	for i, order := range orders {
		orderIDs = append(orderIDs, order.ID)
		orderIndex[order.ID] = i
	}
	items, err := r.fetchItems(ctx, restaurantID, sessionID, orderIDs)
	if err != nil {
		return domain.OrderView{}, err
	}
	itemIDs := make([]uuid.UUID, 0, len(items))
	itemIndex := map[uuid.UUID]*domain.OrderItemRead{}
	for i := range items {
		itemIDs = append(itemIDs, items[i].ID)
		itemIndex[items[i].ID] = &items[i]
	}
	options, err := r.fetchOptions(ctx, restaurantID, itemIDs)
	if err != nil {
		return domain.OrderView{}, err
	}
	for itemID, opts := range options {
		if item := itemIndex[itemID]; item != nil {
			item.Options = opts
		}
	}
	for _, item := range items {
		idx := orderIndex[item.OrderID]
		orders[idx].Items = append(orders[idx].Items, item)
	}
	total, err := r.SessionTotal(ctx, restaurantID, sessionID)
	if err != nil {
		return domain.OrderView{}, err
	}
	return domain.OrderView{Orders: orders, SessionTotalVND: total}, nil
}

func (r *Repository) fetchOrders(ctx context.Context, restaurantID, sessionID uuid.UUID) ([]domain.OrderRead, error) {
	rows, err := r.q(ctx).Query(ctx, `
		SELECT id, order_number, order_type, status, version, submitted_at, COALESCE(note, '')
		FROM orders
		WHERE restaurant_id = $1 AND dining_session_id = $2 AND deleted_at IS NULL
		ORDER BY submitted_at, created_at
	`, restaurantID, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.OrderRead{}
	for rows.Next() {
		var row domain.OrderRead
		if err := rows.Scan(&row.ID, &row.OrderNumber, &row.OrderType, &row.Status, &row.Version, &row.SubmittedAt, &row.Note); err != nil {
			return nil, err
		}
		row.Items = []domain.OrderItemRead{}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *Repository) fetchItems(ctx context.Context, restaurantID, sessionID uuid.UUID, orderIDs []uuid.UUID) ([]domain.OrderItemRead, error) {
	rows, err := r.q(ctx).Query(ctx, `
		SELECT id, order_id, menu_item_id, item_name_snapshot, variant_name_snapshot, quantity, unit_price_vnd,
		       options_total_vnd, subtotal_vnd, total_amount_vnd, status, COALESCE(station, 'GENERAL'), COALESCE(note, '')
		FROM order_items
		WHERE restaurant_id = $1 AND dining_session_id = $2 AND order_id = ANY($3) AND deleted_at IS NULL
		ORDER BY created_at, id
	`, restaurantID, sessionID, orderIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.OrderItemRead{}
	for rows.Next() {
		var row domain.OrderItemRead
		var variant pgtype.Text
		if err := rows.Scan(&row.ID, &row.OrderID, &row.MenuItemID, &row.NameSnapshot, &variant, &row.Quantity, &row.UnitPriceVND, &row.OptionsTotalVND, &row.SubtotalVND, &row.TotalAmountVND, &row.Status, &row.Station, &row.Note); err != nil {
			return nil, err
		}
		if variant.Valid {
			v := variant.String
			row.VariantNameSnapshot = &v
		}
		row.Options = []domain.OrderOptionRead{}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *Repository) fetchOptions(ctx context.Context, restaurantID uuid.UUID, itemIDs []uuid.UUID) (map[uuid.UUID][]domain.OrderOptionRead, error) {
	if len(itemIDs) == 0 {
		return map[uuid.UUID][]domain.OrderOptionRead{}, nil
	}
	rows, err := r.q(ctx).Query(ctx, `
		SELECT order_item_id, option_name_snapshot, option_group_name_snapshot, price_delta_snapshot_vnd, quantity
		FROM order_item_options
		WHERE restaurant_id = $1 AND order_item_id = ANY($2)
		ORDER BY created_at
	`, restaurantID, itemIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[uuid.UUID][]domain.OrderOptionRead{}
	for rows.Next() {
		var itemID uuid.UUID
		var row domain.OrderOptionRead
		if err := rows.Scan(&itemID, &row.NameSnapshot, &row.OptionGroupNameSnapshot, &row.PriceDeltaSnapshotVND, &row.Quantity); err != nil {
			return nil, err
		}
		out[itemID] = append(out[itemID], row)
	}
	return out, rows.Err()
}

func (r *Repository) LockOrderForGuest(ctx context.Context, restaurantID, sessionID, orderID uuid.UUID) (*domain.OrderForEdit, error) {
	var order domain.OrderForEdit
	err := r.q(ctx).QueryRow(ctx, `
		SELECT id, order_number, order_type, status, version
		FROM orders
		WHERE id = $1 AND restaurant_id = $2 AND dining_session_id = $3 AND deleted_at IS NULL
		FOR UPDATE
	`, orderID, restaurantID, sessionID).Scan(&order.ID, &order.OrderNumber, &order.OrderType, &order.Status, &order.Version)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "order not found")
	}
	if err != nil {
		return nil, err
	}
	return &order, nil
}

func (r *Repository) LoadOrderLinesForEdit(ctx context.Context, restaurantID, sessionID, orderID uuid.UUID) ([]domain.OrderLineForEdit, error) {
	rows, err := r.q(ctx).Query(ctx, `
		SELECT id, order_id, menu_item_id, menu_item_variant_id, status, quantity, unit_price_vnd, COALESCE(note, ''), variant_name_snapshot
		FROM order_items
		WHERE restaurant_id = $1 AND dining_session_id = $2 AND order_id = $3 AND deleted_at IS NULL
		ORDER BY created_at, id
	`, restaurantID, sessionID, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.OrderLineForEdit{}
	for rows.Next() {
		var row domain.OrderLineForEdit
		var variantID pgtype.UUID
		var variantName pgtype.Text
		if err := rows.Scan(&row.ID, &row.OrderID, &row.MenuItemID, &variantID, &row.Status, &row.Quantity, &row.UnitPriceVND, &row.Note, &variantName); err != nil {
			return nil, err
		}
		if variantID.Valid {
			id := uuid.UUID(variantID.Bytes)
			row.VariantID = &id
		}
		if variantName.Valid {
			name := variantName.String
			row.VariantNameSnapshot = &name
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (r *Repository) LoadOrderLineOptionsForEdit(ctx context.Context, restaurantID uuid.UUID, lineIDs []uuid.UUID) (map[uuid.UUID][]domain.OrderLineOptionForEdit, error) {
	out := map[uuid.UUID][]domain.OrderLineOptionForEdit{}
	if len(lineIDs) == 0 {
		return out, nil
	}
	rows, err := r.q(ctx).Query(ctx, `
		SELECT order_item_id, option_id, option_group_id, option_name_snapshot,
		       option_group_name_snapshot, price_delta_snapshot_vnd, quantity
		FROM order_item_options
		WHERE restaurant_id = $1 AND order_item_id = ANY($2)
	`, restaurantID, lineIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var row domain.OrderLineOptionForEdit
		if err := rows.Scan(&row.OrderItemID, &row.OptionID, &row.OptionGroupID, &row.OptionNameSnapshot, &row.OptionGroupNameSnapshot, &row.PriceDeltaSnapshotVND, &row.Quantity); err != nil {
			return nil, err
		}
		out[row.OrderItemID] = append(out[row.OrderItemID], row)
	}
	return out, rows.Err()
}

func (r *Repository) UpdateOrderLine(ctx context.Context, restaurantID uuid.UUID, line domain.OrderLineCreate) error {
	cmd, err := r.q(ctx).Exec(ctx, `
		UPDATE order_items
		SET item_name_snapshot = $3, item_code_snapshot = $4, variant_name_snapshot = $5,
		    unit_price_vnd = $6, quantity = $7, options_total_vnd = $8, subtotal_vnd = $9,
		    discount_amount_vnd = $10, total_amount_vnd = $11, station = $12, note = $13,
		    version = version + 1, updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND status = 'PENDING' AND deleted_at IS NULL
	`, restaurantID, line.ID, line.ItemNameSnapshot, nullString(line.ItemCodeSnapshot), line.VariantNameSnapshot, line.UnitPriceVND, line.Quantity, line.OptionsTotalVND, line.SubtotalVND, line.DiscountAmountVND, line.TotalAmountVND, line.Station, nullString(line.Note))
	if err != nil {
		return err
	}
	if cmd.RowsAffected() == 0 {
		return apperr.New(apperr.CodeNotFound, "order item not found")
	}
	if _, err := r.q(ctx).Exec(ctx, `DELETE FROM order_item_options WHERE restaurant_id = $1 AND order_item_id = $2`, restaurantID, line.ID); err != nil {
		return err
	}
	for _, opt := range line.Options {
		if _, err := r.q(ctx).Exec(ctx, `
			INSERT INTO order_item_options (restaurant_id, order_item_id, option_id, option_group_id, option_name_snapshot, option_group_name_snapshot, price_delta_snapshot_vnd, quantity)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`, restaurantID, line.ID, opt.OptionID, opt.OptionGroupID, opt.OptionNameSnapshot, opt.OptionGroupNameSnapshot, opt.PriceDeltaSnapshotVND, opt.Quantity); err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) CancelOrderLines(ctx context.Context, restaurantID, orderID uuid.UUID, lineIDs []uuid.UUID, reason string) error {
	if len(lineIDs) == 0 {
		return nil
	}
	if _, err := r.q(ctx).Exec(ctx, `
		UPDATE order_items
		SET status = 'CANCELLED', cancelled_at = NOW(), cancelled_reason = $4,
		    version = version + 1, updated_at = NOW()
		WHERE restaurant_id = $1 AND order_id = $2 AND id = ANY($3) AND status = 'PENDING' AND deleted_at IS NULL
	`, restaurantID, orderID, lineIDs, reason); err != nil {
		return err
	}
	if _, err := r.q(ctx).Exec(ctx, `
		UPDATE kitchen_ticket_items
		SET status = 'CANCELLED', updated_at = NOW()
		WHERE restaurant_id = $1 AND order_item_id = ANY($2)
	`, restaurantID, lineIDs); err != nil {
		return err
	}
	_, err := r.q(ctx).Exec(ctx, `
		UPDATE kitchen_tickets kt
		SET status = 'CANCELLED', updated_at = NOW()
		WHERE kt.restaurant_id = $1 AND kt.order_id = $2
		  AND NOT EXISTS (
			SELECT 1 FROM kitchen_ticket_items kti
			WHERE kti.restaurant_id = kt.restaurant_id
			  AND kti.kitchen_ticket_id = kt.id
			  AND kti.status <> 'CANCELLED'
		  )
	`, restaurantID, orderID)
	return err
}

func (r *Repository) FinishOrderMutation(ctx context.Context, restaurantID, orderID uuid.UUID, cancelIfAllLinesCancelled bool, reason string) (int, string, error) {
	status := "SUBMITTED"
	if cancelIfAllLinesCancelled {
		var liveCount int
		if err := r.q(ctx).QueryRow(ctx, `
			SELECT COUNT(*) FROM order_items
			WHERE restaurant_id = $1 AND order_id = $2 AND deleted_at IS NULL AND status <> 'CANCELLED'
		`, restaurantID, orderID).Scan(&liveCount); err != nil {
			return 0, "", err
		}
		if liveCount == 0 {
			status = "CANCELLED"
		}
	}
	var version int
	var savedStatus string
	if status == "CANCELLED" {
		err := r.q(ctx).QueryRow(ctx, `
			UPDATE orders
			SET status = 'CANCELLED', cancelled_at = NOW(), cancelled_reason = $3,
			    version = version + 1, updated_at = NOW()
			WHERE restaurant_id = $1 AND id = $2
			RETURNING version, status
		`, restaurantID, orderID, reason).Scan(&version, &savedStatus)
		return version, savedStatus, err
	}
	err := r.q(ctx).QueryRow(ctx, `
		UPDATE orders
		SET version = version + 1, updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2
		RETURNING version, status
	`, restaurantID, orderID).Scan(&version, &savedStatus)
	return version, savedStatus, err
}

func (r *Repository) LockOrderLineForCancelRequest(ctx context.Context, restaurantID, sessionID, orderID, orderItemID uuid.UUID) (*domain.OrderLineForEdit, error) {
	var row domain.OrderLineForEdit
	var variantID pgtype.UUID
	var variantName pgtype.Text
	err := r.q(ctx).QueryRow(ctx, `
		SELECT id, order_id, menu_item_id, menu_item_variant_id, status, quantity, unit_price_vnd, COALESCE(note, ''), variant_name_snapshot
		FROM order_items
		WHERE restaurant_id = $1 AND dining_session_id = $2 AND order_id = $3 AND id = $4 AND deleted_at IS NULL
		FOR UPDATE
	`, restaurantID, sessionID, orderID, orderItemID).Scan(&row.ID, &row.OrderID, &row.MenuItemID, &variantID, &row.Status, &row.Quantity, &row.UnitPriceVND, &row.Note, &variantName)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, apperr.New(apperr.CodeNotFound, "order item not found")
	}
	if err != nil {
		return nil, err
	}
	if variantID.Valid {
		id := uuid.UUID(variantID.Bytes)
		row.VariantID = &id
	}
	if variantName.Valid {
		name := variantName.String
		row.VariantNameSnapshot = &name
	}
	return &row, nil
}

func (r *Repository) OpenCancelRequestExists(ctx context.Context, restaurantID, orderItemID uuid.UUID) (bool, error) {
	var id uuid.UUID
	err := r.q(ctx).QueryRow(ctx, `
		SELECT id FROM cancel_requests
		WHERE restaurant_id = $1 AND order_item_id = $2 AND status = 'PENDING' AND deleted_at IS NULL
		FOR UPDATE
		LIMIT 1
	`, restaurantID, orderItemID).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (r *Repository) CreateCancelRequest(ctx context.Context, restaurantID uuid.UUID, req *domain.CancelRequestCreate) error {
	req.Status = "PENDING"
	return r.q(ctx).QueryRow(ctx, `
		INSERT INTO cancel_requests (restaurant_id, order_item_id, requested_by, reason, status)
		VALUES ($1, $2, 'GUEST', $3, 'PENDING')
		RETURNING id
	`, restaurantID, req.OrderItemID, nullString(req.Reason)).Scan(&req.ID)
}

func nullString(v string) any {
	if v == "" {
		return nil
	}
	return v
}
