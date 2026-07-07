// Command seed inserts demo data for a hotpot & grill restaurant: staff
// logins, areas, tables with one active QR code each, a full menu, payment
// methods, and a few open dining sessions so the guest QR flow can be
// demonstrated end to end. Re-running is safe (idempotent upserts; demo
// transactional data is cleared first).
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

type demoArea struct {
	name         string
	description  string
	displayOrder int
}

type demoTable struct {
	area     string
	code     string
	name     string
	capacity int
	// openSession opens an ACTIVE dining session bound to the fixed token
	// below so guests joining via QR land straight in the menu.
	openSession bool
}

var demoAreas = []demoArea{
	{name: "Tầng trệt", description: "Khu vực chính, gần quầy", displayOrder: 1},
	{name: "Tầng 2 - Sân vườn", description: "Khu sân vườn thoáng mát", displayOrder: 2},
	{name: "Phòng VIP", description: "Phòng riêng có máy lạnh", displayOrder: 3},
}

var demoTables = []demoTable{
	{area: "Tầng trệt", code: "T01", name: "Bàn 01", capacity: 4, openSession: true},
	{area: "Tầng trệt", code: "T02", name: "Bàn 02", capacity: 4},
	{area: "Tầng trệt", code: "T03", name: "Bàn 03", capacity: 6, openSession: true},
	{area: "Tầng trệt", code: "T04", name: "Bàn 04", capacity: 4},
	{area: "Tầng trệt", code: "T05", name: "Bàn 05", capacity: 2},
	{area: "Tầng trệt", code: "T06", name: "Bàn 06", capacity: 6},
	{area: "Tầng 2 - Sân vườn", code: "T07", name: "Bàn 07", capacity: 4},
	{area: "Tầng 2 - Sân vườn", code: "T08", name: "Bàn 08", capacity: 4},
	{area: "Tầng 2 - Sân vườn", code: "T09", name: "Bàn 09", capacity: 8},
	{area: "Tầng 2 - Sân vườn", code: "T10", name: "Bàn 10", capacity: 6},
	{area: "Phòng VIP", code: "V01", name: "VIP 01", capacity: 10, openSession: true},
	{area: "Phòng VIP", code: "V02", name: "VIP 02", capacity: 12},
}

func demoAreaNames() []string {
	names := make([]string, 0, len(demoAreas))
	for _, a := range demoAreas {
		names = append(names, a.name)
	}
	return names
}

// Deterministic demo tokens so re-seeding keeps printed QR codes valid.
func qrTokenFor(tableCode string) string { return "DEMO-" + tableCode }
func sessionTokenFor(tableCode string) string {
	return "DEMO-SESSION-" + tableCode
}
func sessionCodeFor(tableCode string) string { return "DEMO-SESS-" + tableCode }

func main() {
	ctx := context.Background()
	cfg := config.Load()
	log := logger.New(cfg.AppEnv, cfg.LogLevel, cfg.LogDir)

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
		VALUES ('Zenith Lẩu Nướng', $1, '86 Lê Lợi, Quận 1, TP. Hồ Chí Minh', '+84000000000', 'demo@example.com', 800, 500, 'ACTIVE')
		ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, address = EXCLUDED.address, updated_at = NOW()
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

	// Clear demo transactional data first. Deleting dining_sessions cascades
	// orders -> order_items -> kitchen tickets, which also unblocks replacing
	// menu_items (order_items.menu_item_id has no ON DELETE clause).
	for _, q := range []string{
		`DELETE FROM payments WHERE restaurant_id = $1`,
		`DELETE FROM invoice_items WHERE restaurant_id = $1`,
		`DELETE FROM invoices WHERE restaurant_id = $1`,
		`DELETE FROM dining_sessions WHERE restaurant_id = $1`,
	} {
		if _, err := tx.Exec(ctx, q, restaurantID); err != nil {
			log.Error("clear demo data failed", slog.String("query", q), slog.Any("error", err))
			os.Exit(1)
		}
	}

	areaIDs := map[string]uuid.UUID{}
	for _, a := range demoAreas {
		var id uuid.UUID
		if err := tx.QueryRow(ctx, `
			INSERT INTO areas (restaurant_id, name, description, display_order, is_active)
			VALUES ($1, $2, $3, $4, TRUE)
			ON CONFLICT (restaurant_id, name) DO UPDATE SET description = EXCLUDED.description, display_order = EXCLUDED.display_order, updated_at = NOW()
			RETURNING id
		`, restaurantID, a.name, a.description, a.displayOrder).Scan(&id); err != nil {
			log.Error("seed area failed", slog.String("area", a.name), slog.Any("error", err))
			os.Exit(1)
		}
		areaIDs[a.name] = id
	}

	// Tables: occupied when a demo session is opened below, otherwise free.
	tableIDs := map[string]uuid.UUID{}
	for _, t := range demoTables {
		status := "AVAILABLE"
		if t.openSession {
			status = "OCCUPIED"
		}
		var id uuid.UUID
		if err := tx.QueryRow(ctx, `
			INSERT INTO tables (restaurant_id, area_id, code, name, capacity, status)
			VALUES ($1, $2, $3, $4, $5, $6)
			ON CONFLICT (restaurant_id, code) DO UPDATE
			SET area_id = EXCLUDED.area_id, name = EXCLUDED.name, capacity = EXCLUDED.capacity, status = EXCLUDED.status, updated_at = NOW()
			RETURNING id
		`, restaurantID, areaIDs[t.area], t.code, t.name, t.capacity, status).Scan(&id); err != nil {
			log.Error("seed table failed", slog.String("table", t.code), slog.Any("error", err))
			os.Exit(1)
		}
		tableIDs[t.code] = id
	}

	// Drop leftover areas from older seeds (e.g. "Main Floor") so the floor
	// list shows exactly the demo areas. Only areas with no tables are safe
	// to delete; anything still referenced is left alone.
	if _, err := tx.Exec(ctx, `
		DELETE FROM areas a
		WHERE a.restaurant_id = $1
		  AND a.name <> ALL($2)
		  AND NOT EXISTS (
			SELECT 1 FROM tables t
			WHERE t.area_id = a.id AND t.deleted_at IS NULL
		  )
	`, restaurantID, demoAreaNames()); err != nil {
		log.Error("delete stale areas failed", slog.Any("error", err))
		os.Exit(1)
	}

	// One active QR per table with a deterministic token. Deactivate whatever
	// is active first so the partial unique index (one active QR per table)
	// never trips when a token was rotated from the UI between seed runs.
	if _, err := tx.Exec(ctx, `
		UPDATE qr_codes
		SET is_active = FALSE, deactivated_at = NOW(), deactivated_reason = 'reseeded'
		WHERE restaurant_id = $1 AND is_active = TRUE
	`, restaurantID); err != nil {
		log.Error("deactivate old qr codes failed", slog.Any("error", err))
		os.Exit(1)
	}
	qrIDs := map[string]uuid.UUID{}
	for _, t := range demoTables {
		var id uuid.UUID
		if err := tx.QueryRow(ctx, `
			INSERT INTO qr_codes (restaurant_id, table_id, token, is_active)
			VALUES ($1, $2, $3, TRUE)
			ON CONFLICT (token) DO UPDATE
			SET is_active = TRUE, activated_at = NOW(), deactivated_at = NULL, deactivated_reason = NULL
			RETURNING id
		`, restaurantID, tableIDs[t.code], qrTokenFor(t.code)).Scan(&id); err != nil {
			log.Error("seed qr failed", slog.String("table", t.code), slog.Any("error", err))
			os.Exit(1)
		}
		qrIDs[t.code] = id
	}

	if err := seedMenu(ctx, tx, restaurantID); err != nil {
		log.Error("seed menu failed", slog.Any("error", err))
		os.Exit(1)
	}
	if err := seedPaymentMethods(ctx, tx, restaurantID, cfg.AppEnv); err != nil {
		log.Error("seed payment methods failed", slog.Any("error", err))
		os.Exit(1)
	}

	// Open ACTIVE dining sessions bound to fixed guest session tokens so the
	// guest menu/order endpoints (behind X-Session-Token) can be exercised
	// without wiring real staff auth. Demo only.
	for _, t := range demoTables {
		if !t.openSession {
			continue
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO dining_sessions (restaurant_id, table_id, qr_code_id, session_code, status, opened_via, session_token)
			VALUES ($1, $2, $3, $4, 'ACTIVE', 'QR_SCAN', $5)
		`, restaurantID, tableIDs[t.code], qrIDs[t.code], sessionCodeFor(t.code), sessionTokenFor(t.code)); err != nil {
			log.Error("seed dining session failed", slog.String("table", t.code), slog.Any("error", err))
			os.Exit(1)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		log.Error("commit seed transaction failed", slog.Any("error", err))
		os.Exit(1)
	}

	fmt.Println("Seed complete")
	fmt.Printf("restaurant_code: %s\n", demoRestaurantCode)
	fmt.Println("usernames (password: demo1234 unless DEMO_SEED_PASSWORD set):")
	for _, u := range demoUsers {
		fmt.Printf("- %s\n", u.username)
	}
	fmt.Println("tables:")
	for _, t := range demoTables {
		line := fmt.Sprintf("- %-3s %-18s qr_token=%-9s guest: /order?t=%s", t.code, t.area, qrTokenFor(t.code), qrTokenFor(t.code))
		if t.openSession {
			line += fmt.Sprintf("  [ACTIVE session, X-Session-Token=%s]", sessionTokenFor(t.code))
		}
		fmt.Println(line)
	}
}

// seedMenu replaces the demo restaurant's hotpot & grill menu (categories,
// items, variants, option groups) idempotently so re-running is safe.
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

	type category struct {
		name, slug, description, icon string
	}
	categories := []category{
		{"Lẩu", "lau", "Nước lẩu và set lẩu", "🍲"},
		{"Món nướng", "mon-nuong", "Thịt nướng tại bàn", "🔥"},
		{"Hải sản", "hai-san", "Hải sản tươi nhúng lẩu hoặc nướng", "🦐"},
		{"Rau & Nấm", "rau-nam", "Rau, nấm, đậu và đồ nhúng", "🥬"},
		{"Khai vị", "khai-vi", "Món ăn chơi khai vị", "🥟"},
		{"Đồ uống", "do-uong", "Thức uống giải khát", "🥤"},
		{"Tráng miệng", "trang-mieng", "Món ngọt tráng miệng", "🍨"},
	}
	catIDs := map[string]uuid.UUID{}
	for i, c := range categories {
		id := uuid.New()
		if _, err := tx.Exec(ctx, `
			INSERT INTO categories (id, restaurant_id, name, slug, description, icon, display_order, is_active)
			VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
		`, id, restaurantID, c.name, c.slug, c.description, c.icon, i+1); err != nil {
			return err
		}
		catIDs[c.name] = id
	}

	type item struct {
		category, code, name, slug, description string
		priceVND                                int64
		station                                 string
	}
	items := []item{
		{"Lẩu", "LAU-THAI", "Lẩu Thái tomyum chua cay", "lau-thai-tomyum", "Nước lẩu Thái chua cay, sả, lá chanh, kèm rau nhúng", 269000, "HOTPOT"},
		{"Lẩu", "LAU-BO-MY", "Lẩu bò Mỹ nấm", "lau-bo-my-nam", "Nước dùng xương hầm, ba chỉ bò Mỹ, nấm tổng hợp", 329000, "HOTPOT"},
		{"Lẩu", "LAU-GA-LA-E", "Lẩu gà lá é", "lau-ga-la-e", "Gà ta, lá é Phú Yên, măng chua", 289000, "HOTPOT"},
		{"Lẩu", "LAU-HAI-SAN", "Lẩu hải sản chua cay", "lau-hai-san", "Tôm, mực, nghêu, cá viên, nước lẩu chua cay", 349000, "HOTPOT"},
		{"Món nướng", "BA-CHI-BO", "Ba chỉ bò Mỹ nướng", "ba-chi-bo-my-nuong", "Ba chỉ bò Mỹ thái lát, sốt mè rang", 149000, "GRILL"},
		{"Món nướng", "SUON-NUONG", "Sườn heo nướng mật ong", "suon-heo-nuong-mat-ong", "Sườn non ướp mật ong nướng than hoa", 159000, "GRILL"},
		{"Món nướng", "BO-CUON-NAM", "Bò cuộn nấm kim châm", "bo-cuon-nam-kim-cham", "Bò Mỹ cuộn nấm kim châm nướng sa tế", 129000, "GRILL"},
		{"Món nướng", "GA-NUONG", "Cánh gà nướng sa tế", "canh-ga-nuong-sa-te", "Cánh gà ướp sa tế nướng than", 119000, "GRILL"},
		{"Hải sản", "TOM-SU", "Tôm sú tươi (nhúng lẩu)", "tom-su-tuoi", "Tôm sú sống 300g, nhúng lẩu", 189000, "HOTPOT"},
		{"Hải sản", "MUC-NUONG", "Mực nướng sa tế", "muc-nuong-sa-te", "Mực ống tươi nướng sa tế cay", 179000, "GRILL"},
		{"Hải sản", "HAU-NUONG", "Hàu nướng phô mai", "hau-nuong-pho-mai", "Hàu sữa nướng phô mai mozzarella", 99000, "GRILL"},
		{"Rau & Nấm", "RAU-THAP-CAM", "Rau thập cẩm", "rau-thap-cam", "Đĩa rau nhúng lẩu theo mùa", 59000, "HOTPOT"},
		{"Rau & Nấm", "NAM-TONG-HOP", "Nấm tổng hợp", "nam-tong-hop", "Kim châm, đùi gà, bào ngư, linh chi nâu", 79000, "HOTPOT"},
		{"Rau & Nấm", "DAU-HU", "Đậu hũ trứng", "dau-hu-trung", "Đậu hũ trứng nhúng lẩu", 39000, "HOTPOT"},
		{"Rau & Nấm", "MI-TRUNG", "Mì trứng tươi", "mi-trung-tuoi", "Mì trứng tươi ăn kèm lẩu", 19000, "NOODLE"},
		{"Khai vị", "KHOAI-CHIEN", "Khoai tây chiên", "khoai-tay-chien", "Khoai tây chiên giòn, sốt tương cà", 49000, "GENERAL"},
		{"Khai vị", "NEM-RAN", "Nem chua rán", "nem-chua-ran", "Nem chua rán, tương ớt", 69000, "GENERAL"},
		{"Khai vị", "SALAD-BO", "Salad trộn bò Mỹ", "salad-tron-bo-my", "Xà lách, cà chua bi, bò Mỹ áp chảo", 89000, "GENERAL"},
		{"Đồ uống", "TRA-DA", "Trà đá", "tra-da", "Trà đá mát lạnh", 5000, "DRINK"},
		{"Đồ uống", "TRA-DAO", "Trà đào cam sả", "tra-dao-cam-sa", "Trà đào, cam vàng, sả tươi", 45000, "DRINK"},
		{"Đồ uống", "COCA", "Coca-Cola", "coca-cola", "Coca-Cola lon 330ml", 25000, "DRINK"},
		{"Đồ uống", "BIA-SG", "Bia Sài Gòn", "bia-sai-gon", "Bia Sài Gòn Special lon", 25000, "DRINK"},
		{"Tráng miệng", "KEM-VANI", "Kem vani", "kem-vani", "Kem vani 2 viên", 29000, "DESSERT"},
		{"Tráng miệng", "TRAI-CAY", "Đĩa trái cây", "dia-trai-cay", "Trái cây theo mùa", 59000, "DESSERT"},
	}
	itemIDs := map[string]uuid.UUID{}
	displayOrders := map[string]int{}
	for _, it := range items {
		id := uuid.New()
		displayOrders[it.category]++
		if _, err := tx.Exec(ctx, `
			INSERT INTO menu_items (id, restaurant_id, category_id, code, name, slug, short_description, base_price_vnd, is_available, availability_status, station, status, display_order)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, 'AVAILABLE', $9, 'PUBLISHED', $10)
		`, id, restaurantID, catIDs[it.category], it.code, it.name, it.slug, it.description, it.priceVND, it.station, displayOrders[it.category]); err != nil {
			return err
		}
		itemIDs[it.code] = id
	}

	// Size variants on the hotpot sets (default = small) and the oysters.
	type variant struct {
		itemCode, name, sku, unit string
		priceVND                  int64
		isDefault                 bool
		displayOrder              int
	}
	variants := []variant{
		{"LAU-THAI", "Nhỏ (2 người)", "LAU-THAI-S", "nồi", 269000, true, 1},
		{"LAU-THAI", "Lớn (4 người)", "LAU-THAI-L", "nồi", 399000, false, 2},
		{"LAU-BO-MY", "Nhỏ (2 người)", "LAU-BO-MY-S", "nồi", 329000, true, 1},
		{"LAU-BO-MY", "Lớn (4 người)", "LAU-BO-MY-L", "nồi", 459000, false, 2},
		{"LAU-HAI-SAN", "Nhỏ (2 người)", "LAU-HAI-SAN-S", "nồi", 349000, true, 1},
		{"LAU-HAI-SAN", "Lớn (4 người)", "LAU-HAI-SAN-L", "nồi", 489000, false, 2},
		{"HAU-NUONG", "6 con", "HAU-NUONG-6", "phần", 99000, true, 1},
		{"HAU-NUONG", "12 con", "HAU-NUONG-12", "phần", 185000, false, 2},
	}
	for _, v := range variants {
		if _, err := tx.Exec(ctx, `
			INSERT INTO menu_item_variants (restaurant_id, menu_item_id, name, sku, unit, price_vnd, is_default, is_available, display_order)
			VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8)
		`, restaurantID, itemIDs[v.itemCode], v.name, v.sku, v.unit, v.priceVND, v.isDefault, v.displayOrder); err != nil {
			return err
		}
	}

	// Required single-select spice level on every hotpot set.
	spiceGroup := uuid.New()
	if _, err := tx.Exec(ctx, `
		INSERT INTO option_groups (id, restaurant_id, name, selection_type, is_required, min_selections, max_selections, display_order)
		VALUES ($1, $2, 'Độ cay', 'SINGLE', TRUE, 1, 1, 1)
	`, spiceGroup, restaurantID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO options (restaurant_id, option_group_id, name, price_delta_vnd, is_default, is_available, display_order) VALUES
		($1, $2, 'Không cay',  0, FALSE, TRUE, 1),
		($1, $2, 'Cay vừa',    0, TRUE,  TRUE, 2),
		($1, $2, 'Cay nhiều',  0, FALSE, TRUE, 3)
	`, restaurantID, spiceGroup); err != nil {
		return err
	}
	for _, code := range []string{"LAU-THAI", "LAU-BO-MY", "LAU-GA-LA-E", "LAU-HAI-SAN"} {
		if _, err := tx.Exec(ctx, `
			INSERT INTO menu_item_option_groups (restaurant_id, menu_item_id, option_group_id, display_order)
			VALUES ($1, $2, $3, 1)
		`, restaurantID, itemIDs[code], spiceGroup); err != nil {
			return err
		}
	}

	// Optional sweetness level on the peach tea.
	sugarGroup := uuid.New()
	if _, err := tx.Exec(ctx, `
		INSERT INTO option_groups (id, restaurant_id, name, selection_type, is_required, min_selections, max_selections, display_order)
		VALUES ($1, $2, 'Mức đường', 'SINGLE', TRUE, 1, 1, 2)
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
	`, restaurantID, itemIDs["TRA-DAO"], sugarGroup); err != nil {
		return err
	}

	return nil
}

func seedPaymentMethods(ctx context.Context, tx pgx.Tx, restaurantID uuid.UUID, appEnv string) error {
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
	if appEnv != "production" {
		methods = append(methods, struct {
			code         string
			name         string
			methodType   string
			displayOrder int
		}{code: "mock", name: "Mock Wallet", methodType: "E_WALLET", displayOrder: 6})
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
