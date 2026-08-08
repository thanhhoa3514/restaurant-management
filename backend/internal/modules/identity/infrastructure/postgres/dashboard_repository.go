package postgres

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// restaurantTZ is the local timezone used to bound "today" for revenue.
// Single-restaurant deployment in Vietnam; no per-restaurant TZ config exists yet.
const restaurantTZ = "Asia/Ho_Chi_Minh"

// DashboardRepository reads the real admin-dashboard metrics.
type DashboardRepository struct {
	pool       *pgxpool.Pool
	defaultRID uuid.UUID
}

func NewDashboardRepository(pool *pgxpool.Pool, defaultRID uuid.UUID) *DashboardRepository {
	return &DashboardRepository{pool: pool, defaultRID: defaultRID}
}

// RevenueToday sums total_amount_vnd over invoices marked PAID whose paid_at
// falls on today in restaurant-local time. The full-payment settle path writes
// paid_amount_vnd = total_amount_vnd, so total_amount_vnd is the money collected.
func (r *DashboardRepository) RevenueToday(ctx context.Context, restaurantID uuid.UUID) (int64, int, error) {
	var total int64
	var count int
	err := r.pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(total_amount_vnd), 0), COUNT(*)
		FROM invoices
		WHERE restaurant_id = $1
		  AND status = 'PAID'
		  AND deleted_at IS NULL
		  AND paid_at IS NOT NULL
		  AND (paid_at AT TIME ZONE $2)::date = (now() AT TIME ZONE $2)::date
	`, restaurantID, restaurantTZ).Scan(&total, &count)
	if err != nil {
		return 0, 0, err
	}
	return total, count, nil
}

// TableOccupancy returns the count of active dining sessions (occupied tables)
// and the total number of usable tables (excluding INACTIVE).
func (r *DashboardRepository) TableOccupancy(ctx context.Context, restaurantID uuid.UUID) (int, int, error) {
	var active int
	err := r.pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM dining_sessions
		WHERE restaurant_id = $1
		  AND status IN ('ACTIVE', 'AWAITING_PAYMENT')
		  AND deleted_at IS NULL
	`, restaurantID).Scan(&active)
	if err != nil {
		return 0, 0, err
	}

	var total int
	err = r.pool.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM tables
		WHERE restaurant_id = $1
		  AND status <> 'INACTIVE'
		  AND deleted_at IS NULL
	`, restaurantID).Scan(&total)
	if err != nil {
		return 0, 0, err
	}
	return active, total, nil
}
