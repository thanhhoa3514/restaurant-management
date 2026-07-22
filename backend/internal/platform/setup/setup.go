// Package setup provides shared functions for bootstrapping a restaurant's
// initial data: restaurant record, staff users, areas + tables, QR codes,
// and payment methods. Used by both the production setup command and the
// development seed command.
package setup

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
)

// ──────────────────────────────────────────────
// Config types
// ──────────────────────────────────────────────

type RestaurantConfig struct {
	Code                     string
	Name                     string
	Address                  string
	Phone                    string
	Email                    string
	TaxCode                  string
	VatRateBasisPoints       int
	ServiceChargeBasisPoints int
}

type UserConfig struct {
	Username string
	FullName string
	Password string
	Role     string // manager | cashier | server | kitchen
}

type AreaConfig struct {
	Name        string
	Description string
	DisplayOrder int
}

type TableConfig struct {
	AreaName string
	Code     string
	Name     string
	Capacity int
}

// ──────────────────────────────────────────────
// Restaurant
// ──────────────────────────────────────────────

// EnsureRestaurant creates or updates the restaurant record. It uses the
// restaurant code (normalized to uppercase) as the conflict key so re-running
// is idempotent. Returns the restaurant's UUID.
func EnsureRestaurant(ctx context.Context, tx pgx.Tx, cfg RestaurantConfig) (uuid.UUID, error) {
	var id uuid.UUID
	err := tx.QueryRow(ctx, `
		INSERT INTO restaurants (name, code, address, phone, email, tax_code, vat_rate_basis_points, service_charge_basis_points, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'ACTIVE')
		ON CONFLICT (code) DO UPDATE
		SET name             = EXCLUDED.name,
		    address          = EXCLUDED.address,
		    phone            = EXCLUDED.phone,
		    email            = EXCLUDED.email,
		    tax_code         = EXCLUDED.tax_code,
		    updated_at       = NOW()
		RETURNING id
	`, cfg.Name, cfg.Code, cfg.Address, cfg.Phone, cfg.Email, cfg.TaxCode,
		cfg.VatRateBasisPoints, cfg.ServiceChargeBasisPoints).Scan(&id)
	if err != nil {
		return uuid.Nil, fmt.Errorf("ensure restaurant: %w", err)
	}
	return id, nil
}

// ──────────────────────────────────────────────
// Users
// ──────────────────────────────────────────────

// EnsureUsers creates staff users for the restaurant. Each user is linked to
// a role by name (manager, cashier, server, kitchen). Re-running skips
// existing users (ON CONFLICT DO NOTHING on username).
func EnsureUsers(ctx context.Context, tx pgx.Tx, restaurantID uuid.UUID, users []UserConfig) error {
	for _, u := range users {
		hash, err := bcrypt.GenerateFromPassword([]byte(u.Password), bcrypt.DefaultCost)
		if err != nil {
			return fmt.Errorf("hash password for %s: %w", u.Username, err)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO users (restaurant_id, username, email, password_hash, full_name, role_id, status)
			SELECT $1, $2, $3, $4, $5, r.id, 'ACTIVE'
			FROM roles r
			WHERE r.name = $6 AND r.deleted_at IS NULL
			ON CONFLICT (restaurant_id, username) DO UPDATE
			SET password_hash = EXCLUDED.password_hash,
			    full_name     = EXCLUDED.full_name,
			    updated_at    = NOW()
		`, restaurantID, u.Username, u.Username+"@restaurant.local", string(hash), u.FullName, u.Role); err != nil {
			return fmt.Errorf("ensure user %s: %w", u.Username, err)
		}
	}
	return nil
}

// ──────────────────────────────────────────────
// Areas & Tables
// ──────────────────────────────────────────────

// EnsureAreasAndTables creates areas and tables. Returns maps of area name →
// UUID and table code → UUID so callers can reference them later (e.g. for QR
// codes). Existing areas/tables are updated, not duplicated.
func EnsureAreasAndTables(ctx context.Context, tx pgx.Tx, restaurantID uuid.UUID, areas []AreaConfig, tables []TableConfig) (areaIDs map[string]uuid.UUID, tableIDs map[string]uuid.UUID, err error) {
	areaIDs = make(map[string]uuid.UUID, len(areas))
	for _, a := range areas {
		var id uuid.UUID
		if err := tx.QueryRow(ctx, `
			INSERT INTO areas (restaurant_id, name, description, display_order, is_active)
			VALUES ($1, $2, $3, $4, TRUE)
			ON CONFLICT (restaurant_id, name) DO UPDATE
			SET description  = EXCLUDED.description,
			    display_order = EXCLUDED.display_order,
			    updated_at    = NOW()
			RETURNING id
		`, restaurantID, a.Name, a.Description, a.DisplayOrder).Scan(&id); err != nil {
			return nil, nil, fmt.Errorf("ensure area %s: %w", a.Name, err)
		}
		areaIDs[a.Name] = id
	}

	tableIDs = make(map[string]uuid.UUID, len(tables))
	for _, t := range tables {
		areaID, ok := areaIDs[t.AreaName]
		if !ok {
			return nil, nil, fmt.Errorf("table %s references unknown area %q", t.Code, t.AreaName)
		}
		var id uuid.UUID
		if err := tx.QueryRow(ctx, `
			INSERT INTO tables (restaurant_id, area_id, code, name, capacity, status)
			VALUES ($1, $2, $3, $4, $5, 'AVAILABLE')
			ON CONFLICT (restaurant_id, code) DO UPDATE
			SET area_id  = EXCLUDED.area_id,
			    name     = EXCLUDED.name,
			    capacity = EXCLUDED.capacity,
			    updated_at = NOW()
			RETURNING id
		`, restaurantID, areaID, t.Code, t.Name, t.Capacity).Scan(&id); err != nil {
			return nil, nil, fmt.Errorf("ensure table %s: %w", t.Code, err)
		}
		tableIDs[t.Code] = id
	}

	// Stale area cleanup: remove areas from older configs that are no longer
	// in the list and have no remaining tables referencing them.
	var areaNames []string
	for _, a := range areas {
		areaNames = append(areaNames, a.Name)
	}
	if _, err := tx.Exec(ctx, `
		DELETE FROM areas a
		WHERE a.restaurant_id = $1
		  AND a.name <> ALL($2)
		  AND NOT EXISTS (
			SELECT 1 FROM tables t
			WHERE t.area_id = a.id AND t.deleted_at IS NULL
		  )
	`, restaurantID, areaNames); err != nil {
		return nil, nil, fmt.Errorf("clean stale areas: %w", err)
	}

	return areaIDs, tableIDs, nil
}

// ──────────────────────────────────────────────
// QR Codes
// ──────────────────────────────────────────────

// randToken returns an opaque random token suitable for QR code URLs.
func randToken() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(err) // crypto/rand failure is unrecoverable
	}
	return hex.EncodeToString(b)
}

// EnsureQRCodes deactivates any currently-active QR codes and creates one new
// active code per table. Returns a map of table code → QR token so callers
// can print the printed tokens (or display them).
func EnsureQRCodes(ctx context.Context, tx pgx.Tx, restaurantID uuid.UUID, tableIDs map[string]uuid.UUID) (map[string]string, error) {
	// Deactivate all active codes for this restaurant.
	if _, err := tx.Exec(ctx, `
		UPDATE qr_codes
		SET is_active = FALSE, deactivated_at = NOW(), deactivated_reason = 'replaced'
		WHERE restaurant_id = $1 AND is_active = TRUE
	`, restaurantID); err != nil {
		return nil, fmt.Errorf("deactivate old qr codes: %w", err)
	}

	tokens := make(map[string]string, len(tableIDs))
	for code, tableID := range tableIDs {
		token := randToken()
		tokens[code] = token

		if _, err := tx.Exec(ctx, `
			INSERT INTO qr_codes (restaurant_id, table_id, token, is_active)
			VALUES ($1, $2, $3, TRUE)
			ON CONFLICT (token) DO UPDATE
			SET is_active      = TRUE,
			    activated_at   = NOW(),
			    deactivated_at = NULL,
			    deactivated_reason = NULL
		`, restaurantID, tableID, token); err != nil {
			return nil, fmt.Errorf("ensure qr for table %s: %w", code, err)
		}
	}
	return tokens, nil
}

// ──────────────────────────────────────────────
// Payment Methods
// ──────────────────────────────────────────────

// SeedPaymentMethods inserts the standard payment methods (cash, card, momo,
// zalopay, vnpay). In non-production environments an additional "mock" wallet
// is added for testing. Methods are upserted by (restaurant_id, code).
func SeedPaymentMethods(ctx context.Context, tx pgx.Tx, restaurantID uuid.UUID, isProduction bool) error {
	type method struct {
		code         string
		name         string
		methodType   string
		displayOrder int
	}
	methods := []method{
		{code: "cash", name: "Cash", methodType: "CASH", displayOrder: 1},
		{code: "card", name: "Card", methodType: "CARD", displayOrder: 2},
		{code: "momo", name: "MoMo", methodType: "E_WALLET", displayOrder: 3},
		{code: "zalopay", name: "ZaloPay", methodType: "E_WALLET", displayOrder: 4},
		{code: "vnpay", name: "VNPay", methodType: "E_WALLET", displayOrder: 5},
	}
	if !isProduction {
		methods = append(methods, method{code: "mock", name: "Mock Wallet", methodType: "E_WALLET", displayOrder: 99})
	}

	for _, m := range methods {
		if _, err := tx.Exec(ctx, `
			INSERT INTO payment_methods (restaurant_id, code, name, type, is_active, display_order)
			VALUES ($1, $2, $3, $4, TRUE, $5)
			ON CONFLICT (restaurant_id, code) DO UPDATE
			SET name          = EXCLUDED.name,
			    type          = EXCLUDED.type,
			    is_active     = TRUE,
			    display_order = EXCLUDED.display_order,
			    updated_at    = NOW()
		`, restaurantID, m.code, m.name, m.methodType, m.displayOrder); err != nil {
			return fmt.Errorf("seed payment method %s: %w", m.code, err)
		}
	}
	slog.Info("payment methods seeded", slog.Int("count", len(methods)))
	return nil
}

// ──────────────────────────────────────────────
// Demo data cleanup
// ──────────────────────────────────────────────

// ClearTransactionalData deletes demo transactional data (payments, invoices,
// dining sessions) for the given restaurant so the seed can re-create fresh
// demo sessions without conflict.
func ClearTransactionalData(ctx context.Context, tx pgx.Tx, restaurantID uuid.UUID) error {
	for _, q := range []string{
		`DELETE FROM payments WHERE restaurant_id = $1`,
		`DELETE FROM invoice_items WHERE restaurant_id = $1`,
		`DELETE FROM invoices WHERE restaurant_id = $1`,
		`DELETE FROM dining_sessions WHERE restaurant_id = $1`,
	} {
		if _, err := tx.Exec(ctx, q, restaurantID); err != nil {
			return fmt.Errorf("clear transactional data: %w", err)
		}
	}
	return nil
}

// ClearMenuData deletes menu data (categories, items, variants, options) so
// the seed can re-create the demo menu from scratch.
func ClearMenuData(ctx context.Context, tx pgx.Tx, restaurantID uuid.UUID) error {
	for _, q := range []string{
		`DELETE FROM menu_item_option_groups WHERE restaurant_id = $1`,
		`DELETE FROM options WHERE restaurant_id = $1`,
		`DELETE FROM option_groups WHERE restaurant_id = $1`,
		`DELETE FROM menu_item_variants WHERE restaurant_id = $1`,
		`DELETE FROM menu_items WHERE restaurant_id = $1`,
		`DELETE FROM categories WHERE restaurant_id = $1`,
	} {
		if _, err := tx.Exec(ctx, q, restaurantID); err != nil {
			return fmt.Errorf("clear menu data: %w", err)
		}
	}
	return nil
}
