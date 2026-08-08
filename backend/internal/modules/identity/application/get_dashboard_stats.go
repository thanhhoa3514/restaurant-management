package application

import (
	"context"

	"github.com/google/uuid"
)

// DashboardStats holds the real (non-mock) metrics shown on the admin dashboard.
// Only revenue + table occupancy are backed by real reads today; the remaining
// dashboard cards (kitchen, payments, staffs) are still mock in the handler.
type DashboardStats struct {
	RevenueTodayVND  int64
	PaidInvoiceCount int
	ActiveTables     int
	TotalTables      int
}

// DashboardReader is the read-model port for dashboard metrics.
type DashboardReader interface {
	// RevenueToday returns the summed total and count of invoices marked PAID
	// today (restaurant-local time).
	RevenueToday(ctx context.Context, restaurantID uuid.UUID) (totalVND int64, count int, err error)
	// TableOccupancy returns active dining sessions (occupied tables) and the
	// total number of usable tables.
	TableOccupancy(ctx context.Context, restaurantID uuid.UUID) (active int, total int, err error)
}

// GetDashboardStats composes the real dashboard read-model metrics.
type GetDashboardStats struct {
	reader              DashboardReader
	defaultRestaurantID uuid.UUID
}

func NewGetDashboardStats(reader DashboardReader, defaultRestaurantID uuid.UUID) *GetDashboardStats {
	return &GetDashboardStats{reader: reader, defaultRestaurantID: defaultRestaurantID}
}

func (g *GetDashboardStats) Handle(ctx context.Context) (DashboardStats, error) {
	var out DashboardStats
	rid := g.defaultRestaurantID

	revenue, count, err := g.reader.RevenueToday(ctx, rid)
	if err != nil {
		return out, err
	}
	active, total, err := g.reader.TableOccupancy(ctx, rid)
	if err != nil {
		return out, err
	}

	out.RevenueTodayVND = revenue
	out.PaidInvoiceCount = count
	out.ActiveTables = active
	out.TotalTables = total
	return out, nil
}
