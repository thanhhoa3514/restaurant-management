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

func sessionTokenFor(tableCode string) string { return "DEMO-SESSION-" + tableCode }
func sessionCodeFor(tableCode string) string  { return "DEMO-SESS-" + tableCode }

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
	// Open ACTIVE sessions bound to deterministic guest session tokens so
	// demo guests can jump straight into the menu without real staff auth.
	for _, t := range demoTables {
		if !demoSessions[t.Code] {
			continue
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO dining_sessions (restaurant_id, table_id, session_code, status, opened_via, session_token)
			VALUES ($1, (SELECT id FROM tables WHERE restaurant_id = $1 AND code = $2 LIMIT 1),
			        $3, 'ACTIVE', 'QR_SCAN', $4)
		`, rid, t.Code, sessionCodeFor(t.Code), sessionTokenFor(t.Code)); err != nil {
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
			line += fmt.Sprintf("  [ACTIVE session, X-Session-Token=%s]", sessionTokenFor(t.Code))
		}
		fmt.Println(line)
	}
	fmt.Println("══════════════════════════════════════════════")
}

// ──────────────────────────────────────────────
// Demo menu seeding (unchanged from original)
// ──────────────────────────────────────────────

func seedMenu(ctx context.Context, tx pgx.Tx, restaurantID uuid.UUID) error {
	if err := setup.ClearMenuData(ctx, tx, restaurantID); err != nil {
		return err
	}

	// Demo photos, keyed by category name. Verified Unsplash CDN images
	// (hotlink-friendly, free license). imageURL builds a sized/cropped URL;
	// each item gets a main photo + a small gallery rotated from its pool.
	imagePools := map[string][]string{
		"Lẩu": {
			"photo-1614104030967-5ca61a54247b", "photo-1677030137853-03a83b0bd630", "photo-1584509171119-9054d2d7d9a7",
		},
		"Món nướng": {
			"photo-1555939594-58d7cb561ad1", "photo-1508615263227-c5d58c1e5821", "photo-1614119068601-483274e9dcb7",
			"photo-1627947063935-55577ec3c2e1", "photo-1632158930341-46604b637a0f", "photo-1504564321107-4aa3efddb5bd",
		},
		"Hải sản": {
			"photo-1559742811-822873691df8", "photo-1562158079-e4b9ed06b62d", "photo-1688084468401-4938b073aef2",
			"photo-1514944288352-fffac99f0bdf", "photo-1723325697529-6e2679650b39", "photo-1709327515207-110f910e8913",
		},
		"Rau & Nấm": {
			"photo-1641919062245-98117fd30791", "photo-1651326752381-c5bcaacb2ba0", "photo-1625940949493-91ac054804e7",
			"photo-1625940947631-908aa92ef5e7", "photo-1651326710058-fd7acf9f68c5",
		},
		"Khai vị": {
			"photo-1623653387945-2fd25214f8fc", "photo-1594254916028-742dedb72062",
			"photo-1613764816537-a43baeb559c1", "photo-1485995768424-01c1ccc33f7a",
		},
		"Đồ uống": {
			"photo-1461023058943-07fcbe16d735", "photo-1556679343-c7306c1976bc", "photo-1578314675249-a6910f80cc4e",
			"photo-1533007716222-4b465613a984", "photo-1558122104-355edad709f6", "photo-1561641377-f7456d23aa9b",
			"photo-1630184799082-05623dbdc7f7", "photo-1504753793650-d4a2b783c15e", "photo-1527678357412-ef45dfbd9ecc",
		},
		"Tráng miệng": {
			"photo-1501443762994-82bd5dace89a", "photo-1597249536924-b226b1a1259d", "photo-1588685232180-8bb64cb4837a",
			"photo-1438907046657-4ae137eb8c5e", "photo-1531917658462-73450543c9f0", "photo-1531240062960-4842b265a1ad",
			"photo-1595275320712-24b6f2b0a984", "photo-1568464774940-a3de36f824a5", "photo-1594765877813-a5d04b0d8aa7",
		},
	}
	s3Base := os.Getenv("S3_PUBLIC_URL")
	if s3Base == "" {
		s3Base = "http://localhost:9000/restaurant-images"
	}
	imageURL := func(id string) string {
		return s3Base + "/menu/seed/" + id + ".jpg"
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
		var catImage string
		if pool := imagePools[c.name]; len(pool) > 0 {
			catImage = imageURL(pool[0])
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
		var mainImage string
		var gallery any
		if pool := imagePools[it.category]; len(pool) > 0 {
			idx := displayOrders[it.category] - 1
			mainImage = imageURL(pool[idx%len(pool)])
			imgs := []string{mainImage}
			for k := 1; k <= 2 && k < len(pool); k++ {
				imgs = append(imgs, imageURL(pool[(idx+k)%len(pool)]))
			}
			if b, err := json.Marshal(imgs); err == nil {
				gallery = string(b)
			}
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO menu_items (id, restaurant_id, category_id, code, name, slug, short_description, base_price_vnd, image_url, images, is_available, availability_status, station, status, display_order)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE, 'AVAILABLE', $11, 'PUBLISHED', $12)
		`, id, restaurantID, catIDs[it.category], it.code, it.name, it.slug, it.description, it.priceVND, mainImage, gallery, it.station, displayOrders[it.category]); err != nil {
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
	for _, code := range []string{"LAU-THAI", "LAU-BO-MY", "LAU-GA-LA-E", "LAU-HAI-SAN"} {
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
	for _, code := range []string{"LAU-THAI", "LAU-BO-MY", "LAU-GA-LA-E", "LAU-HAI-SAN"} {
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
