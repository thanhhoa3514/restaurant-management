package outbox

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"restaurant-management/internal/platform/postgres"
	"restaurant-management/internal/platform/realtime"
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

type WriteEvent struct {
	RestaurantID  uuid.UUID
	AggregateType string
	AggregateID   uuid.UUID
	EventType     string
	Payload       any
	Metadata      any
	Priority      int
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
	e, ok := event.(WriteEvent)
	if !ok {
		return nil
	}
	payload, err := json.Marshal(e.Payload)
	if err != nil {
		return err
	}
	metadata, err := json.Marshal(e.Metadata)
	if err != nil {
		return err
	}
	priority := e.Priority
	if priority == 0 {
		priority = 5
	}
	_, err = postgres.QuerierFromContext(ctx, d.pool).Exec(ctx, `
		INSERT INTO event_outbox (restaurant_id, aggregate_type, aggregate_id, event_type, event_version, payload, metadata, priority)
		VALUES ($1, $2, $3, $4, '1.0', $5, $6, $7)
	`, e.RestaurantID, e.AggregateType, e.AggregateID, e.EventType, payload, metadata, priority)
	return err
}
