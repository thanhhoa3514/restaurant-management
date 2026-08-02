package postgres

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/jackc/pgx/v5/pgxpool"

	orderingapp "restaurant-management/internal/modules/ordering/application"
	"restaurant-management/internal/modules/ordering/domain"
	pg "restaurant-management/internal/platform/postgres"
	"restaurant-management/internal/shared/apperr"
)

type Repository struct {
	pool       *pgxpool.Pool
	defaultRID uuid.UUID
}

func NewRepository(pool *pgxpool.Pool, defaultRID uuid.UUID) *Repository {
	return &Repository{pool: pool, defaultRID: defaultRID}
}

func (r *Repository) q(ctx context.Context) pg.Querier { return pg.QuerierFromContext(ctx, r.pool) }

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
	placedBy := order.PlacedBy
	if placedBy == "" {
		placedBy = "GUEST"
	}
	var sessionID any
	if order.SessionID != uuid.Nil {
		sessionID = order.SessionID
	}

	// gate and go straight to PENDING.
	itemStatus := "PLACED"
	if placedBy == "STAFF" {
		itemStatus = "PENDING"
	}
	err := r.q(ctx).QueryRow(ctx, `
		INSERT INTO orders (restaurant_id, dining_session_id, order_number, order_type, status, placed_by, placed_by_user_id, note, customer_name, customer_phone, pickup_time)
		VALUES ($1, $2, $3, $4, 'SUBMITTED', $5, $6, $7, $8, $9, $10)
		RETURNING id
	`, order.RestaurantID, sessionID, order.OrderNumber, order.OrderType, placedBy, order.PlacedByUserID, nullString(order.Note), nullString(order.CustomerName), nullString(order.CustomerPhone), order.PickupTime).Scan(&order.ID)
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
			 options_total_vnd, subtotal_vnd, discount_amount_vnd, total_amount_vnd, status, station, note,
			 is_takeaway)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $18, $15, $16, $17)
			RETURNING id
		`, order.RestaurantID, order.ID, sessionID, line.MenuItemID, line.VariantID, line.ItemNameSnapshot, nullString(line.ItemCodeSnapshot), line.VariantNameSnapshot, line.UnitPriceVND, line.Quantity, line.OptionsTotalVND, line.SubtotalVND, line.DiscountAmountVND, line.TotalAmountVND, line.Station, nullString(line.Note), line.IsTakeaway, itemStatus).Scan(&line.ID)
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
		var tableID any
		if order.TableID != uuid.Nil {
			tableID = order.TableID
		}
		err := r.q(ctx).QueryRow(ctx, `
			INSERT INTO kitchen_tickets (restaurant_id, order_id, dining_session_id, table_id, ticket_number, station, priority, status)
			VALUES ($1, $2, $3, $4, $5, $6, 'NORMAL', 'PENDING')
			RETURNING id
		`, order.RestaurantID, order.ID, sessionID, tableID, ticket.TicketNumber, ticket.Station).Scan(&ticket.ID)
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
		WHERE oi.restaurant_id = $1 AND (oi.dining_session_id = $2 OR oi.order_id = $2)
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
		WHERE restaurant_id = $1 AND (dining_session_id = $2 OR id = $2) AND deleted_at IS NULL
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
		       options_total_vnd, subtotal_vnd, total_amount_vnd, status, COALESCE(station, 'GENERAL'), COALESCE(note, ''),
		       is_takeaway, unavailable_reason
		FROM order_items
		WHERE restaurant_id = $1 AND (dining_session_id = $2 OR order_id = $2) AND order_id = ANY($3) AND deleted_at IS NULL
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
		var reason pgtype.Text
		if err := rows.Scan(&row.ID, &row.OrderID, &row.MenuItemID, &row.NameSnapshot, &variant, &row.Quantity, &row.UnitPriceVND, &row.OptionsTotalVND, &row.SubtotalVND, &row.TotalAmountVND, &row.Status, &row.Station, &row.Note, &row.IsTakeaway, &reason); err != nil {
			return nil, err
		}
		if variant.Valid {
			v := variant.String
			row.VariantNameSnapshot = &v
		}
		if reason.Valid {
			r := reason.String
			row.UnavailableReason = &r
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
		SELECT order_item_id, option_id, option_group_id, option_name_snapshot, option_group_name_snapshot, price_delta_snapshot_vnd, quantity
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
		if err := rows.Scan(&itemID, &row.OptionID, &row.OptionGroupID, &row.NameSnapshot, &row.OptionGroupNameSnapshot, &row.PriceDeltaSnapshotVND, &row.Quantity); err != nil {
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
			WHERE restaurant_id = $1 AND id = $2 AND status = 'PLACED' AND deleted_at IS NULL
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
			WHERE restaurant_id = $1 AND order_id = $2 AND id = ANY($3) AND status = 'PLACED' AND deleted_at IS NULL
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

func (r *Repository) ListPendingCancelRequests(ctx context.Context, restaurantID uuid.UUID) ([]orderingapp.CancelRequestDTO, error) {
	rows, err := r.q(ctx).Query(ctx, `
		SELECT cr.id, cr.order_item_id, oi.order_id, oi.dining_session_id, COALESCE(t.code, ''),
		       oi.item_name_snapshot, oi.quantity, oi.status, COALESCE(cr.reason, ''), cr.status, cr.created_at
		FROM cancel_requests cr
		JOIN order_items oi ON oi.id = cr.order_item_id AND oi.restaurant_id = cr.restaurant_id
		JOIN dining_sessions ds ON ds.id = oi.dining_session_id AND ds.restaurant_id = cr.restaurant_id
		JOIN tables t ON t.id = ds.table_id AND t.restaurant_id = cr.restaurant_id
		WHERE cr.restaurant_id = $1 AND cr.status = 'PENDING' AND cr.deleted_at IS NULL
		ORDER BY cr.created_at ASC
	`, restaurantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []orderingapp.CancelRequestDTO
	for rows.Next() {
		var d orderingapp.CancelRequestDTO
		if err := rows.Scan(&d.ID, &d.OrderItemID, &d.OrderID, &d.SessionID, &d.TableCode,
			&d.NameSnapshot, &d.Quantity, &d.ItemStatus, &d.Reason, &d.Status, &d.RequestedAt); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}

// ReviewCancelRequest closes a PENDING cancel request. On approve the target
// order_item is transitioned to CANCELLED and dropped from the cooking queue;
// on reject the item is left untouched. Both paths run in one transaction.
func (r *Repository) ReviewCancelRequest(ctx context.Context, restaurantID, cancelRequestID uuid.UUID, approve bool, reviewedBy *uuid.UUID, note string) (orderingapp.CancelRequestReviewResult, error) {
	var out orderingapp.CancelRequestReviewResult
	var orderItemID, sessionID uuid.UUID
	var crStatus string
	err := r.q(ctx).QueryRow(ctx, `
		SELECT cr.order_item_id, cr.status, oi.dining_session_id
		FROM cancel_requests cr
		JOIN order_items oi ON oi.id = cr.order_item_id AND oi.restaurant_id = cr.restaurant_id
		WHERE cr.restaurant_id = $1 AND cr.id = $2 AND cr.deleted_at IS NULL
		FOR UPDATE OF cr
	`, restaurantID, cancelRequestID).Scan(&orderItemID, &crStatus, &sessionID)
	if errors.Is(err, pgx.ErrNoRows) {
		return out, apperr.New(apperr.CodeNotFound, "cancel request not found")
	}
	if err != nil {
		return out, err
	}
	if crStatus != "PENDING" {
		return out, apperr.New(apperr.CodeConflict, "cancel request already reviewed")
	}

	newStatus := "REJECTED"
	itemStatus := ""
	if approve {
		newStatus = "APPROVED"
		var current string
		err := r.q(ctx).QueryRow(ctx, `
			SELECT status FROM order_items
			WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
			FOR UPDATE
		`, restaurantID, orderItemID).Scan(&current)
		if errors.Is(err, pgx.ErrNoRows) {
			return out, apperr.New(apperr.CodeNotFound, "order item not found")
		}
		if err != nil {
			return out, err
		}
		if current == "READY" || current == "SERVED" || current == "CANCELLED" || current == "UNAVAILABLE" {
			return out, apperr.New(apperr.CodeConflict, "item can no longer be cancelled: "+current)
		}
		if _, err := r.q(ctx).Exec(ctx, `
			UPDATE order_items
			SET status = 'CANCELLED', version = version + 1, updated_at = NOW()
			WHERE restaurant_id = $1 AND id = $2
		`, restaurantID, orderItemID); err != nil {
			return out, err
		}
		if _, err := r.q(ctx).Exec(ctx, `
			INSERT INTO order_item_status_history (restaurant_id, order_item_id, from_status, to_status, changed_by, changed_by_role)
			VALUES ($1, $2, $3, 'CANCELLED', $4, 'kitchen')
		`, restaurantID, orderItemID, current, reviewedBy); err != nil {
			return out, err
		}
		if _, err := r.q(ctx).Exec(ctx, `
			UPDATE kitchen_ticket_items
			SET status = 'CANCELLED', updated_at = NOW()
			WHERE restaurant_id = $1 AND order_item_id = $2
		`, restaurantID, orderItemID); err != nil {
			return out, err
		}
		itemStatus = "CANCELLED"
	}

	if _, err := r.q(ctx).Exec(ctx, `
		UPDATE cancel_requests
		SET status = $3, reviewed_by = $4, reviewed_at = NOW(), review_note = $5, version = version + 1, updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2
	`, restaurantID, cancelRequestID, newStatus, reviewedBy, nullString(note)); err != nil {
		return out, err
	}

	return orderingapp.CancelRequestReviewResult{
		CancelRequestID: cancelRequestID,
		OrderItemID:     orderItemID,
		SessionID:       sessionID,
		Status:          newStatus,
		ItemStatus:      itemStatus,
	}, nil
}

func (r *Repository) ListStaffTables(ctx context.Context, restaurantID uuid.UUID) ([]orderingapp.StaffTableDTO, error) {
	rows, err := r.q(ctx).Query(ctx, `
		SELECT t.id, t.code, t.name, t.capacity, t.status, COALESCE(a.name, ''), t.position_x, t.position_y,
		       ds.id, ds.session_code, ds.status, COALESCE(ds.customer_count, 0), COALESCE(ds.customer_name, ''), ds.opened_at, ds.updated_at, ds.waiter_called_at, COALESCE(ds.waiter_call_reason, ''), ds.merge_group_id
		FROM tables t
		LEFT JOIN areas a ON a.id = t.area_id AND a.restaurant_id = t.restaurant_id AND a.deleted_at IS NULL
		LEFT JOIN dining_sessions ds
		  ON ds.restaurant_id = t.restaurant_id
		 AND ds.table_id = t.id
		 AND ds.status IN ('ACTIVE', 'AWAITING_PAYMENT')
		 AND ds.deleted_at IS NULL
		WHERE t.restaurant_id = $1 AND t.deleted_at IS NULL

		UNION ALL

		SELECT '00000000-0000-0000-0000-000000000001'::uuid, 'Mang về', 'Mang về', 0, 'AVAILABLE', '', NULL::int, NULL::int,
		       o.id, o.order_number, o.status, 1, COALESCE(o.customer_name, ''), o.submitted_at, o.updated_at, NULL::timestamptz, '', NULL::uuid
		FROM orders o
		WHERE o.restaurant_id = $1 AND o.order_type = 'TAKEAWAY' AND o.status NOT IN ('PAID', 'CANCELLED') AND o.deleted_at IS NULL
		
		ORDER BY 2
	`, restaurantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []orderingapp.StaffTableDTO{}
	for rows.Next() {
		var table orderingapp.StaffTableDTO
		var sessionID, mergeGroupID pgtype.UUID
		var sessionCode, sessionStatus pgtype.Text
		var customerCount pgtype.Int4
		var customerName, waiterCallReason pgtype.Text
		var posX, posY pgtype.Int4
		var openedAt, updatedAt, waiterCalledAt pgtype.Timestamptz
		if err := rows.Scan(&table.ID, &table.Code, &table.Name, &table.Capacity, &table.Status, &table.AreaName, &posX, &posY, &sessionID, &sessionCode, &sessionStatus, &customerCount, &customerName, &openedAt, &updatedAt, &waiterCalledAt, &waiterCallReason, &mergeGroupID); err != nil {
			return nil, err
		}
		if posX.Valid && posY.Valid {
			x, y := int(posX.Int32), int(posY.Int32)
			table.PositionX, table.PositionY = &x, &y
		}
		if sessionID.Valid {
			sid := uuid.UUID(sessionID.Bytes)
			status := sessionStatus.String
			session := &orderingapp.StaffSessionDTO{
				ID:            sid,
				SessionCode:   sessionCode.String,
				Status:        status,
				CustomerCount: int(customerCount.Int32),
				GuestName:     customerName.String,
				OpenedAt:      openedAt.Time,
				Orders:        []orderingapp.StaffOrderDTO{},
			}
			if status == "AWAITING_PAYMENT" && updatedAt.Valid {
				t := updatedAt.Time
				session.BillRequestedAt = &t
			}
			if waiterCalledAt.Valid {
				t := waiterCalledAt.Time
				session.WaiterCalledAt = &t
				session.WaiterCallReason = waiterCallReason.String
			}
			if mergeGroupID.Valid {
				gid := uuid.UUID(mergeGroupID.Bytes)
				session.MergeGroupID = &gid
			}
			view, err := r.ViewSessionOrders(ctx, restaurantID, sid)
			if err != nil {
				return nil, err
			}
			session.Orders = toStaffOrders(view.Orders)
			session.TotalVND = view.SessionTotalVND
			table.Session = session
			table.Status = "OCCUPIED"
		}
		out = append(out, table)
	}
	return out, rows.Err()
}

func (r *Repository) ListKitchenQueue(ctx context.Context, restaurantID uuid.UUID) ([]orderingapp.KitchenTicketDTO, error) {
	rows, err := r.q(ctx).Query(ctx, `
		SELECT kt.id, kt.order_id, kt.dining_session_id, kt.table_id, COALESCE(t.code, ''), COALESCE(t.name, ''),
		       kt.ticket_number, kt.station, kt.priority, kt.status, o.submitted_at
		FROM kitchen_tickets kt
		JOIN orders o ON o.id = kt.order_id AND o.restaurant_id = kt.restaurant_id AND o.deleted_at IS NULL AND o.status <> 'CANCELLED'
		LEFT JOIN tables t ON t.id = kt.table_id AND t.restaurant_id = kt.restaurant_id AND t.deleted_at IS NULL
		WHERE kt.restaurant_id = $1 AND kt.deleted_at IS NULL AND kt.status <> 'CANCELLED'
		  AND EXISTS (
		    SELECT 1
		    FROM kitchen_ticket_items kti
		    JOIN order_items oi ON oi.id = kti.order_item_id AND oi.restaurant_id = kti.restaurant_id AND oi.deleted_at IS NULL
		    WHERE kti.restaurant_id = kt.restaurant_id
		      AND kti.kitchen_ticket_id = kt.id
		      AND oi.status NOT IN ('PLACED', 'SERVED')
		      AND kti.status <> 'CANCELLED'
		  )
		ORDER BY o.submitted_at, kt.created_at
	`, restaurantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tickets := []orderingapp.KitchenTicketDTO{}
	ticketIDs := []uuid.UUID{}
	idx := map[uuid.UUID]int{}
	for rows.Next() {
		var ticket orderingapp.KitchenTicketDTO
		var sessionID, tableID pgtype.UUID
		if err := rows.Scan(&ticket.ID, &ticket.OrderID, &sessionID, &tableID, &ticket.TableCode, &ticket.TableName, &ticket.Number, &ticket.Station, &ticket.Priority, &ticket.Status, &ticket.SubmittedAt); err != nil {
			return nil, err
		}
		if sessionID.Valid {
			id := uuid.UUID(sessionID.Bytes)
			ticket.SessionID = &id
		}
		if tableID.Valid {
			id := uuid.UUID(tableID.Bytes)
			ticket.TableID = &id
		}
		ticket.Items = []orderingapp.KitchenTicketItemDTO{}
		idx[ticket.ID] = len(tickets)
		ticketIDs = append(ticketIDs, ticket.ID)
		tickets = append(tickets, ticket)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(ticketIDs) == 0 {
		return tickets, nil
	}

	items, itemIDs, err := r.fetchKitchenTicketItems(ctx, restaurantID, ticketIDs)
	if err != nil {
		return nil, err
	}
	options, err := r.fetchStaffOptions(ctx, restaurantID, itemIDs)
	if err != nil {
		return nil, err
	}
	history, err := r.fetchStaffHistory(ctx, restaurantID, itemIDs)
	if err != nil {
		return nil, err
	}
	for _, row := range items {
		item := row.item
		item.Options = options[item.OrderItemID]
		item.StatusHistory = history[item.OrderItemID]
		if len(item.StatusHistory) == 0 {
			item.StatusHistory = []orderingapp.StaffStatusDTO{{
				Status:    item.Status,
				ToStatus:  item.Status,
				Timestamp: tickets[idx[row.ticketID]].SubmittedAt,
			}}
		}
		tickets[idx[row.ticketID]].Items = append(tickets[idx[row.ticketID]].Items, item)
	}
	return tickets, nil
}

type kitchenItemRow struct {
	ticketID uuid.UUID
	item     orderingapp.KitchenTicketItemDTO
}

func (r *Repository) fetchKitchenTicketItems(ctx context.Context, restaurantID uuid.UUID, ticketIDs []uuid.UUID) ([]kitchenItemRow, []uuid.UUID, error) {
	rows, err := r.q(ctx).Query(ctx, `
		SELECT kti.kitchen_ticket_id, kti.id, kti.order_item_id, oi.menu_item_id, oi.item_name_snapshot,
		       oi.variant_name_snapshot, oi.quantity, oi.is_takeaway, oi.status, COALESCE(oi.note, '')
		FROM kitchen_ticket_items kti
		JOIN order_items oi ON oi.id = kti.order_item_id AND oi.restaurant_id = kti.restaurant_id AND oi.deleted_at IS NULL
		WHERE kti.restaurant_id = $1 AND kti.kitchen_ticket_id = ANY($2) AND kti.status <> 'CANCELLED'
		  AND oi.status <> 'PLACED'
		ORDER BY kti.created_at, kti.id
	`, restaurantID, ticketIDs)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	out := []kitchenItemRow{}
	itemIDs := []uuid.UUID{}
	for rows.Next() {
		var row kitchenItemRow
		var variant pgtype.Text
		if err := rows.Scan(&row.ticketID, &row.item.ID, &row.item.OrderItemID, &row.item.MenuItemID, &row.item.NameSnapshot, &variant, &row.item.Quantity, &row.item.IsTakeaway, &row.item.Status, &row.item.Note); err != nil {
			return nil, nil, err
		}
		if variant.Valid {
			v := variant.String
			row.item.VariantNameSnapshot = &v
		}
		itemIDs = append(itemIDs, row.item.OrderItemID)
		out = append(out, row)
	}
	return out, itemIDs, rows.Err()
}

func (r *Repository) RequestBill(ctx context.Context, restaurantID, sessionID uuid.UUID) (orderingapp.RequestBillResponse, error) {
	var out orderingapp.RequestBillResponse
	var requested pgtype.Timestamptz
	err := r.q(ctx).QueryRow(ctx, `
		UPDATE dining_sessions
		SET status = 'AWAITING_PAYMENT', version = version + 1, updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND status = 'ACTIVE' AND deleted_at IS NULL
		RETURNING id, status, updated_at
	`, restaurantID, sessionID).Scan(&out.SessionID, &out.Status, &requested)
	if errors.Is(err, pgx.ErrNoRows) {
		return out, apperr.New(apperr.CodeConflict, "session is not active")
	}
	if requested.Valid {
		t := requested.Time
		out.Requested = &t
	}
	return out, err
}

func (r *Repository) ReopenSession(ctx context.Context, restaurantID, sessionID uuid.UUID) (orderingapp.RequestBillResponse, error) {
	var out orderingapp.RequestBillResponse
	var updated pgtype.Timestamptz
	err := r.q(ctx).QueryRow(ctx, `
		UPDATE dining_sessions
		SET status = 'ACTIVE', version = version + 1, updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2 AND status = 'AWAITING_PAYMENT' AND deleted_at IS NULL
		RETURNING id, status, updated_at
	`, restaurantID, sessionID).Scan(&out.SessionID, &out.Status, &updated)
	if errors.Is(err, pgx.ErrNoRows) {
		return out, apperr.New(apperr.CodeConflict, "session is not awaiting payment")
	}
	if updated.Valid {
		t := updated.Time
		out.Requested = &t
	}
	return out, err
}

func (r *Repository) CallWaiter(ctx context.Context, restaurantID, sessionID uuid.UUID, reason string) (orderingapp.RequestBillResponse, error) {
	var out orderingapp.RequestBillResponse
	var called pgtype.Timestamptz
	var storedReason, tableCode pgtype.Text
	// Trả kèm mã bàn để realtime báo đúng "Bàn T05 gọi nhân viên" thay vì thông báo chung chung.
	err := r.q(ctx).QueryRow(ctx, `
		WITH updated AS (
			UPDATE dining_sessions
			SET waiter_called_at = NOW(), waiter_call_reason = NULLIF($3, '')
			WHERE restaurant_id = $1 AND id = $2 AND status IN ('ACTIVE', 'AWAITING_PAYMENT') AND deleted_at IS NULL
			RETURNING id, status, waiter_called_at, waiter_call_reason, table_id
		)
		SELECT u.id, u.status, u.waiter_called_at, u.waiter_call_reason, t.code
		FROM updated u
		LEFT JOIN tables t ON t.id = u.table_id
	`, restaurantID, sessionID, reason).Scan(&out.SessionID, &out.Status, &called, &storedReason, &tableCode)
	if errors.Is(err, pgx.ErrNoRows) {
		return out, apperr.New(apperr.CodeConflict, "session is not open")
	}
	if called.Valid {
		t := called.Time
		out.Requested = &t
	}
	out.Reason = storedReason.String
	out.TableCode = tableCode.String
	return out, err
}

func (r *Repository) AckWaiterCall(ctx context.Context, restaurantID, sessionID uuid.UUID) (orderingapp.RequestBillResponse, error) {
	var out orderingapp.RequestBillResponse
	err := r.q(ctx).QueryRow(ctx, `
		UPDATE dining_sessions
		SET waiter_called_at = NULL, waiter_call_reason = NULL
		WHERE restaurant_id = $1 AND id = $2 AND deleted_at IS NULL
		RETURNING id, status
	`, restaurantID, sessionID).Scan(&out.SessionID, &out.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return out, apperr.New(apperr.CodeNotFound, "session not found")
	}
	return out, err
}

func (r *Repository) UpdateOrderItemStatus(ctx context.Context, restaurantID, itemID uuid.UUID, status string, actorID *uuid.UUID, actorRole string) (orderingapp.UpdateItemStatusResponse, error) {
	orderID, current, c, err := r.lockItem(ctx, restaurantID, itemID)
	if err != nil {
		return orderingapp.UpdateItemStatusResponse{}, err
	}
	if current == status {
		return c.resp(itemID, status), nil
	}
	if !canMoveStatus(current, status) {
		return orderingapp.UpdateItemStatusResponse{}, apperr.New(apperr.CodeConflict, "invalid item status transition")
	}

	_, err = r.q(ctx).Exec(ctx, `
		UPDATE order_items
		SET status = $3,
		    served_at = CASE WHEN $3::VARCHAR(40) = 'SERVED' THEN NOW() ELSE served_at END,
		    served_by = CASE WHEN $3::VARCHAR(40) = 'SERVED' THEN $4 ELSE served_by END,
		    version = version + 1,
		    updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2
	`, restaurantID, itemID, status, actorID)
	if err != nil {
		return orderingapp.UpdateItemStatusResponse{}, err
	}
	_, err = r.q(ctx).Exec(ctx, `
		INSERT INTO order_item_status_history (restaurant_id, order_item_id, from_status, to_status, changed_by, changed_by_role)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, restaurantID, itemID, current, status, actorID, nullString(actorRole))
	if err != nil {
		return orderingapp.UpdateItemStatusResponse{}, err
	}
	if err := r.syncKitchenStatus(ctx, restaurantID, orderID, itemID, status, actorID); err != nil {
		return orderingapp.UpdateItemStatusResponse{}, err
	}
	if err := r.bumpOrderVersionForItem(ctx, restaurantID, itemID); err != nil {
		return orderingapp.UpdateItemStatusResponse{}, err
	}
	return c.resp(itemID, status), nil
}

func canMoveStatus(current, next string) bool {
	if current == "PENDING" && next == "ACKNOWLEDGED" {
		return true
	}
	if current == "ACKNOWLEDGED" && next == "PREPARING" {
		return true
	}
	if current == "PREPARING" && next == "READY" {
		return true
	}
	if current == "READY" && next == "SERVED" {
		return true
	}
	return false
}

func (r *Repository) syncKitchenStatus(ctx context.Context, restaurantID, orderID, itemID uuid.UUID, status string, actorID *uuid.UUID) error {
	switch status {
	case "ACKNOWLEDGED":
		if _, err := r.q(ctx).Exec(ctx, `
			UPDATE kitchen_tickets kt
			SET status = CASE WHEN status = 'PENDING' THEN 'ACKNOWLEDGED' ELSE status END,
			    acknowledged_at = COALESCE(acknowledged_at, NOW()), acknowledged_by = COALESCE(acknowledged_by, $3), updated_at = NOW()
			WHERE kt.restaurant_id = $1 AND kt.order_id = $2 AND kt.deleted_at IS NULL
		`, restaurantID, orderID, actorID); err != nil {
			return err
		}
	case "PREPARING":
		if _, err := r.q(ctx).Exec(ctx, `UPDATE kitchen_ticket_items SET status = 'PREPARING', started_at = COALESCE(started_at, NOW()), prepared_by = COALESCE(prepared_by, $3), updated_at = NOW() WHERE restaurant_id = $1 AND order_item_id = $2`, restaurantID, itemID, actorID); err != nil {
			return err
		}
		if _, err := r.q(ctx).Exec(ctx, `UPDATE kitchen_tickets kt SET status = 'PREPARING', started_at = COALESCE(started_at, NOW()), updated_at = NOW() WHERE kt.restaurant_id = $1 AND kt.order_id = $2 AND kt.deleted_at IS NULL`, restaurantID, orderID); err != nil {
			return err
		}
	case "READY":
		if _, err := r.q(ctx).Exec(ctx, `UPDATE kitchen_ticket_items SET status = 'READY', ready_at = COALESCE(ready_at, NOW()), updated_at = NOW() WHERE restaurant_id = $1 AND order_item_id = $2`, restaurantID, itemID); err != nil {
			return err
		}
		if _, err := r.q(ctx).Exec(ctx, `
			UPDATE kitchen_tickets kt
			SET status = 'READY', completed_at = COALESCE(completed_at, NOW()), updated_at = NOW()
			WHERE kt.restaurant_id = $1 AND kt.order_id = $2 AND kt.deleted_at IS NULL
			  AND NOT EXISTS (
				SELECT 1 FROM kitchen_ticket_items kti
				WHERE kti.restaurant_id = kt.restaurant_id AND kti.kitchen_ticket_id = kt.id AND kti.status NOT IN ('READY', 'CANCELLED')
			  )
		`, restaurantID, orderID); err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) MarkItemUnavailable(ctx context.Context, restaurantID, itemID uuid.UUID, reason string, actorID *uuid.UUID) (orderingapp.UpdateItemStatusResponse, error) {
	_, current, c, err := r.lockItem(ctx, restaurantID, itemID)
	if err != nil {
		return orderingapp.UpdateItemStatusResponse{}, err
	}
	if current != "PENDING" && current != "ACKNOWLEDGED" {
		return orderingapp.UpdateItemStatusResponse{}, apperr.New(apperr.CodeConflict, "item cannot be marked unavailable in current status: "+current)
	}

	_, err = r.q(ctx).Exec(ctx, `
		UPDATE order_items
		SET status = 'UNAVAILABLE',
		    unavailable_at = NOW(),
		    unavailable_reason = $3,
		    version = version + 1,
		    updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2
	`, restaurantID, itemID, nullString(reason))
	if err != nil {
		return orderingapp.UpdateItemStatusResponse{}, err
	}
	_, err = r.q(ctx).Exec(ctx, `
		INSERT INTO order_item_status_history (restaurant_id, order_item_id, from_status, to_status, changed_by, changed_by_role)
		VALUES ($1, $2, $3, 'UNAVAILABLE', $4, 'kitchen')
	`, restaurantID, itemID, current, actorID)
	if err != nil {
		return orderingapp.UpdateItemStatusResponse{}, err
	}
	// Cancel the kitchen ticket item so it disappears from the cooking queue
	if _, err := r.q(ctx).Exec(ctx, `
		UPDATE kitchen_ticket_items
		SET status = 'CANCELLED', updated_at = NOW()
		WHERE restaurant_id = $1 AND order_item_id = $2
	`, restaurantID, itemID); err != nil {
		return orderingapp.UpdateItemStatusResponse{}, err
	}
	if err := r.bumpOrderVersionForItem(ctx, restaurantID, itemID); err != nil {
		return orderingapp.UpdateItemStatusResponse{}, err
	}
	return c.resp(itemID, "UNAVAILABLE"), nil
}

// bumpOrderVersionForItem increments the parent order's optimistic-lock
// version whenever a child item's status changes. Without this, a guest who
// fetched the order while a line was PLACED still holds a matching
// orders.version after staff confirm/reject that line — so a stale guest edit
// (which omits the now-confirmed line) sails past the version guard in
// GuestEditOrder and silently no-ops, leaving the line live and billable.
func (r *Repository) bumpOrderVersionForItem(ctx context.Context, restaurantID, itemID uuid.UUID) error {
	_, err := r.q(ctx).Exec(ctx, `
		UPDATE orders
		SET version = version + 1, updated_at = NOW()
		WHERE restaurant_id = $1
		  AND id = (SELECT order_id FROM order_items WHERE restaurant_id = $1 AND id = $2)
	`, restaurantID, itemID)
	return err
}

// ConfirmOrderItem promotes a PLACED item to PENDING, releasing it to the
// kitchen queue. The kitchen_ticket_item was created PENDING already and only
// becomes visible once the order_item leaves PLACED (see ListKitchenQueue).
func (r *Repository) ConfirmOrderItem(ctx context.Context, restaurantID, itemID uuid.UUID, actorID *uuid.UUID, actorRole string) (orderingapp.UpdateItemStatusResponse, error) {
	current, c, err := r.lockPlacedItem(ctx, restaurantID, itemID)
	if err != nil {
		return orderingapp.UpdateItemStatusResponse{}, err
	}
	if _, err := r.q(ctx).Exec(ctx, `
		UPDATE order_items
		SET status = 'PENDING', version = version + 1, updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2
	`, restaurantID, itemID); err != nil {
		return orderingapp.UpdateItemStatusResponse{}, err
	}
	if _, err := r.q(ctx).Exec(ctx, `
		INSERT INTO order_item_status_history (restaurant_id, order_item_id, from_status, to_status, changed_by, changed_by_role)
		VALUES ($1, $2, $3, 'PENDING', $4, $5)
	`, restaurantID, itemID, current, actorID, nullString(actorRole)); err != nil {
		return orderingapp.UpdateItemStatusResponse{}, err
	}
	if err := r.bumpOrderVersionForItem(ctx, restaurantID, itemID); err != nil {
		return orderingapp.UpdateItemStatusResponse{}, err
	}
	return c.resp(itemID, "PENDING"), nil
}

// RejectOrderItem cancels a PLACED item before it ever reaches the kitchen.
// The item and its kitchen_ticket_item go CANCELLED; any ticket left with no
// live items is cancelled too.
func (r *Repository) RejectOrderItem(ctx context.Context, restaurantID, itemID uuid.UUID, reason string, actorID *uuid.UUID, actorRole string) (orderingapp.UpdateItemStatusResponse, error) {
	current, c, err := r.lockPlacedItem(ctx, restaurantID, itemID)
	if err != nil {
		return orderingapp.UpdateItemStatusResponse{}, err
	}
	if _, err := r.q(ctx).Exec(ctx, `
		UPDATE order_items
		SET status = 'CANCELLED', cancelled_at = NOW(), cancelled_by = $3, cancelled_reason = $4,
		    version = version + 1, updated_at = NOW()
		WHERE restaurant_id = $1 AND id = $2
	`, restaurantID, itemID, actorID, nullString(reason)); err != nil {
		return orderingapp.UpdateItemStatusResponse{}, err
	}
	if _, err := r.q(ctx).Exec(ctx, `
		INSERT INTO order_item_status_history (restaurant_id, order_item_id, from_status, to_status, changed_by, changed_by_role, reason)
		VALUES ($1, $2, $3, 'CANCELLED', $4, $5, $6)
	`, restaurantID, itemID, current, actorID, nullString(actorRole), nullString(reason)); err != nil {
		return orderingapp.UpdateItemStatusResponse{}, err
	}
	if _, err := r.q(ctx).Exec(ctx, `
		UPDATE kitchen_ticket_items
		SET status = 'CANCELLED', updated_at = NOW()
		WHERE restaurant_id = $1 AND order_item_id = $2
	`, restaurantID, itemID); err != nil {
		return orderingapp.UpdateItemStatusResponse{}, err
	}
	if _, err := r.q(ctx).Exec(ctx, `
		UPDATE kitchen_tickets kt
		SET status = 'CANCELLED', updated_at = NOW()
		WHERE kt.restaurant_id = $1
		  AND kt.id = (SELECT kitchen_ticket_id FROM kitchen_ticket_items WHERE restaurant_id = $1 AND order_item_id = $2)
		  AND NOT EXISTS (
			SELECT 1 FROM kitchen_ticket_items kti
			WHERE kti.restaurant_id = kt.restaurant_id
			  AND kti.kitchen_ticket_id = kt.id
			  AND kti.status <> 'CANCELLED'
		  )
	`, restaurantID, itemID); err != nil {
		return orderingapp.UpdateItemStatusResponse{}, err
	}
	if err := r.bumpOrderVersionForItem(ctx, restaurantID, itemID); err != nil {
		return orderingapp.UpdateItemStatusResponse{}, err
	}
	return c.resp(itemID, "CANCELLED"), nil
}

// itemCtx gom dữ liệu định tuyến + hiển thị realtime lấy kèm lúc khoá dòng món.
type itemCtx struct {
	sessionID *uuid.UUID
	itemName  string
	tableCode string
}

func (c itemCtx) resp(itemID uuid.UUID, status string) orderingapp.UpdateItemStatusResponse {
	return orderingapp.UpdateItemStatusResponse{
		ID:        itemID,
		Status:    status,
		SessionID: c.sessionID,
		ItemName:  c.itemName,
		TableCode: c.tableCode,
	}
}

// lockItem khoá dòng order_item và lấy kèm dữ liệu realtime.
// Đơn mang về (takeaway) không gắn phiên/bàn → sessionID = nil, tableCode = "".
func (r *Repository) lockItem(ctx context.Context, restaurantID, itemID uuid.UUID) (uuid.UUID, string, itemCtx, error) {
	var orderID uuid.UUID
	var current string
	var c itemCtx
	var sess pgtype.UUID
	err := r.q(ctx).QueryRow(ctx, `
		SELECT oi.order_id, oi.status, oi.item_name_snapshot, oi.dining_session_id, COALESCE(t.code, '')
		FROM order_items oi
		LEFT JOIN dining_sessions ds ON ds.id = oi.dining_session_id AND ds.restaurant_id = oi.restaurant_id
		LEFT JOIN tables t ON t.id = ds.table_id AND t.restaurant_id = oi.restaurant_id
		WHERE oi.restaurant_id = $1 AND oi.id = $2 AND oi.deleted_at IS NULL
		FOR UPDATE OF oi
	`, restaurantID, itemID).Scan(&orderID, &current, &c.itemName, &sess, &c.tableCode)
	if errors.Is(err, pgx.ErrNoRows) {
		return uuid.Nil, "", itemCtx{}, apperr.New(apperr.CodeNotFound, "order item not found")
	}
	if err != nil {
		return uuid.Nil, "", itemCtx{}, err
	}
	if sess.Valid {
		id := uuid.UUID(sess.Bytes)
		c.sessionID = &id
	}
	return orderID, current, c, nil
}

// lockPlacedItem khoá dòng món và khẳng định nó vẫn đang chờ nhân viên duyệt (PLACED).
func (r *Repository) lockPlacedItem(ctx context.Context, restaurantID, itemID uuid.UUID) (string, itemCtx, error) {
	_, current, c, err := r.lockItem(ctx, restaurantID, itemID)
	if err != nil {
		return "", itemCtx{}, err
	}
	if current != "PLACED" {
		return "", itemCtx{}, apperr.New(apperr.CodeConflict, "order item is not awaiting confirmation")
	}
	return current, c, nil
}

func toStaffOrders(orders []domain.OrderRead) []orderingapp.StaffOrderDTO {
	out := make([]orderingapp.StaffOrderDTO, 0, len(orders))
	for _, order := range orders {
		items := make([]orderingapp.StaffOrderItemDTO, 0, len(order.Items))
		for _, item := range order.Items {
			options := make([]orderingapp.StaffOptionDTO, 0, len(item.Options))
			for _, opt := range item.Options {
				options = append(options, orderingapp.StaffOptionDTO{NameSnapshot: opt.NameSnapshot, OptionGroupNameSnapshot: opt.OptionGroupNameSnapshot, PriceDeltaSnapshotVND: opt.PriceDeltaSnapshotVND, Quantity: opt.Quantity})
			}
			items = append(items, orderingapp.StaffOrderItemDTO{ID: item.ID, OrderID: item.OrderID, MenuItemID: item.MenuItemID, NameSnapshot: item.NameSnapshot, VariantNameSnapshot: item.VariantNameSnapshot, Quantity: item.Quantity, UnitPriceVND: item.UnitPriceVND, OptionsTotalVND: item.OptionsTotalVND, SubtotalVND: item.SubtotalVND, TotalAmountVND: item.TotalAmountVND, Status: item.Status, Station: item.Station, Note: item.Note, IsTakeaway: item.IsTakeaway, Options: options, StatusHistory: []orderingapp.StaffStatusDTO{{Status: item.Status, ToStatus: item.Status, Timestamp: order.SubmittedAt}}})
		}
		out = append(out, orderingapp.StaffOrderDTO{ID: order.ID, OrderNumber: order.OrderNumber, OrderType: order.OrderType, Status: order.Status, SubmittedAt: order.SubmittedAt, Note: order.Note, Items: items})
	}
	return out
}

func (r *Repository) fetchStaffOptions(ctx context.Context, restaurantID uuid.UUID, itemIDs []uuid.UUID) (map[uuid.UUID][]orderingapp.StaffOptionDTO, error) {
	out := map[uuid.UUID][]orderingapp.StaffOptionDTO{}
	if len(itemIDs) == 0 {
		return out, nil
	}
	rows, err := r.q(ctx).Query(ctx, `SELECT order_item_id, option_name_snapshot, option_group_name_snapshot, price_delta_snapshot_vnd, quantity FROM order_item_options WHERE restaurant_id = $1 AND order_item_id = ANY($2) ORDER BY created_at`, restaurantID, itemIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var itemID uuid.UUID
		var row orderingapp.StaffOptionDTO
		if err := rows.Scan(&itemID, &row.NameSnapshot, &row.OptionGroupNameSnapshot, &row.PriceDeltaSnapshotVND, &row.Quantity); err != nil {
			return nil, err
		}
		out[itemID] = append(out[itemID], row)
	}
	return out, rows.Err()
}

func (r *Repository) fetchStaffHistory(ctx context.Context, restaurantID uuid.UUID, itemIDs []uuid.UUID) (map[uuid.UUID][]orderingapp.StaffStatusDTO, error) {
	out := map[uuid.UUID][]orderingapp.StaffStatusDTO{}
	if len(itemIDs) == 0 {
		return out, nil
	}
	rows, err := r.q(ctx).Query(ctx, `
		SELECT h.order_item_id, h.from_status, h.to_status, h.changed_at,
		       u.full_name, h.changed_by_role, h.reason, h.note
		FROM order_item_status_history h
		LEFT JOIN users u
		  ON u.id = h.changed_by
		 AND u.restaurant_id = h.restaurant_id
		WHERE h.restaurant_id = $1
		  AND h.order_item_id = ANY($2)
		ORDER BY h.changed_at, h.id
	`, restaurantID, itemIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var itemID uuid.UUID
		var row orderingapp.StaffStatusDTO
		if err := rows.Scan(
			&itemID,
			&row.FromStatus,
			&row.ToStatus,
			&row.Timestamp,
			&row.ChangedByName,
			&row.ChangedByRole,
			&row.Reason,
			&row.Note,
		); err != nil {
			return nil, err
		}
		row.Status = row.ToStatus
		out[itemID] = append(out[itemID], row)
	}
	return out, rows.Err()
}

func nullString(v string) any {
	if v == "" {
		return nil
	}
	return v
}
