package outbox

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"restaurant-management/internal/platform/realtime"
	"restaurant-management/internal/shared/apperr"
)

type Event struct {
	ID           uuid.UUID
	RestaurantID uuid.UUID
	Type         string
	Payload      json.RawMessage
	CreatedAt    time.Time
}

type Dispatcher struct {
	pool     *pgxpool.Pool
	hub      *realtime.Hub
	logger   *slog.Logger
	interval time.Duration
}

func NewDispatcher(pool *pgxpool.Pool, hub *realtime.Hub, logger *slog.Logger) *Dispatcher {
	return &Dispatcher{pool: pool, hub: hub, logger: logger, interval: time.Second}
}
func (d *Dispatcher) Start(ctx context.Context) {
	ticker := time.NewTicker(d.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			d.logger.Debug("outbox tick")
		}
	}
}
func (d *Dispatcher) Write(ctx context.Context, event any) error {
	_ = ctx
	_ = event
	return apperr.ErrNotImplemented
}
