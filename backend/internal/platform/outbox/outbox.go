package outbox

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"restaurant-management/internal/platform/postgres"
	"restaurant-management/internal/platform/realtime"
)

type Event struct {
	ID            uuid.UUID
	RestaurantID  uuid.UUID
	AggregateID   uuid.UUID
	AggregateType string
	Type          string
	Payload       json.RawMessage
	Metadata      json.RawMessage
	CreatedAt     time.Time
	Attempts      int
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
	// SuppressRealtime persists the event for durable consumers/audit without
	// publishing it to the current global websocket hub. Use this for
	// tenant-sensitive events until websocket subscriptions are authenticated
	// and topic-filtered.
	SuppressRealtime bool
	// DedupeKey suppresses duplicate event rows for a short window. It is
	// useful for client-driven retries/reloads such as QR scans. The key is
	// persisted in metadata as dedupe_key so downstream consumers can keep the
	// same idempotency boundary.
	DedupeKey    string
	DedupeWindow time.Duration
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
			if err := d.processPendingEvents(ctx); err != nil {
				d.logger.Warn("outbox processing failed", slog.Any("error", err))
			}
		}
	}
}
func (d *Dispatcher) Write(ctx context.Context, event any) error {
	e, ok := event.(WriteEvent)
	if !ok {
		return nil
	}
	metadataValue := withDedupeMetadata(e.Metadata, e.DedupeKey)
	if e.SuppressRealtime {
		metadataValue = withMetadataValue(metadataValue, "suppress_realtime", true)
	}
	if e.DedupeKey != "" && e.DedupeWindow > 0 {
		var exists bool
		seconds := int(e.DedupeWindow.Seconds())
		if seconds < 1 {
			seconds = 1
		}
		if err := postgres.QuerierFromContext(ctx, d.pool).QueryRow(ctx, `
			SELECT EXISTS (
				SELECT 1
				FROM event_outbox
				WHERE restaurant_id = $1
				  AND event_type = $2
				  AND metadata->>'dedupe_key' = $3
				  AND created_at >= NOW() - ($4 * INTERVAL '1 second')
			)
		`, e.RestaurantID, e.EventType, e.DedupeKey, seconds).Scan(&exists); err != nil {
			return err
		}
		if exists {
			return nil
		}
	}
	payload, err := json.Marshal(e.Payload)
	if err != nil {
		return err
	}
	metadata, err := json.Marshal(metadataValue)
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
	if err != nil {
		return err
	}
	return nil
}

func withDedupeMetadata(metadata any, dedupeKey string) any {
	if dedupeKey == "" {
		return metadata
	}
	switch m := metadata.(type) {
	case nil:
		return map[string]any{"dedupe_key": dedupeKey}
	case map[string]any:
		clone := make(map[string]any, len(m)+1)
		for k, v := range m {
			clone[k] = v
		}
		if _, ok := clone["dedupe_key"]; !ok {
			clone["dedupe_key"] = dedupeKey
		}
		return clone
	default:
		return map[string]any{"dedupe_key": dedupeKey, "metadata": m}
	}
}

func withMetadataValue(metadata any, key string, value any) any {
	switch m := metadata.(type) {
	case nil:
		return map[string]any{key: value}
	case map[string]any:
		clone := make(map[string]any, len(m)+1)
		for k, v := range m {
			clone[k] = v
		}
		clone[key] = value
		return clone
	default:
		return map[string]any{key: value, "metadata": m}
	}
}

func (d *Dispatcher) processPendingEvents(ctx context.Context) error {
	rows, err := d.pool.Query(ctx, `
		WITH picked AS (
			SELECT id
			FROM event_outbox
			WHERE (
				status = 'PENDING'
				OR (status = 'PROCESSING' AND lock_expires_at < NOW())
			  )
			  AND available_at <= NOW()
			ORDER BY priority ASC, created_at ASC
			LIMIT 25
			FOR UPDATE SKIP LOCKED
		)
		UPDATE event_outbox e
		SET status = 'PROCESSING',
		    attempts = attempts + 1,
		    locked_at = NOW(),
		    locked_by = 'outbox-dispatcher',
		    lock_expires_at = NOW() + INTERVAL '30 seconds'
		FROM picked
		WHERE e.id = picked.id
		RETURNING e.id, e.restaurant_id, e.aggregate_type, e.aggregate_id, e.event_type, e.payload, e.metadata, e.created_at, e.attempts
	`)
	if err != nil {
		return err
	}
	defer rows.Close()

	var events []Event
	for rows.Next() {
		var e Event
		if err := rows.Scan(&e.ID, &e.RestaurantID, &e.AggregateType, &e.AggregateID, &e.Type, &e.Payload, &e.Metadata, &e.CreatedAt, &e.Attempts); err != nil {
			return err
		}
		events = append(events, e)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	for _, e := range events {
		if e.Type == "dining.qr_scanned" {
			if err := d.writeQRScanAudit(ctx, e); err != nil {
				if markErr := d.markFailed(ctx, e.ID, err); markErr != nil {
					return fmt.Errorf("qr scan audit failed: %w; mark failed: %v", err, markErr)
				}
				continue
			}
		}
		if d.hub != nil && !suppressRealtime(e.Metadata) {
			var payload any
			if len(e.Payload) > 0 {
				if err := json.Unmarshal(e.Payload, &payload); err != nil {

					if markErr := d.markFailed(ctx, e.ID, err); markErr != nil {
						return fmt.Errorf("decode event payload failed: %w; mark failed: %v", err, markErr)
					}
					continue
				}
			}

			if err := d.hub.Broadcast(
				realtime.Topic{RestaurantID: e.RestaurantID},
				realtime.Event{Type: e.Type, Payload: payload},
			); err != nil {
				d.logger.Warn("outbox broadcast failed",
					slog.String("event_id", e.ID.String()),
					slog.String("event_type", e.Type),
					slog.Any("error", err))
			}
		}
		if err := d.markCompleted(ctx, e.ID); err != nil {
			return err
		}
	}
	return nil
}

func suppressRealtime(raw json.RawMessage) bool {
	if len(raw) == 0 {
		return false
	}
	var metadata map[string]any
	if err := json.Unmarshal(raw, &metadata); err != nil {
		return false
	}
	value, _ := metadata["suppress_realtime"].(bool)
	return value
}

func (d *Dispatcher) writeQRScanAudit(ctx context.Context, e Event) error {
	var payload map[string]any
	if len(e.Payload) > 0 {
		if err := json.Unmarshal(e.Payload, &payload); err != nil {
			return err
		}
	}
	var metadata map[string]any
	if len(e.Metadata) > 0 {
		if err := json.Unmarshal(e.Metadata, &metadata); err != nil {
			return err
		}
	}
	auditMetadata := make(map[string]any, len(payload)+len(metadata)+1)
	for k, v := range payload {
		auditMetadata[k] = v
	}
	for k, v := range metadata {
		auditMetadata[k] = v
	}
	auditMetadata["event_id"] = e.ID
	auditMetadataJSON, err := json.Marshal(auditMetadata)
	if err != nil {
		return err
	}

	userAgent, _ := metadata["user_agent"].(string)
	traceID, _ := metadata["trace_id"].(string)
	_, err = d.pool.Exec(ctx, `
		INSERT INTO audit_logs (restaurant_id, actor_type, action, entity_type, entity_id, metadata, ip_address, user_agent, trace_id)
		VALUES ($1, 'GUEST', 'qr.scanned', 'qr_code', $2, $3, NULL, $4, $5)
	`, e.RestaurantID, e.AggregateID, auditMetadataJSON, userAgent, traceID)
	return err
}

func (d *Dispatcher) markCompleted(ctx context.Context, eventID uuid.UUID) error {
	_, err := d.pool.Exec(ctx, `
		UPDATE event_outbox
		SET status = 'COMPLETED',
		    processed_at = NOW(),
		    locked_at = NULL,
		    locked_by = NULL,
		    lock_expires_at = NULL
		WHERE id = $1
	`, eventID)
	return err
}

func (d *Dispatcher) markFailed(ctx context.Context, eventID uuid.UUID, cause error) error {
	_, err := d.pool.Exec(ctx, `
		UPDATE event_outbox
		SET status = CASE WHEN attempts >= max_attempts THEN 'DEAD' ELSE 'PENDING' END,
		    failed_at = NOW(),
		    last_error = $2,
		    available_at = NOW() + (LEAST(attempts, 30) * INTERVAL '1 second'),
		    locked_at = NULL,
		    locked_by = NULL,
		    lock_expires_at = NULL
		WHERE id = $1
	`, eventID, cause.Error())
	return err
}
