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

	if _, err := tx.Exec(ctx, `
		INSERT INTO qr_codes (restaurant_id, table_id, token, is_active)
		VALUES ($1, $2, 'DEMO-T01', TRUE)
		ON CONFLICT (token) DO NOTHING
	`, restaurantID, tableID); err != nil {
		log.Error("seed qr failed", slog.Any("error", err))
		os.Exit(1)
	}

	if err := tx.Commit(ctx); err != nil {
		log.Error("commit seed transaction failed", slog.Any("error", err))
		os.Exit(1)
	}

	fmt.Println("Seed complete")
	fmt.Printf("restaurant_code: %s\n", demoRestaurantCode)
	fmt.Println("usernames:")
	for _, u := range demoUsers {
		fmt.Printf("- %s\n", u.username)
	}
}

func demoPassword() string {
	if v := os.Getenv(demoPasswordEnvVarName); v != "" {
		return v
	}
	return defaultDemoPassword
}
