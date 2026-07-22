// Command setup bootstraps a restaurant's initial data on a fresh production
// (or staging) database AFTER migrations have been applied. It creates the
// restaurant record, admin users, areas + tables with QR codes, and payment
// methods — everything the API needs to start serving requests.
//
// Unlike cmd/seed, this command does NOT create any demo menu items or
// open demo dining sessions. Menu management is left to the admin UI.
//
// Environment variables (all optional except noted):
//
//	SETUP_RESTAURANT_CODE        — unique code (default: "MAIN")
//	SETUP_RESTAURANT_NAME        — display name (default: "Nhà hàng của tôi")
//	SETUP_RESTAURANT_ADDRESS     — street address
//	SETUP_RESTAURANT_PHONE       — contact phone
//	SETUP_RESTAURANT_EMAIL       — contact email
//	SETUP_TAX_CODE               — tax ID
//	SETUP_VAT_RATE               — VAT in basis points (default: 800 = 8%)
//	SETUP_SERVICE_CHARGE         — service charge in basis points (default: 500 = 5%)
//
//	SETUP_ADMIN_PASSWORD         — password for ALL staff accounts (REQUIRED in production)
//
// Areas and tables are read from SETUP_AREAS and SETUP_TABLES env vars as
// simple comma-separated formats (see defaults below). If your layout differs
// from the defaults, adjust via environment variables or edit the defaults.
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"

	"restaurant-management/internal/platform/config"
	"restaurant-management/internal/platform/logger"
	"restaurant-management/internal/platform/postgres"
	"restaurant-management/internal/platform/setup"
)

func main() {
	ctx := context.Background()
	cfg := config.Load()
	log := logger.New(cfg.AppEnv, cfg.LogLevel, cfg.LogDir)

	isProduction := cfg.AppEnv == "production"

	if isProduction && os.Getenv("SETUP_ADMIN_PASSWORD") == "" {
		log.Error("SETUP_ADMIN_PASSWORD is required in production")
		os.Exit(1)
	}

	pool, err := postgres.Connect(ctx, cfg.DatabaseURL, cfg.DBMaxConns)
	if err != nil {
		log.Error("database connection failed", slog.Any("error", err))
		os.Exit(1)
	}
	defer pool.Close()

	tx, err := pool.Begin(ctx)
	if err != nil {
		log.Error("begin transaction failed", slog.Any("error", err))
		os.Exit(1)
	}
	defer func() {
		if err != nil {
			_ = tx.Rollback(ctx)
		}
	}()

	// ── Restaurant ──────────────────────────────────────────────
	rid, err := setup.EnsureRestaurant(ctx, tx, setup.RestaurantConfig{
		Code:                     env("SETUP_RESTAURANT_CODE", "MAIN"),
		Name:                     env("SETUP_RESTAURANT_NAME", "Nhà hàng của tôi"),
		Address:                  env("SETUP_RESTAURANT_ADDRESS", ""),
		Phone:                    env("SETUP_RESTAURANT_PHONE", ""),
		Email:                    env("SETUP_RESTAURANT_EMAIL", ""),
		TaxCode:                  env("SETUP_TAX_CODE", ""),
		VatRateBasisPoints:       intEnv("SETUP_VAT_RATE", 800),
		ServiceChargeBasisPoints: intEnv("SETUP_SERVICE_CHARGE", 500),
	})
	if err != nil {
		log.Error("ensure restaurant failed", slog.Any("error", err))
		os.Exit(1)
	}
	log.Info("restaurant ready", slog.String("id", rid.String()))

	// ── Users ──────────────────────────────────────────────────
	adminPassword := env("SETUP_ADMIN_PASSWORD", "admin1234")
	users := []setup.UserConfig{
		{Username: "manager", FullName: "Quản lý", Password: adminPassword, Role: "manager"},
		{Username: "cashier", FullName: "Thu ngân", Password: adminPassword, Role: "cashier"},
		{Username: "server", FullName: "Phục vụ", Password: adminPassword, Role: "server"},
		{Username: "kitchen", FullName: "Bếp", Password: adminPassword, Role: "kitchen"},
	}
	if err := setup.EnsureUsers(ctx, tx, rid, users); err != nil {
		log.Error("ensure users failed", slog.Any("error", err))
		os.Exit(1)
	}
	log.Info("users ready", slog.String("password_hint", adminPassword))

	// ── Areas & Tables ─────────────────────────────────────────
	areas, tables := parseAreasAndTables()
	areaIDs, tableIDs, err := setup.EnsureAreasAndTables(ctx, tx, rid, areas, tables)
	if err != nil {
		log.Error("ensure areas/tables failed", slog.Any("error", err))
		os.Exit(1)
	}
	log.Info("areas and tables ready",
		slog.Int("areas", len(areaIDs)),
		slog.Int("tables", len(tableIDs)),
	)

	// ── QR Codes ───────────────────────────────────────────────
	tokens, err := setup.EnsureQRCodes(ctx, tx, rid, tableIDs)
	if err != nil {
		log.Error("ensure qr codes failed", slog.Any("error", err))
		os.Exit(1)
	}
	log.Info("qr codes generated", slog.Int("count", len(tokens)))

	// ── Payment Methods ────────────────────────────────────────
	if err := setup.SeedPaymentMethods(ctx, tx, rid, isProduction); err != nil {
		log.Error("seed payment methods failed", slog.Any("error", err))
		os.Exit(1)
	}

	if err := tx.Commit(ctx); err != nil {
		log.Error("commit failed", slog.Any("error", err))
		os.Exit(1)
	}

	fmt.Println()
	fmt.Println("══════════════════════════════════════════════")
	fmt.Println("  SETUP COMPLETE")
	fmt.Println("══════════════════════════════════════════════")
	fmt.Printf("  Restaurant ID:   %s\n", rid)
	fmt.Printf("  Users:           manager / cashier / server / kitchen\n")
	fmt.Printf("  Tables:          %d\n", len(tableIDs))
	fmt.Printf("  QR codes:        %d\n", len(tokens))
	fmt.Println()
	fmt.Println("  Table QR tokens (for printing):")
	for _, t := range tables {
		fmt.Printf("    %-4s  %-12s  token=%s\n", t.Code, t.Name, tokens[t.Code])
	}
	fmt.Println("══════════════════════════════════════════════")
}

// ──────────────────────────────────────────────
// Default areas & tables
// ──────────────────────────────────────────────

// Default areas for a standard restaurant layout.
var defaultAreas = []setup.AreaConfig{
	{Name: "Tầng trệt", Description: "Khu vực chính, gần quầy", DisplayOrder: 1},
	{Name: "Tầng 2", Description: "Khu vực tầng lầu", DisplayOrder: 2},
	{Name: "Phòng VIP", Description: "Phòng riêng có máy lạnh", DisplayOrder: 3},
}

var defaultTables = []setup.TableConfig{
	{AreaName: "Tầng trệt", Code: "T01", Name: "Bàn 01", Capacity: 4},
	{AreaName: "Tầng trệt", Code: "T02", Name: "Bàn 02", Capacity: 4},
	{AreaName: "Tầng trệt", Code: "T03", Name: "Bàn 03", Capacity: 6},
	{AreaName: "Tầng trệt", Code: "T04", Name: "Bàn 04", Capacity: 4},
	{AreaName: "Tầng trệt", Code: "T05", Name: "Bàn 05", Capacity: 2},
	{AreaName: "Tầng trệt", Code: "T06", Name: "Bàn 06", Capacity: 6},
	{AreaName: "Tầng 2", Code: "T07", Name: "Bàn 07", Capacity: 4},
	{AreaName: "Tầng 2", Code: "T08", Name: "Bàn 08", Capacity: 4},
	{AreaName: "Tầng 2", Code: "T09", Name: "Bàn 09", Capacity: 8},
	{AreaName: "Tầng 2", Code: "T10", Name: "Bàn 10", Capacity: 6},
	{AreaName: "Phòng VIP", Code: "V01", Name: "VIP 01", Capacity: 10},
	{AreaName: "Phòng VIP", Code: "V02", Name: "VIP 02", Capacity: 12},
}

// parseAreasAndTables returns the area and table lists. In the future this
// could read from SETUP_AREAS / SETUP_TABLES env vars; for now it uses the
// defaults above.
func parseAreasAndTables() ([]setup.AreaConfig, []setup.TableConfig) {
	// TODO: read from structured env vars (e.g. JSON or CSV) when custom
	// layouts are needed. For the MVP the defaults suit most deployments.
	return defaultAreas, defaultTables
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func intEnv(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return n
}

// commaEnv splits a comma-separated env var and trims whitespace.
func commaEnv(key string) []string {
	v := os.Getenv(key)
	if v == "" {
		return nil
	}
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}
