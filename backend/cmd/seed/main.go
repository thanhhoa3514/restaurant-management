// Command seed inserts demo data for a hotpot & grill restaurant: staff
// logins, areas, tables with one active QR code each, a full menu, payment
// methods, and a few open dining sessions so the guest QR flow can be
// demonstrated end to end. Re-running is safe (idempotent upserts; demo
// transactional data is cleared first).
//
// DEPENDENCY: cmd/setup must have been run at least once (or seed must find
// an existing restaurant by code "DEMO"). See cmd/setup for production use.
package main

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"restaurant-management/internal/platform/config"
	"restaurant-management/internal/platform/logger"
	"restaurant-management/internal/platform/postgres"
	"restaurant-management/internal/platform/setup"
)

const (
	demoRestaurantCode     = "DEMO"
	defaultDemoPassword    = "demo1234"
	demoPasswordEnvVarName = "DEMO_SEED_PASSWORD"
	menuSeedOnlyEnvVarName = "MENU_SEED_ONLY"
)

var demoUsers = []setup.UserConfig{
	{Username: "manager", FullName: "Demo Manager", Role: "manager", Password: defaultDemoPassword},
	{Username: "cashier", FullName: "Demo Cashier", Role: "cashier", Password: defaultDemoPassword},
	{Username: "server", FullName: "Demo Server", Role: "server", Password: defaultDemoPassword},
	{Username: "kitchen", FullName: "Demo Kitchen", Role: "kitchen", Password: defaultDemoPassword},
}

var demoAreas = []setup.AreaConfig{
	{Name: "Tầng trệt", Description: "Khu vực chính, gần quầy", DisplayOrder: 1},
	{Name: "Tầng 2 - Sân vườn", Description: "Khu sân vườn thoáng mát", DisplayOrder: 2},
	{Name: "Phòng VIP", Description: "Phòng riêng có máy lạnh", DisplayOrder: 3},
}

var demoTables = []setup.TableConfig{
	{AreaName: "Tầng trệt", Code: "T01", Name: "Bàn 01", Capacity: 4},
	{AreaName: "Tầng trệt", Code: "T02", Name: "Bàn 02", Capacity: 4},
	{AreaName: "Tầng trệt", Code: "T03", Name: "Bàn 03", Capacity: 6},
	{AreaName: "Tầng trệt", Code: "T04", Name: "Bàn 04", Capacity: 4},
	{AreaName: "Tầng trệt", Code: "T05", Name: "Bàn 05", Capacity: 2},
	{AreaName: "Tầng trệt", Code: "T06", Name: "Bàn 06", Capacity: 6},
	{AreaName: "Tầng 2 - Sân vườn", Code: "T07", Name: "Bàn 07", Capacity: 4},
	{AreaName: "Tầng 2 - Sân vườn", Code: "T08", Name: "Bàn 08", Capacity: 4},
	{AreaName: "Tầng 2 - Sân vườn", Code: "T09", Name: "Bàn 09", Capacity: 8},
	{AreaName: "Tầng 2 - Sân vườn", Code: "T10", Name: "Bàn 10", Capacity: 6},
	{AreaName: "Phòng VIP", Code: "V01", Name: "VIP 01", Capacity: 10},
	{AreaName: "Phòng VIP", Code: "V02", Name: "VIP 02", Capacity: 12},
}

// Tables that get an open demo dining session.
var demoSessions = map[string]bool{
	"T01": true,
	"T03": true,
	"V01": true,
}

func deviceAccessTokenFor(tableCode string) string { return "DEMO-DEVICE-" + tableCode }
func sessionCodeFor(tableCode string) string       { return "DEMO-SESS-" + tableCode }

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

	// ── Restaurant ──────────────────────────────────────────────
	password := os.Getenv(demoPasswordEnvVarName)
	if password == "" {
		password = defaultDemoPassword
	}
	// Use the shared password from env for all demo users.
	for i := range demoUsers {
		demoUsers[i].Password = password
	}

	rid, err := setup.EnsureRestaurant(ctx, tx, setup.RestaurantConfig{
		Code:                     demoRestaurantCode,
		Name:                     "Zenith Lẩu Nướng",
		Address:                  "86 Lê Lợi, Quận 1, TP. Hồ Chí Minh",
		Phone:                    "+84000000000",
		Email:                    "demo@example.com",
		VatRateBasisPoints:       800,
		ServiceChargeBasisPoints: 500,
	})
	if err != nil {
		log.Error("seed restaurant failed", slog.Any("error", err))
		os.Exit(1)
	}

	if os.Getenv(menuSeedOnlyEnvVarName) == "true" {
		if err := seedMenuAdditive(ctx, tx, rid); err != nil {
			log.Error("additive menu seed failed", slog.Any("error", err))
			os.Exit(1)
		}
		if err := tx.Commit(ctx); err != nil {
			log.Error("commit additive menu seed failed", slog.Any("error", err))
			os.Exit(1)
		}
		fmt.Println("Additive menu seed complete: existing menu and transactions were preserved")
		return
	}

	// ── Users ──────────────────────────────────────────────────
	if err := setup.EnsureUsers(ctx, tx, rid, demoUsers); err != nil {
		log.Error("seed users failed", slog.Any("error", err))
		os.Exit(1)
	}

	// ── Clear demo transactional data ─────────────────────────
	// This must happen BEFORE seeding menu items so that the FK on
	// order_items.menu_item_id (which has no ON DELETE CASCADE) doesn't
	// block menu re-creation.
	if err := setup.ClearTransactionalData(ctx, tx, rid); err != nil {
		log.Error("clear demo data failed", slog.Any("error", err))
		os.Exit(1)
	}

	// ── Areas & Tables ─────────────────────────────────────────
	// Mark demo session tables as OCCUPIED so the initial table state is
	// realistic.
	_, tableIDs, err := setup.EnsureAreasAndTables(ctx, tx, rid, demoAreas, demoTables)
	if err != nil {
		log.Error("seed areas/tables failed", slog.Any("error", err))
		os.Exit(1)
	}

	// Override table status for demo sessions.
	for code, open := range demoSessions {
		if !open {
			continue
		}
		id, ok := tableIDs[code]
		if !ok {
			continue
		}
		if _, err := tx.Exec(ctx, `UPDATE tables SET status = 'OCCUPIED' WHERE id = $1`, id); err != nil {
			log.Error("mark table occupied failed", slog.String("table", code), slog.Any("error", err))
			os.Exit(1)
		}
	}

	// ── QR Codes ───────────────────────────────────────────────
	qrTokens, err := setup.EnsureQRCodes(ctx, tx, rid, tableIDs)
	if err != nil {
		log.Error("seed qr codes failed", slog.Any("error", err))
		os.Exit(1)
	}

	// ── Menu ───────────────────────────────────────────────────
	if err := seedMenu(ctx, tx, rid); err != nil {
		log.Error("seed menu failed", slog.Any("error", err))
		os.Exit(1)
	}

	// ── Payment Methods ────────────────────────────────────────
	if err := setup.SeedPaymentMethods(ctx, tx, rid, false); err != nil {
		log.Error("seed payment methods failed", slog.Any("error", err))
		os.Exit(1)
	}

	// ── Demo Dining Sessions ───────────────────────────────────
	// Open ACTIVE sessions bound to deterministic approved device tokens so
	// demo guests can jump straight into the menu without real staff auth.
	for _, t := range demoTables {
		if !demoSessions[t.Code] {
			continue
		}
		if _, err := tx.Exec(ctx, `
			WITH created_session AS (
				INSERT INTO dining_sessions (restaurant_id, table_id, session_code, status, opened_via)
				VALUES ($1, (SELECT id FROM tables WHERE restaurant_id = $1 AND code = $2 LIMIT 1),
				        $3, 'ACTIVE', 'QR_SCAN')
				RETURNING id, restaurant_id
			)
			INSERT INTO session_devices (
				restaurant_id, session_id, device_id, guest_name, status,
				access_token, is_owner, approved_at
			)
			SELECT restaurant_id, id, 'seed:' || $2, 'Demo guest', 'APPROVED',
			       $4, TRUE, NOW()
			FROM created_session
		`, rid, t.Code, sessionCodeFor(t.Code), deviceAccessTokenFor(t.Code)); err != nil {
			log.Error("seed dining session failed",
				slog.String("table", t.Code),
				slog.Any("error", err),
			)
			os.Exit(1)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		log.Error("commit seed transaction failed", slog.Any("error", err))
		os.Exit(1)
	}

	fmt.Println()
	fmt.Println("══════════════════════════════════════════════")
	fmt.Println("  SEED COMPLETE (DEMO MODE)")
	fmt.Println("══════════════════════════════════════════════")
	fmt.Printf("  Restaurant:   %s (code: %s)\n", "Zenith Lẩu Nướng", demoRestaurantCode)
	fmt.Println("  Usernames (password:", password, "):")
	for _, u := range demoUsers {
		fmt.Printf("    - %s  (%s)\n", u.Username, u.FullName)
	}
	fmt.Printf("  Tables:       %d\n", len(demoTables))
	fmt.Printf("  QR codes:     %d\n", len(qrTokens))
	fmt.Println()
	fmt.Println("  Table QR tokens:")
	for _, t := range demoTables {
		line := fmt.Sprintf("    %-4s  %-16s  token=%s", t.Code, t.Name, qrTokens[t.Code])
		if demoSessions[t.Code] {
			line += fmt.Sprintf("  [ACTIVE session, X-Device-Access-Token=%s]", deviceAccessTokenFor(t.Code))
		}
		fmt.Println(line)
	}
	fmt.Println("══════════════════════════════════════════════")
}

// ──────────────────────────────────────────────
// Demo menu seeding (unchanged from original)
// ──────────────────────────────────────────────

// seedMenuAdditive adds the newly introduced catalog records without touching
// existing menu, order, invoice, payment, or session data. It is intentionally
// separate from seedMenu because the latter resets the complete demo dataset.
func seedMenuAdditive(ctx context.Context, tx pgx.Tx, restaurantID uuid.UUID) error {
	type category struct {
		name, slug, description, icon, image string
	}
	categories := []category{
		{"Lẩu", "lau", "Nước lẩu và set lẩu", "🍲", "/images/menu/lau-thai-tomyum.webp?v=20260723"},
		{"Món nướng", "mon-nuong", "Thịt nướng tại bàn", "🔥", "/images/menu/ba-chi-bo-my-nuong.webp?v=20260723"},
		{"Hải sản", "hai-san", "Hải sản tươi nhúng lẩu hoặc nướng", "🦐", "/images/menu/tom-su-tuoi.webp?v=20260723b"},
		{"Rau & Nấm", "rau-nam", "Rau, nấm, đậu và đồ nhúng", "🥬", "/images/menu/rau-thap-cam.webp?v=20260723b"},
		{"Khai vị", "khai-vi", "Món ăn chơi khai vị", "🥟", "/images/menu/khoai-tay-chien.webp?v=20260723b"},
		{"Đồ uống", "do-uong", "Thức uống giải khát", "🥤", "/images/menu/tra-dao-cam-sa.webp?v=20260723b"},
		{"Tráng miệng", "trang-mieng", "Món ngọt tráng miệng", "🍨", "/images/menu/kem-vani.webp?v=20260723b"},
	}
	catIDs := map[string]uuid.UUID{}
	for _, c := range categories {
		var id uuid.UUID
		if err := tx.QueryRow(ctx, `
			INSERT INTO categories (id, restaurant_id, name, slug, description, icon, image_url, display_order, is_active)
			VALUES ($1, $2, $3, $4, $5, $6, $7,
				COALESCE((SELECT MAX(display_order) + 1 FROM categories WHERE restaurant_id = $2), 1), TRUE)
			ON CONFLICT (restaurant_id, slug) DO UPDATE SET slug = EXCLUDED.slug
			RETURNING id
		`, uuid.New(), restaurantID, c.name, c.slug, c.description, c.icon, c.image).Scan(&id); err != nil {
			return fmt.Errorf("ensure category %s: %w", c.name, err)
		}
		catIDs[c.name] = id
	}

	type item struct {
		category, code, name, slug, description, image string
		priceVND                                       int64
		station                                        string
		isFeatured                                     bool
	}
	items := []item{
		{"Lẩu", "LAU-RIEU-CUA", "Lẩu riêu cua bắp bò", "lau-rieu-cua-bap-bo", "Riêu cua đồng, bắp bò, sườn sụn, cà chua, giấm bỗng", "/images/menu/lau-rieu-cua-bap-bo.webp?v=20260808", 359000, "HOTPOT", false},
		{"Lẩu", "LAU-TU-XUYEN", "Lẩu Tứ Xuyên cay tê", "lau-tu-xuyen-cay-te", "Nước lẩu mala cay tê, hạt tê, ớt khô Tứ Xuyên", "/images/menu/lau-tu-xuyen-cay-te.webp?v=20260808", 319000, "HOTPOT", false},
		{"Lẩu", "LAU-NAM-CHAY", "Lẩu nấm chay dưỡng sinh", "lau-nam-chay-duong-sinh", "Nước hầm nấm và rau củ, các loại nấm tươi, đậu hũ", "/images/menu/lau-nam-chay-duong-sinh.webp?v=20260808", 239000, "HOTPOT", false},
		{"Lẩu", "LAU-CA-KEO", "Lẩu cá kèo lá giang", "lau-ca-keo-la-giang", "Cá kèo tươi, lá giang chua thanh, rau đắng", "/images/menu/lau-ca-keo-la-giang.webp?v=20260808", 299000, "HOTPOT", false},
		{"Món nướng", "NAC-VAI-HEO", "Nạc vai heo nướng riềng mẻ", "nac-vai-heo-nuong-rieng-me", "Nạc vai heo ướp riềng mẻ nướng than hoa", "/images/menu/nac-vai-heo-nuong-rieng-me.webp?v=20260808", 139000, "GRILL", false},
		{"Món nướng", "NAM-BO-NUONG", "Nầm bò nướng", "nam-bo-nuong", "Nầm bò tươi ướp sa tế, nướng giòn", "/images/menu/nam-bo-nuong.webp?v=20260808", 149000, "GRILL", false},
		{"Món nướng", "SUN-GA-NUONG", "Sụn gà nướng muối ớt", "sun-ga-nuong-muoi-ot", "Sụn gà giòn ướp muối ớt xanh", "/images/menu/sun-ga-nuong-muoi-ot.webp?v=20260808", 109000, "GRILL", false},
		{"Món nướng", "XUC-XICH-NUONG", "Xúc xích Đức nướng", "xuc-xich-duc-nuong", "Xúc xích Đức nướng, sốt mù tạt mật ong", "/images/menu/xuc-xich-duc-nuong.webp?v=20260808", 89000, "GRILL", false},
		{"Hải sản", "NGHEU-NHUNG", "Nghêu tươi (nhúng lẩu)", "ngheu-tuoi-nhung-lau", "Nghêu sống 500g, nhúng lẩu ngọt nước", "/images/menu/ngheu-tuoi-nhung-lau.webp?v=20260808", 89000, "HOTPOT", false},
		{"Hải sản", "SO-DIEP-NUONG", "Sò điệp nướng mỡ hành", "so-diep-nuong-mo-hanh", "Sò điệp nướng mỡ hành, đậu phộng rang", "/images/menu/so-diep-nuong-mo-hanh.webp?v=20260808", 159000, "GRILL", false},
		{"Hải sản", "BACH-TUOC-NUONG", "Bạch tuộc nướng sa tế", "bach-tuoc-nuong-sa-te", "Bạch tuộc baby nướng sa tế cay", "/images/menu/bach-tuoc-nuong-sa-te.webp?v=20260808", 169000, "GRILL", false},
		{"Hải sản", "CA-VIEN-THA", "Cá viên thả lẩu", "ca-vien-tha-lau", "Đĩa cá viên, bò viên, tôm viên thả lẩu", "/images/menu/ca-vien-tha-lau.webp?v=20260808", 79000, "HOTPOT", false},
		{"Rau & Nấm", "RAU-MUONG", "Rau muống bào", "rau-muong-bao", "Rau muống bào giòn nhúng lẩu", "/images/menu/rau-muong-bao.webp?v=20260808", 45000, "HOTPOT", false},
		{"Rau & Nấm", "CAI-THAO", "Cải thảo", "cai-thao", "Cải thảo tươi cắt khúc nhúng lẩu", "/images/menu/cai-thao.webp?v=20260808", 39000, "HOTPOT", false},
		{"Rau & Nấm", "NGO-NGOT", "Ngô ngọt Mỹ", "ngo-ngot-my", "Ngô ngọt cắt khúc, ngọt nước lẩu", "/images/menu/ngo-ngot-my.webp?v=20260808", 35000, "HOTPOT", false},
		{"Rau & Nấm", "VANG-DAU", "Váng đậu tươi", "vang-dau-tuoi", "Váng đậu non thả lẩu", "/images/menu/vang-dau-tuoi.webp?v=20260808", 49000, "HOTPOT", false},
		{"Rau & Nấm", "KHOAI-MON", "Khoai môn", "khoai-mon-thai-lat", "Khoai môn thái lát, bùi ngọt", "/images/menu/khoai-mon-thai-lat.webp?v=20260808", 39000, "HOTPOT", false},
		{"Khai vị", "CHA-GIO-HS", "Chả giò hải sản", "cha-gio-hai-san", "Chả giò cuộn tôm mực, chiên giòn", "/images/menu/cha-gio-hai-san.webp?v=20260808", 79000, "GENERAL", false},
		{"Khai vị", "CANH-GA-MAM", "Cánh gà chiên nước mắm", "canh-ga-chien-nuoc-mam", "Cánh gà chiên giòn rưới nước mắm tỏi", "/images/menu/canh-ga-chien-nuoc-mam.webp?v=20260808", 89000, "GENERAL", false},
		{"Khai vị", "DAU-BAP-NUONG", "Đậu bắp nướng mỡ hành", "dau-bap-nuong-mo-hanh", "Đậu bắp nướng than, mỡ hành", "/images/menu/dau-bap-nuong-mo-hanh.webp?v=20260808", 45000, "GRILL", false},
		{"Đồ uống", "BIA-TIGER", "Bia Tiger", "bia-tiger", "Bia Tiger lon 330ml", "/images/menu/bia-tiger.webp?v=20260808", 28000, "DRINK", false},
		{"Đồ uống", "NUOC-SUOI", "Nước suối", "nuoc-suoi", "Nước khoáng đóng chai 500ml", "/images/menu/nuoc-suoi.webp?v=20260808", 15000, "DRINK", false},
		{"Đồ uống", "7UP", "7 Up", "7up", "7 Up lon 330ml", "/images/menu/7up.webp?v=20260808", 25000, "DRINK", false},
		{"Đồ uống", "TRA-TAC", "Trà tắc", "tra-tac", "Trà tắc mật ong đá", "/images/menu/tra-tac.webp?v=20260808", 35000, "DRINK", false},
		{"Đồ uống", "CAM-EP", "Nước cam ép", "nuoc-cam-ep", "Cam vắt nguyên chất, không đường", "/images/menu/nuoc-cam-ep.webp?v=20260808", 49000, "DRINK", false},
		{"Tráng miệng", "CHE-KHUC-BACH", "Chè khúc bạch", "che-khuc-bach", "Khúc bạch phô mai, hạnh nhân, nhãn", "/images/menu/che-khuc-bach.webp?v=20260808", 39000, "DESSERT", false},
		{"Tráng miệng", "RAU-CAU-DUA", "Rau câu dừa", "rau-cau-dua", "Rau câu nước cốt dừa mát lạnh", "/images/menu/rau-cau-dua.webp?v=20260808", 29000, "DESSERT", false},
	}

	displayOrders := map[string]int{}
	for name, categoryID := range catIDs {
		var maxDisplayOrder int
		if err := tx.QueryRow(ctx, `SELECT COALESCE(MAX(display_order), 0) FROM menu_items WHERE restaurant_id = $1 AND category_id = $2`, restaurantID, categoryID).Scan(&maxDisplayOrder); err != nil {
			return fmt.Errorf("read display order for %s: %w", name, err)
		}
		displayOrders[name] = maxDisplayOrder
	}
	itemIDs := map[string]uuid.UUID{}
	for _, it := range items {
		displayOrders[it.category]++
		gallery, err := json.Marshal([]string{it.image})
		if err != nil {
			return fmt.Errorf("marshal image for %s: %w", it.code, err)
		}
		var id uuid.UUID
		if err := tx.QueryRow(ctx, `
			INSERT INTO menu_items (id, restaurant_id, category_id, code, name, slug, short_description, base_price_vnd, image_url, images, is_available, availability_status, station, status, display_order, is_featured)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, 'AVAILABLE', $11, 'PUBLISHED', $12, $13)
			ON CONFLICT (restaurant_id, code) DO UPDATE SET image_url = EXCLUDED.image_url, images = EXCLUDED.images, updated_at = NOW()
			RETURNING id
		`, uuid.New(), restaurantID, catIDs[it.category], it.code, it.name, it.slug, it.description, it.priceVND, it.image, gallery, it.station, displayOrders[it.category], it.isFeatured).Scan(&id); err != nil {
			return fmt.Errorf("upsert menu item %s: %w", it.code, err)
		}
		itemIDs[it.code] = id
	}

	type variant struct {
		itemCode, name, sku, unit string
		priceVND                  int64
		isDefault                 bool
		displayOrder              int
	}
	variants := []variant{
		{"LAU-RIEU-CUA", "Nhỏ (2 người)", "LAU-RIEU-CUA-S", "nồi", 359000, true, 1},
		{"LAU-RIEU-CUA", "Lớn (4 người)", "LAU-RIEU-CUA-L", "nồi", 499000, false, 2},
		{"LAU-TU-XUYEN", "Nhỏ (2 người)", "LAU-TU-XUYEN-S", "nồi", 319000, true, 1},
		{"LAU-TU-XUYEN", "Lớn (4 người)", "LAU-TU-XUYEN-L", "nồi", 449000, false, 2},
		{"LAU-NAM-CHAY", "Nhỏ (2 người)", "LAU-NAM-CHAY-S", "nồi", 239000, true, 1},
		{"LAU-NAM-CHAY", "Lớn (4 người)", "LAU-NAM-CHAY-L", "nồi", 349000, false, 2},
		{"LAU-CA-KEO", "Nhỏ (2 người)", "LAU-CA-KEO-S", "nồi", 299000, true, 1},
		{"LAU-CA-KEO", "Lớn (4 người)", "LAU-CA-KEO-L", "nồi", 419000, false, 2},
	}
	for _, v := range variants {
		if _, err := tx.Exec(ctx, `
			INSERT INTO menu_item_variants (restaurant_id, menu_item_id, name, sku, unit, price_vnd, is_default, is_available, display_order)
			VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8)
			ON CONFLICT (restaurant_id, sku) DO NOTHING
		`, restaurantID, itemIDs[v.itemCode], v.name, v.sku, v.unit, v.priceVND, v.isDefault, v.displayOrder); err != nil {
			return fmt.Errorf("upsert variant %s: %w", v.sku, err)
		}
	}

	// Reuse the existing option groups when present. No option or link is
	// deleted, and repeated additive runs remain idempotent.
	for _, group := range []struct {
		name, itemCode string
		displayOrder   int
	}{
		{"Độ cay", "LAU-RIEU-CUA", 1},
		{"Độ cay", "LAU-TU-XUYEN", 1},
		{"Độ cay", "LAU-NAM-CHAY", 1},
		{"Độ cay", "LAU-CA-KEO", 1},
		{"Topping thêm", "LAU-RIEU-CUA", 2},
		{"Topping thêm", "LAU-TU-XUYEN", 2},
		{"Topping thêm", "LAU-NAM-CHAY", 2},
		{"Topping thêm", "LAU-CA-KEO", 2},
	} {
		var groupID uuid.UUID
		err := tx.QueryRow(ctx, `SELECT id FROM option_groups WHERE restaurant_id = $1 AND name = $2 AND deleted_at IS NULL ORDER BY created_at LIMIT 1`, restaurantID, group.name).Scan(&groupID)
		if errors.Is(err, pgx.ErrNoRows) {
			continue
		}
		if err != nil {
			return fmt.Errorf("find option group %s: %w", group.name, err)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO menu_item_option_groups (restaurant_id, menu_item_id, option_group_id, display_order)
			VALUES ($1, $2, $3, $4)
			ON CONFLICT (restaurant_id, menu_item_id, option_group_id) DO NOTHING
		`, restaurantID, itemIDs[group.itemCode], groupID, group.displayOrder); err != nil {
			return fmt.Errorf("link option group %s: %w", group.name, err)
		}
	}

	type comboComponent struct {
		code     string
		quantity int
	}
	combos := []struct {
		code, name, slug, description, image string
		priceVND                             int64
		isFeatured                           bool
		components                           []comboComponent
	}{
		{"COMBO-NUONG-4", "Set Nướng nhóm 4", "set-nuong-nhom-4", "Combo nướng cho nhóm 4 người: ba chỉ bò Mỹ, hàu nướng phô mai, lẩu Thái và trà đào cam sả.", "/images/menu/combo-set-nuong-nhom-4.webp?v=20260808", 990000, true, []comboComponent{{"BA-CHI-BO", 2}, {"HAU-NUONG", 4}, {"LAU-THAI", 1}, {"TRA-DAO", 4}}},
		{"COMBO-LAU-2", "Set Lẩu nhóm 2", "set-lau-nhom-2", "Combo lẩu cho 2 người: lẩu bò Mỹ nấm, tôm sú, rau thập cẩm, nấm tổng hợp, mì trứng và trà đào.", "/images/menu/combo-set-lau-nhom-2.webp?v=20260808", 690000, true, []comboComponent{{"LAU-BO-MY", 1}, {"TOM-SU", 1}, {"RAU-THAP-CAM", 1}, {"NAM-TONG-HOP", 1}, {"MI-TRUNG", 2}, {"TRA-DAO", 2}}},
	}
	for i, combo := range combos {
		var comboID uuid.UUID
		if err := tx.QueryRow(ctx, `
			INSERT INTO combos (id, restaurant_id, code, name, slug, description, image_url, combo_price_vnd, status, availability_status, is_featured, display_order, version)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PUBLISHED', 'AVAILABLE', $9, $10, 1)
			ON CONFLICT (restaurant_id, code) DO UPDATE SET image_url = EXCLUDED.image_url, updated_at = NOW()
			RETURNING id
		`, uuid.New(), restaurantID, combo.code, combo.name, combo.slug, combo.description, combo.image, combo.priceVND, combo.isFeatured, i+1).Scan(&comboID); err != nil {
			return fmt.Errorf("upsert combo %s: %w", combo.code, err)
		}
		for i, component := range combo.components {
			var itemID uuid.UUID
			if err := tx.QueryRow(ctx, `SELECT id FROM menu_items WHERE restaurant_id = $1 AND code = $2`, restaurantID, component.code).Scan(&itemID); err != nil {
				return fmt.Errorf("find combo component %s: %w", component.code, err)
			}
			if _, err := tx.Exec(ctx, `
				INSERT INTO combo_items (id, restaurant_id, combo_id, menu_item_id, quantity, display_order)
				SELECT $1, $2, $3, $4, $5, $6
				WHERE NOT EXISTS (SELECT 1 FROM combo_items WHERE restaurant_id = $2 AND combo_id = $3 AND menu_item_id = $4)
			`, uuid.New(), restaurantID, comboID, itemID, component.quantity, i+1); err != nil {
				return fmt.Errorf("link combo component %s: %w", component.code, err)
			}
		}
	}

	return nil
}

func seedMenu(ctx context.Context, tx pgx.Tx, restaurantID uuid.UUID) error {
	if err := setup.ClearMenuData(ctx, tx, restaurantID); err != nil {
		return err
	}

	// Item-specific generated photos live in the frontend public directory and
	// are served from the same origin as the application.
	generatedItemImages := map[string]string{
		"LAU-THAI":        "/images/menu/lau-thai-tomyum.webp?v=20260723",
		"LAU-BO-MY":       "/images/menu/lau-bo-my-nam.webp?v=20260723",
		"LAU-GA-LA-E":     "/images/menu/lau-ga-la-e.webp?v=20260723",
		"LAU-HAI-SAN":     "/images/menu/lau-hai-san.webp?v=20260723",
		"BA-CHI-BO":       "/images/menu/ba-chi-bo-my-nuong.webp?v=20260723",
		"SUON-NUONG":      "/images/menu/suon-heo-nuong-mat-ong.webp?v=20260723",
		"BO-CUON-NAM":     "/images/menu/bo-cuon-nam-kim-cham.webp?v=20260723",
		"GA-NUONG":        "/images/menu/canh-ga-nuong-sa-te.webp?v=20260723",
		"TOM-SU":          "/images/menu/tom-su-tuoi.webp?v=20260723b",
		"MUC-NUONG":       "/images/menu/muc-nuong-sa-te.webp?v=20260723b",
		"HAU-NUONG":       "/images/menu/hau-nuong-pho-mai.webp?v=20260723b",
		"RAU-THAP-CAM":    "/images/menu/rau-thap-cam.webp?v=20260723b",
		"NAM-TONG-HOP":    "/images/menu/nam-tong-hop.webp?v=20260723b",
		"DAU-HU":          "/images/menu/dau-hu-trung.webp?v=20260723b",
		"MI-TRUNG":        "/images/menu/mi-trung-tuoi.webp?v=20260723b",
		"KHOAI-CHIEN":     "/images/menu/khoai-tay-chien.webp?v=20260723b",
		"NEM-RAN":         "/images/menu/nem-chua-ran.webp?v=20260723b",
		"SALAD-BO":        "/images/menu/salad-tron-bo-my.webp?v=20260723b",
		"TRA-DA":          "/images/menu/tra-da.webp?v=20260723b",
		"TRA-DAO":         "/images/menu/tra-dao-cam-sa.webp?v=20260723b",
		"COCA":            "/images/menu/coca-cola.webp?v=20260723b",
		"BIA-SG":          "/images/menu/bia-sai-gon.webp?v=20260723b",
		"KEM-VANI":        "/images/menu/kem-vani.webp?v=20260723b",
		"TRAI-CAY":        "/images/menu/dia-trai-cay.webp?v=20260723b",
		"LAU-RIEU-CUA":    "/images/menu/lau-rieu-cua-bap-bo.webp?v=20260808",
		"LAU-TU-XUYEN":    "/images/menu/lau-tu-xuyen-cay-te.webp?v=20260808",
		"LAU-NAM-CHAY":    "/images/menu/lau-nam-chay-duong-sinh.webp?v=20260808",
		"LAU-CA-KEO":      "/images/menu/lau-ca-keo-la-giang.webp?v=20260808",
		"NAC-VAI-HEO":     "/images/menu/nac-vai-heo-nuong-rieng-me.webp?v=20260808",
		"NAM-BO-NUONG":    "/images/menu/nam-bo-nuong.webp?v=20260808",
		"SUN-GA-NUONG":    "/images/menu/sun-ga-nuong-muoi-ot.webp?v=20260808",
		"XUC-XICH-NUONG":  "/images/menu/xuc-xich-duc-nuong.webp?v=20260808",
		"NGHEU-NHUNG":     "/images/menu/ngheu-tuoi-nhung-lau.webp?v=20260808",
		"SO-DIEP-NUONG":   "/images/menu/so-diep-nuong-mo-hanh.webp?v=20260808",
		"BACH-TUOC-NUONG": "/images/menu/bach-tuoc-nuong-sa-te.webp?v=20260808",
		"CA-VIEN-THA":     "/images/menu/ca-vien-tha-lau.webp?v=20260808",
		"RAU-MUONG":       "/images/menu/rau-muong-bao.webp?v=20260808",
		"CAI-THAO":        "/images/menu/cai-thao.webp?v=20260808",
		"NGO-NGOT":        "/images/menu/ngo-ngot-my.webp?v=20260808",
		"VANG-DAU":        "/images/menu/vang-dau-tuoi.webp?v=20260808",
		"KHOAI-MON":       "/images/menu/khoai-mon-thai-lat.webp?v=20260808",
		"CHA-GIO-HS":      "/images/menu/cha-gio-hai-san.webp?v=20260808",
		"CANH-GA-MAM":     "/images/menu/canh-ga-chien-nuoc-mam.webp?v=20260808",
		"DAU-BAP-NUONG":   "/images/menu/dau-bap-nuong-mo-hanh.webp?v=20260808",
		"BIA-TIGER":       "/images/menu/bia-tiger.webp?v=20260808",
		"NUOC-SUOI":       "/images/menu/nuoc-suoi.webp?v=20260808",
		"7UP":             "/images/menu/7up.webp?v=20260808",
		"TRA-TAC":         "/images/menu/tra-tac.webp?v=20260808",
		"CAM-EP":          "/images/menu/nuoc-cam-ep.webp?v=20260808",
		"CHE-KHUC-BACH":   "/images/menu/che-khuc-bach.webp?v=20260808",
		"RAU-CAU-DUA":     "/images/menu/rau-cau-dua.webp?v=20260808",
	}
	generatedCategoryImages := map[string]string{
		"Lẩu":         generatedItemImages["LAU-THAI"],
		"Món nướng":   generatedItemImages["BA-CHI-BO"],
		"Hải sản":     generatedItemImages["TOM-SU"],
		"Rau & Nấm":   generatedItemImages["RAU-THAP-CAM"],
		"Khai vị":     generatedItemImages["KHOAI-CHIEN"],
		"Đồ uống":     generatedItemImages["TRA-DAO"],
		"Tráng miệng": generatedItemImages["KEM-VANI"],
	}
	generatedComboImages := map[string]string{
		"COMBO-NUONG-4": "/images/menu/combo-set-nuong-nhom-4.webp?v=20260808",
		"COMBO-LAU-2":   "/images/menu/combo-set-lau-nhom-2.webp?v=20260808",
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
		catImage, ok := generatedCategoryImages[c.name]
		if !ok {
			return fmt.Errorf("missing generated image for category %q", c.name)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO categories (id, restaurant_id, name, slug, description, icon, image_url, display_order, is_active)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
		`, id, restaurantID, c.name, c.slug, c.description, c.icon, catImage, i+1); err != nil {
			return err
		}
		catIDs[c.name] = id
	}

	type item struct {
		category, code, name, slug, description string
		priceVND                                int64
		station                                 string
		isFeatured                              bool
	}
	items := []item{
		// ── Lẩu ──
		{"Lẩu", "LAU-THAI", "Lẩu Thái tomyum chua cay", "lau-thai-tomyum", "Nước lẩu Thái chua cay, sả, lá chanh, kèm rau nhúng", 269000, "HOTPOT", true},
		{"Lẩu", "LAU-BO-MY", "Lẩu bò Mỹ nấm", "lau-bo-my-nam", "Nước dùng xương hầm, ba chỉ bò Mỹ, nấm tổng hợp", 329000, "HOTPOT", true},
		{"Lẩu", "LAU-GA-LA-E", "Lẩu gà lá é", "lau-ga-la-e", "Gà ta, lá é Phú Yên, măng chua", 289000, "HOTPOT", false},
		{"Lẩu", "LAU-HAI-SAN", "Lẩu hải sản chua cay", "lau-hai-san", "Tôm, mực, nghêu, cá viên, nước lẩu chua cay", 349000, "HOTPOT", false},
		{"Lẩu", "LAU-RIEU-CUA", "Lẩu riêu cua bắp bò", "lau-rieu-cua-bap-bo", "Riêu cua đồng, bắp bò, sườn sụn, cà chua, giấm bỗng", 359000, "HOTPOT", false},
		{"Lẩu", "LAU-TU-XUYEN", "Lẩu Tứ Xuyên cay tê", "lau-tu-xuyen-cay-te", "Nước lẩu mala cay tê, hạt tê, ớt khô Tứ Xuyên", 319000, "HOTPOT", false},
		{"Lẩu", "LAU-NAM-CHAY", "Lẩu nấm chay dưỡng sinh", "lau-nam-chay-duong-sinh", "Nước hầm nấm và rau củ, các loại nấm tươi, đậu hũ", 239000, "HOTPOT", false},
		{"Lẩu", "LAU-CA-KEO", "Lẩu cá kèo lá giang", "lau-ca-keo-la-giang", "Cá kèo tươi, lá giang chua thanh, rau đắng", 299000, "HOTPOT", false},
		// ── Món nướng ──
		{"Món nướng", "BA-CHI-BO", "Ba chỉ bò Mỹ nướng", "ba-chi-bo-my-nuong", "Ba chỉ bò Mỹ thái lát, sốt mè rang", 149000, "GRILL", false},
		{"Món nướng", "SUON-NUONG", "Sườn heo nướng mật ong", "suon-heo-nuong-mat-ong", "Sườn non ướp mật ong nướng than hoa", 159000, "GRILL", true},
		{"Món nướng", "BO-CUON-NAM", "Bò cuộn nấm kim châm", "bo-cuon-nam-kim-cham", "Bò Mỹ cuộn nấm kim châm nướng sa tế", 129000, "GRILL", false},
		{"Món nướng", "GA-NUONG", "Cánh gà nướng sa tế", "canh-ga-nuong-sa-te", "Cánh gà ướp sa tế nướng than", 119000, "GRILL", false},
		{"Món nướng", "NAC-VAI-HEO", "Nạc vai heo nướng riềng mẻ", "nac-vai-heo-nuong-rieng-me", "Nạc vai heo ướp riềng mẻ nướng than hoa", 139000, "GRILL", false},
		{"Món nướng", "NAM-BO-NUONG", "Nầm bò nướng", "nam-bo-nuong", "Nầm bò tươi ướp sa tế, nướng giòn", 149000, "GRILL", false},
		{"Món nướng", "SUN-GA-NUONG", "Sụn gà nướng muối ớt", "sun-ga-nuong-muoi-ot", "Sụn gà giòn ướp muối ớt xanh", 109000, "GRILL", false},
		{"Món nướng", "XUC-XICH-NUONG", "Xúc xích Đức nướng", "xuc-xich-duc-nuong", "Xúc xích Đức nướng, sốt mù tạt mật ong", 89000, "GRILL", false},
		// ── Hải sản ──
		{"Hải sản", "TOM-SU", "Tôm sú tươi (nhúng lẩu)", "tom-su-tuoi", "Tôm sú sống 300g, nhúng lẩu", 189000, "HOTPOT", false},
		{"Hải sản", "MUC-NUONG", "Mực nướng sa tế", "muc-nuong-sa-te", "Mực ống tươi nướng sa tế cay", 179000, "GRILL", false},
		{"Hải sản", "HAU-NUONG", "Hàu nướng phô mai", "hau-nuong-pho-mai", "Hàu sữa nướng phô mai mozzarella", 99000, "GRILL", true},
		{"Hải sản", "NGHEU-NHUNG", "Nghêu tươi (nhúng lẩu)", "ngheu-tuoi-nhung-lau", "Nghêu sống 500g, nhúng lẩu ngọt nước", 89000, "HOTPOT", false},
		{"Hải sản", "SO-DIEP-NUONG", "Sò điệp nướng mỡ hành", "so-diep-nuong-mo-hanh", "Sò điệp nướng mỡ hành, đậu phộng rang", 159000, "GRILL", false},
		{"Hải sản", "BACH-TUOC-NUONG", "Bạch tuộc nướng sa tế", "bach-tuoc-nuong-sa-te", "Bạch tuộc baby nướng sa tế cay", 169000, "GRILL", false},
		{"Hải sản", "CA-VIEN-THA", "Cá viên thả lẩu", "ca-vien-tha-lau", "Đĩa cá viên, bò viên, tôm viên thả lẩu", 79000, "HOTPOT", false},
		// ── Rau & Nấm ──
		{"Rau & Nấm", "RAU-THAP-CAM", "Rau thập cẩm", "rau-thap-cam", "Đĩa rau nhúng lẩu theo mùa", 59000, "HOTPOT", false},
		{"Rau & Nấm", "NAM-TONG-HOP", "Nấm tổng hợp", "nam-tong-hop", "Kim châm, đùi gà, bào ngư, linh chi nâu", 79000, "HOTPOT", false},
		{"Rau & Nấm", "DAU-HU", "Đậu hũ trứng", "dau-hu-trung", "Đậu hũ trứng nhúng lẩu", 39000, "HOTPOT", false},
		{"Rau & Nấm", "MI-TRUNG", "Mì trứng tươi", "mi-trung-tuoi", "Mì trứng tươi ăn kèm lẩu", 19000, "NOODLE", false},
		{"Rau & Nấm", "RAU-MUONG", "Rau muống bào", "rau-muong-bao", "Rau muống bào giòn nhúng lẩu", 45000, "HOTPOT", false},
		{"Rau & Nấm", "CAI-THAO", "Cải thảo", "cai-thao", "Cải thảo tươi cắt khúc nhúng lẩu", 39000, "HOTPOT", false},
		{"Rau & Nấm", "NGO-NGOT", "Ngô ngọt Mỹ", "ngo-ngot-my", "Ngô ngọt cắt khúc, ngọt nước lẩu", 35000, "HOTPOT", false},
		{"Rau & Nấm", "VANG-DAU", "Váng đậu tươi", "vang-dau-tuoi", "Váng đậu non thả lẩu", 49000, "HOTPOT", false},
		{"Rau & Nấm", "KHOAI-MON", "Khoai môn", "khoai-mon-thai-lat", "Khoai môn thái lát, bùi ngọt", 39000, "HOTPOT", false},
		// ── Khai vị ──
		{"Khai vị", "KHOAI-CHIEN", "Khoai tây chiên", "khoai-tay-chien", "Khoai tây chiên giòn, sốt tương cà", 49000, "GENERAL", false},
		{"Khai vị", "NEM-RAN", "Nem chua rán", "nem-chua-ran", "Nem chua rán, tương ớt", 69000, "GENERAL", false},
		{"Khai vị", "SALAD-BO", "Salad trộn bò Mỹ", "salad-tron-bo-my", "Xà lách, cà chua bi, bò Mỹ áp chảo", 89000, "GENERAL", false},
		{"Khai vị", "CHA-GIO-HS", "Chả giò hải sản", "cha-gio-hai-san", "Chả giò cuộn tôm mực, chiên giòn", 79000, "GENERAL", false},
		{"Khai vị", "CANH-GA-MAM", "Cánh gà chiên nước mắm", "canh-ga-chien-nuoc-mam", "Cánh gà chiên giòn rưới nước mắm tỏi", 89000, "GENERAL", false},
		{"Khai vị", "DAU-BAP-NUONG", "Đậu bắp nướng mỡ hành", "dau-bap-nuong-mo-hanh", "Đậu bắp nướng than, mỡ hành", 45000, "GRILL", false},
		// ── Đồ uống ──
		{"Đồ uống", "TRA-DA", "Trà đá", "tra-da", "Trà đá mát lạnh", 5000, "DRINK", false},
		{"Đồ uống", "TRA-DAO", "Trà đào cam sả", "tra-dao-cam-sa", "Trà đào, cam vàng, sả tươi", 45000, "DRINK", false},
		{"Đồ uống", "COCA", "Coca-Cola", "coca-cola", "Coca-Cola lon 330ml", 25000, "DRINK", false},
		{"Đồ uống", "BIA-SG", "Bia Sài Gòn", "bia-sai-gon", "Bia Sài Gòn Special lon", 25000, "DRINK", false},
		{"Đồ uống", "BIA-TIGER", "Bia Tiger", "bia-tiger", "Bia Tiger lon 330ml", 28000, "DRINK", false},
		{"Đồ uống", "NUOC-SUOI", "Nước suối", "nuoc-suoi", "Nước khoáng đóng chai 500ml", 15000, "DRINK", false},
		{"Đồ uống", "7UP", "7 Up", "7up", "7 Up lon 330ml", 25000, "DRINK", false},
		{"Đồ uống", "TRA-TAC", "Trà tắc", "tra-tac", "Trà tắc mật ong đá", 35000, "DRINK", false},
		{"Đồ uống", "CAM-EP", "Nước cam ép", "nuoc-cam-ep", "Cam vắt nguyên chất, không đường", 49000, "DRINK", false},
		// ── Tráng miệng ──
		{"Tráng miệng", "KEM-VANI", "Kem vani", "kem-vani", "Kem vani 2 viên", 29000, "DESSERT", false},
		{"Tráng miệng", "TRAI-CAY", "Đĩa trái cây", "dia-trai-cay", "Trái cây theo mùa", 59000, "DESSERT", false},
		{"Tráng miệng", "CHE-KHUC-BACH", "Chè khúc bạch", "che-khuc-bach", "Khúc bạch phô mai, hạnh nhân, nhãn", 39000, "DESSERT", false},
		{"Tráng miệng", "RAU-CAU-DUA", "Rau câu dừa", "rau-cau-dua", "Rau câu nước cốt dừa mát lạnh", 29000, "DESSERT", false},
	}
	itemIDs := map[string]uuid.UUID{}
	displayOrders := map[string]int{}
	for _, it := range items {
		id := uuid.New()
		displayOrders[it.category]++
		// Every seeded item must have a dedicated generated photo so the deployed
		// catalog never silently presents the category placeholder image.
		mainImage, ok := generatedItemImages[it.code]
		if !ok {
			return fmt.Errorf("missing generated image for menu item %q", it.code)
		}
		var gallery any
		if b, err := json.Marshal([]string{mainImage}); err == nil {
			gallery = string(b)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO menu_items (id, restaurant_id, category_id, code, name, slug, short_description, base_price_vnd, image_url, images, is_available, availability_status, station, status, display_order, is_featured)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, 'AVAILABLE', $11, 'PUBLISHED', $12, $13)
		`, id, restaurantID, catIDs[it.category], it.code, it.name, it.slug, it.description, it.priceVND, mainImage, gallery, it.station, displayOrders[it.category], it.isFeatured); err != nil {
			return err
		}
		itemIDs[it.code] = id
	}

	// Size variants
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
		{"LAU-RIEU-CUA", "Nhỏ (2 người)", "LAU-RIEU-CUA-S", "nồi", 359000, true, 1},
		{"LAU-RIEU-CUA", "Lớn (4 người)", "LAU-RIEU-CUA-L", "nồi", 499000, false, 2},
		{"LAU-TU-XUYEN", "Nhỏ (2 người)", "LAU-TU-XUYEN-S", "nồi", 319000, true, 1},
		{"LAU-TU-XUYEN", "Lớn (4 người)", "LAU-TU-XUYEN-L", "nồi", 449000, false, 2},
		{"LAU-NAM-CHAY", "Nhỏ (2 người)", "LAU-NAM-CHAY-S", "nồi", 239000, true, 1},
		{"LAU-NAM-CHAY", "Lớn (4 người)", "LAU-NAM-CHAY-L", "nồi", 349000, false, 2},
		{"LAU-CA-KEO", "Nhỏ (2 người)", "LAU-CA-KEO-S", "nồi", 299000, true, 1},
		{"LAU-CA-KEO", "Lớn (4 người)", "LAU-CA-KEO-L", "nồi", 419000, false, 2},
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

	// Spice level (required, single)
	spiceGroup := uuid.New()
	if _, err := tx.Exec(ctx, `
		INSERT INTO option_groups (id, restaurant_id, name, selection_type, is_required, min_selections, max_selections, display_order)
		VALUES ($1, $2, 'Độ cay', 'SINGLE', TRUE, 1, 1, 1)
	`, spiceGroup, restaurantID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO options (restaurant_id, option_group_id, name, price_delta_vnd, is_default, is_available, display_order) VALUES
		($1, $2, 'Không cay', 0, FALSE, TRUE, 1),
		($1, $2, 'Cay vừa', 0, TRUE, TRUE, 2),
		($1, $2, 'Cay nhiều', 0, FALSE, TRUE, 3)
	`, restaurantID, spiceGroup); err != nil {
		return err
	}
	for _, code := range []string{"LAU-THAI", "LAU-BO-MY", "LAU-GA-LA-E", "LAU-HAI-SAN", "LAU-RIEU-CUA", "LAU-TU-XUYEN", "LAU-NAM-CHAY", "LAU-CA-KEO"} {
		if _, err := tx.Exec(ctx, `
			INSERT INTO menu_item_option_groups (restaurant_id, menu_item_id, option_group_id, display_order)
			VALUES ($1, $2, $3, 1)
		`, restaurantID, itemIDs[code], spiceGroup); err != nil {
			return err
		}
	}

	// Sweetness (optional, single)
	sugarGroup := uuid.New()
	if _, err := tx.Exec(ctx, `
		INSERT INTO option_groups (id, restaurant_id, name, selection_type, is_required, min_selections, max_selections, display_order)
		VALUES ($1, $2, 'Mức đường', 'SINGLE', TRUE, 1, 1, 2)
	`, sugarGroup, restaurantID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO options (restaurant_id, option_group_id, name, price_delta_vnd, is_default, is_available, display_order) VALUES
		($1, $2, 'Bình thường', 0, TRUE, TRUE, 1),
		($1, $2, 'Ít đường', 0, FALSE, TRUE, 2),
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

	// Toppings (optional, multi)
	toppingGroup := uuid.New()
	if _, err := tx.Exec(ctx, `
		INSERT INTO option_groups (id, restaurant_id, name, selection_type, is_required, min_selections, max_selections, display_order)
		VALUES ($1, $2, 'Topping thêm', 'MULTIPLE', FALSE, 0, 6, 3)
	`, toppingGroup, restaurantID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO options (restaurant_id, option_group_id, name, price_delta_vnd, is_default, is_available, display_order) VALUES
		($1, $2, 'Thịt bò Mỹ', 59000, FALSE, TRUE, 1),
		($1, $2, 'Tôm sú', 65000, FALSE, TRUE, 2),
		($1, $2, 'Nghêu', 45000, FALSE, TRUE, 3),
		($1, $2, 'Nấm tổng hợp', 39000, FALSE, TRUE, 4),
		($1, $2, 'Mì trứng', 19000, FALSE, TRUE, 5),
		($1, $2, 'Đậu hũ non', 15000, FALSE, TRUE, 6)
	`, restaurantID, toppingGroup); err != nil {
		return err
	}
	for _, code := range []string{"LAU-THAI", "LAU-BO-MY", "LAU-GA-LA-E", "LAU-HAI-SAN", "LAU-RIEU-CUA", "LAU-TU-XUYEN", "LAU-CA-KEO"} {
		if _, err := tx.Exec(ctx, `
			INSERT INTO menu_item_option_groups (restaurant_id, menu_item_id, option_group_id, display_order)
			VALUES ($1, $2, $3, 2)
		`, restaurantID, itemIDs[code], toppingGroup); err != nil {
			return err
		}
	}

	// Doneness (required, single)
	donenessGroup := uuid.New()
	if _, err := tx.Exec(ctx, `
		INSERT INTO option_groups (id, restaurant_id, name, selection_type, is_required, min_selections, max_selections, display_order)
		VALUES ($1, $2, 'Độ chín', 'SINGLE', TRUE, 1, 1, 1)
	`, donenessGroup, restaurantID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO options (restaurant_id, option_group_id, name, price_delta_vnd, is_default, is_available, display_order) VALUES
		($1, $2, 'Tái', 0, FALSE, TRUE, 1),
		($1, $2, 'Chín tới', 0, TRUE, TRUE, 2),
		($1, $2, 'Chín kỹ', 0, FALSE, TRUE, 3)
	`, restaurantID, donenessGroup); err != nil {
		return err
	}
	for _, code := range []string{"BA-CHI-BO", "SUON-NUONG", "BO-CUON-NAM"} {
		if _, err := tx.Exec(ctx, `
			INSERT INTO menu_item_option_groups (restaurant_id, menu_item_id, option_group_id, display_order)
			VALUES ($1, $2, $3, 1)
		`, restaurantID, itemIDs[code], donenessGroup); err != nil {
			return err
		}
	}

	// Ice level (optional, single)
	iceGroup := uuid.New()
	if _, err := tx.Exec(ctx, `
		INSERT INTO option_groups (id, restaurant_id, name, selection_type, is_required, min_selections, max_selections, display_order)
		VALUES ($1, $2, 'Mức đá', 'SINGLE', FALSE, 0, 1, 1)
	`, iceGroup, restaurantID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO options (restaurant_id, option_group_id, name, price_delta_vnd, is_default, is_available, display_order) VALUES
		($1, $2, '100% đá', 0, TRUE, TRUE, 1),
		($1, $2, 'Ít đá', 0, FALSE, TRUE, 2),
		($1, $2, 'Không đá', 0, FALSE, TRUE, 3)
	`, restaurantID, iceGroup); err != nil {
		return err
	}
	for _, code := range []string{"TRA-DAO", "TRA-DA", "COCA"} {
		if _, err := tx.Exec(ctx, `
			INSERT INTO menu_item_option_groups (restaurant_id, menu_item_id, option_group_id, display_order)
			VALUES ($1, $2, $3, 3)
		`, restaurantID, itemIDs[code], iceGroup); err != nil {
			return err
		}
	}

	// ── Combo meals (set menus) ──
	// Fixed-price bundles that fan out across kitchen stations at order time.
	// Component quantities are per combo unit; à-la-carte reference/savings are
	// computed live at read time from the referenced items' current prices.
	type comboComp struct {
		code     string
		quantity int
	}
	type combo struct {
		code, name, slug, description string
		priceVND                      int64
		isFeatured                    bool
		components                    []comboComp
	}
	combos := []combo{
		{
			code:        "COMBO-NUONG-4",
			name:        "Set Nướng nhóm 4",
			slug:        "set-nuong-nhom-4",
			description: "Combo nướng cho nhóm 4 người: ba chỉ bò Mỹ, hàu nướng phô mai, lẩu Thái và trà đào cam sả.",
			priceVND:    990000,
			isFeatured:  true,
			components:  []comboComp{{"BA-CHI-BO", 2}, {"HAU-NUONG", 4}, {"LAU-THAI", 1}, {"TRA-DAO", 4}},
		},
		{
			code:        "COMBO-LAU-2",
			name:        "Set Lẩu nhóm 2",
			slug:        "set-lau-nhom-2",
			description: "Combo lẩu cho 2 người: lẩu bò Mỹ nấm, tôm sú, rau thập cẩm, nấm tổng hợp, mì trứng và trà đào.",
			priceVND:    690000,
			isFeatured:  true,
			components:  []comboComp{{"LAU-BO-MY", 1}, {"TOM-SU", 1}, {"RAU-THAP-CAM", 1}, {"NAM-TONG-HOP", 1}, {"MI-TRUNG", 2}, {"TRA-DAO", 2}},
		},
	}
	for ci, cb := range combos {
		comboID := uuid.New()
		comboImage, ok := generatedComboImages[cb.code]
		if !ok {
			return fmt.Errorf("missing generated image for combo %q", cb.code)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO combos (id, restaurant_id, code, name, slug, description, image_url, combo_price_vnd, status, availability_status, is_featured, display_order, version)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PUBLISHED', 'AVAILABLE', $9, $10, 1)
		`, comboID, restaurantID, cb.code, cb.name, cb.slug, cb.description, comboImage, cb.priceVND, cb.isFeatured, ci+1); err != nil {
			return err
		}
		for i, comp := range cb.components {
			itemID, ok := itemIDs[comp.code]
			if !ok {
				return fmt.Errorf("combo %s references unknown item %s", cb.code, comp.code)
			}
			if _, err := tx.Exec(ctx, `
				INSERT INTO combo_items (restaurant_id, combo_id, menu_item_id, quantity, display_order)
				VALUES ($1, $2, $3, $4, $5)
			`, restaurantID, comboID, itemID, comp.quantity, i+1); err != nil {
				return err
			}
		}
	}

	return nil
}

// randToken is kept for compatibility; setup.EnsureQRCodes uses its own.
func randToken() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}
