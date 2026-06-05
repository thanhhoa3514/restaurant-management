// Command seed inserts minimal demo data for Batch A staff login only.
// It intentionally defers the full Q10 menu catalog to Batch B, where menu
// browsing first needs it.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"

	"restaurant-management/internal/platform/config"
	"restaurant-management/internal/platform/logger"
	"restaurant-management/internal/platform/postgres"
)

const (
	demoRestaurantCode     = "DEMO"
	defaultDemoPassword    = "demo1234"
	demoPasswordEnvVarName = "DEMO_SEED_PASSWORD"
)

var demoUsers = []struct {
	username string
	fullName string
	role     string
}{
	{username: "manager", fullName: "Demo Manager", role: "manager"},
	{username: "cashier", fullName: "Demo Cashier", role: "cashier"},
	{username: "server", fullName: "Demo Server", role: "server"},
	{username: "kitchen", fullName: "Demo Kitchen", role: "kitchen"},
}

func main() {
	ctx := context.Background()
	cfg := config.Load()
	log := logger.New(cfg.AppEnv, cfg.LogLevel)

	pool, err := postgres.Connect(ctx, cfg.DatabaseURL, cfg.DBMaxConns)
	if err != nil {
		log.Error("postgres init failed", slog.Any("error", err))
		os.Exit(1)
	}
	defer pool.Close()

	tx, err := pool.Begin(ctx)
	if err != nil {
		log.Error("begin seed transaction failed", slog.Any("error", err))
		os.Exit(1)
	}
	defer tx.Rollback(ctx)

	var restaurantID uuid.UUID
	if err := tx.QueryRow(ctx, `
		INSERT INTO restaurants (name, code, address, phone, email, vat_rate_basis_points, service_charge_basis_points, status)
		VALUES ('Demo Restaurant', $1, '123 Demo Street', '+84000000000', 'demo@example.com', 800, 500, 'ACTIVE')
		ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
		RETURNING id
	`, demoRestaurantCode).Scan(&restaurantID); err != nil {
		log.Error("seed restaurant failed", slog.Any("error", err))
		os.Exit(1)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(demoPassword()), bcrypt.DefaultCost)
	if err != nil {
		log.Error("hash demo password failed", slog.Any("error", err))
		os.Exit(1)
	}

	for _, u := range demoUsers {
		if _, err := tx.Exec(ctx, `
			INSERT INTO users (restaurant_id, username, email, password_hash, full_name, role_id, status)
			SELECT $1, $2, $3, $4, $5, r.id, 'ACTIVE'
			FROM roles r
			WHERE r.name = $6 AND r.deleted_at IS NULL
			ON CONFLICT (restaurant_id, username) DO NOTHING
		`, restaurantID, u.username, u.username+"@demo.local", string(hash), u.fullName, u.role); err != nil {
			log.Error("seed user failed", slog.String("username", u.username), slog.Any("error", err))
			os.Exit(1)
		}
	}

	var areaID uuid.UUID
	if err := tx.QueryRow(ctx, `
		INSERT INTO areas (restaurant_id, name, description, display_order, is_active)
		VALUES ($1, 'Main Floor', 'Demo seating area', 1, TRUE)
		ON CONFLICT (restaurant_id, name) DO UPDATE SET updated_at = NOW()
		RETURNING id
	`, restaurantID).Scan(&areaID); err != nil {
		log.Error("seed area failed", slog.Any("error", err))
		os.Exit(1)
	}

	var tableID uuid.UUID
	if err := tx.QueryRow(ctx, `
		INSERT INTO tables (restaurant_id, area_id, code, name, capacity, status)
		VALUES ($1, $2, 'T01', 'Table 01', 4, 'AVAILABLE')
		ON CONFLICT (restaurant_id, code) DO UPDATE SET updated_at = NOW()
		RETURNING id
	`, restaurantID, areaID).Scan(&tableID); err != nil {
		log.Error("seed table failed", slog.Any("error", err))
		os.Exit(1)
	}

	var qrCodeID uuid.UUID
	if err := tx.QueryRow(ctx, `
		INSERT INTO qr_codes (restaurant_id, table_id, token, is_active)
		VALUES ($1, $2, 'DEMO-T01', TRUE)
		ON CONFLICT (token) DO UPDATE SET is_active = TRUE
		RETURNING id
	`, restaurantID, tableID).Scan(&qrCodeID); err != nil {
		log.Error("seed qr failed", slog.Any("error", err))
		os.Exit(1)
	}

	if err := seedMenu(ctx, tx, restaurantID); err != nil {
		log.Error("seed menu failed", slog.Any("error", err))
		os.Exit(1)
	}
	if err := seedPaymentMethods(ctx, tx, restaurantID); err != nil {
		log.Error("seed payment methods failed", slog.Any("error", err))
		os.Exit(1)
	}

	// Open a dining session bound to a fixed guest session token so the guest
	// menu/order endpoints (behind X-Session-Token) can be exercised without
	// wiring real staff auth. Demo only.
	for _, q := range []string{
		`DELETE FROM payments WHERE restaurant_id = $1`,
		`DELETE FROM invoice_items WHERE restaurant_id = $1`,
		`DELETE FROM invoices WHERE restaurant_id = $1`,
	} {
		if _, err := tx.Exec(ctx, q, restaurantID); err != nil {
			log.Error("clear demo billing failed", slog.Any("error", err))
			os.Exit(1)
		}
	}
	if _, err := tx.Exec(ctx, `DELETE FROM dining_sessions WHERE restaurant_id = $1 AND table_id = $2`, restaurantID, tableID); err != nil {
		log.Error("clear demo session failed", slog.Any("error", err))
		os.Exit(1)
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO dining_sessions (restaurant_id, table_id, qr_code_id, session_code, status, opened_via, session_token)
		VALUES ($1, $2, $3, 'DEMO-SESS-01', 'ACTIVE', 'QR_SCAN', $4)
	`, restaurantID, tableID, qrCodeID, demoSessionToken); err != nil {
		log.Error("seed dining session failed", slog.Any("error", err))
		os.Exit(1)
	}

	if err := tx.Commit(ctx); err != nil {
		log.Error("commit seed transaction failed", slog.Any("error", err))
		os.Exit(1)
	}

	fmt.Println("Seed complete")
	fmt.Printf("restaurant_code: %s\n", demoRestaurantCode)
	fmt.Printf("qr_token: %s  (guest entry: /order?t=DEMO-T01)\n", "DEMO-T01")
	fmt.Printf("session_token: %s  (X-Session-Token for /api/v1/guest/*)\n", demoSessionToken)
	fmt.Println("usernames:")
	for _, u := range demoUsers {
		fmt.Printf("- %s\n", u.username)
	}
}

const demoSessionToken = "DEMO-SESSION-T01"

// seedMenu replaces the demo restaurant's menu (categories, items, one variant
// set, one option group) idempotently so re-running the seed is safe.
func seedMenu(ctx context.Context, tx pgx.Tx, restaurantID uuid.UUID) error {
	for _, q := range []string{
		`DELETE FROM menu_item_option_groups WHERE restaurant_id = $1`,
		`DELETE FROM options WHERE restaurant_id = $1`,
		`DELETE FROM option_groups WHERE restaurant_id = $1`,
		`DELETE FROM menu_item_variants WHERE restaurant_id = $1`,
		`DELETE FROM menu_items WHERE restaurant_id = $1`,
		`DELETE FROM categories WHERE restaurant_id = $1`,
	} {
		if _, err := tx.Exec(ctx, q, restaurantID); err != nil {
			return err
		}
	}

	catRice, catDrink := uuid.New(), uuid.New()
	if _, err := tx.Exec(ctx, `
		INSERT INTO categories (id, restaurant_id, name, slug, description, icon, display_order, is_active) VALUES
		($1, $3, 'Cơm', 'com', 'Món cơm', '🍚', 1, TRUE),
		($2, $3, 'Đồ uống', 'do-uong', 'Thức uống', '🥤', 2, TRUE)
	`, catRice, catDrink, restaurantID); err != nil {
		return err
	}

	itemSuon, itemTra, itemCafe := uuid.New(), uuid.New(), uuid.New()
	if _, err := tx.Exec(ctx, `
		INSERT INTO menu_items (id, restaurant_id, category_id, code, name, slug, short_description, base_price_vnd, is_available, availability_status, station, status, display_order) VALUES
		($1, $4, $5, 'COM-SUON', 'Cơm tấm sườn nướng', 'com-tam-suon-nuong', 'Sườn nướng than hoa, cơm tấm dẻo', 55000, TRUE, 'AVAILABLE', 'GENERAL', 'PUBLISHED', 1),
		($2, $4, $6, 'TRA-DA',   'Trà đá',             'tra-da',              'Trà đá mát lạnh',                  5000,  TRUE, 'AVAILABLE', 'DRINK',   'PUBLISHED', 1),
		($3, $4, $6, 'CF-SUA',   'Cà phê sữa',         'ca-phe-sua',          'Cà phê phin truyền thống',         25000, TRUE, 'AVAILABLE', 'DRINK',   'PUBLISHED', 2)
	`, itemSuon, itemTra, itemCafe, restaurantID, catRice, catDrink); err != nil {
		return err
	}

	// Variants on the rice dish (default = Regular).
	if _, err := tx.Exec(ctx, `
		INSERT INTO menu_item_variants (restaurant_id, menu_item_id, name, sku, unit, price_vnd, is_default, is_available, display_order) VALUES
		($1, $2, 'Thường',     'COM-SUON-REG', 'phần', 55000, TRUE,  TRUE, 1),
		($1, $2, 'Đặc biệt',   'COM-SUON-SP',  'phần', 75000, FALSE, TRUE, 2)
	`, restaurantID, itemSuon); err != nil {
		return err
	}

	// One required single-select option group (sugar level) on the coffee.
	sugarGroup := uuid.New()
	if _, err := tx.Exec(ctx, `
		INSERT INTO option_groups (id, restaurant_id, name, selection_type, is_required, min_selections, max_selections, display_order)
		VALUES ($1, $2, 'Mức đường', 'SINGLE', TRUE, 1, 1, 1)
	`, sugarGroup, restaurantID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO options (restaurant_id, option_group_id, name, price_delta_vnd, is_default, is_available, display_order) VALUES
		($1, $2, 'Bình thường', 0, TRUE,  TRUE, 1),
		($1, $2, 'Ít đường',    0, FALSE, TRUE, 2),
		($1, $2, 'Nhiều đường', 0, FALSE, TRUE, 3)
	`, restaurantID, sugarGroup); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO menu_item_option_groups (restaurant_id, menu_item_id, option_group_id, display_order)
		VALUES ($1, $2, $3, 1)
	`, restaurantID, itemCafe, sugarGroup); err != nil {
		return err
	}

	return nil
}

func seedPaymentMethods(ctx context.Context, tx pgx.Tx, restaurantID uuid.UUID) error {
	methods := []struct {
		code         string
		name         string
		methodType   string
		displayOrder int
	}{
		{code: "cash", name: "Cash", methodType: "CASH", displayOrder: 1},
		{code: "card", name: "Card", methodType: "CARD", displayOrder: 2},
		{code: "momo", name: "MoMo", methodType: "E_WALLET", displayOrder: 3},
		{code: "zalopay", name: "ZaloPay", methodType: "E_WALLET", displayOrder: 4},
		{code: "vnpay", name: "VNPay", methodType: "E_WALLET", displayOrder: 5},
	}
	for _, method := range methods {
		if _, err := tx.Exec(ctx, `
			INSERT INTO payment_methods (restaurant_id, code, name, type, is_active, display_order)
			VALUES ($1, $2, $3, $4, TRUE, $5)
			ON CONFLICT (restaurant_id, code) DO UPDATE
			SET name = EXCLUDED.name,
			    type = EXCLUDED.type,
			    is_active = TRUE,
			    display_order = EXCLUDED.display_order,
			    updated_at = NOW()
		`, restaurantID, method.code, method.name, method.methodType, method.displayOrder); err != nil {
			return err
		}
	}
	return nil
}

func demoPassword() string {
	if v := os.Getenv(demoPasswordEnvVarName); v != "" {
		return v
	}
	return defaultDemoPassword
}
