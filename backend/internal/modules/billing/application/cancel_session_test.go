package application

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/billing/domain"
	"restaurant-management/internal/platform/outbox"
	"restaurant-management/internal/shared/apperr"
)

type cancelSessionTx struct{}

func (cancelSessionTx) Run(ctx context.Context, fn func(context.Context) error) error {
	return fn(ctx)
}

type cancelSessionRepo struct {
	gotSessionID uuid.UUID
	gotActorID   uuid.UUID
	result       *domain.SessionCancellationResult
}

func (r *cancelSessionRepo) CancelSession(_ context.Context, _ uuid.UUID, sessionID, actorID uuid.UUID) (*domain.SessionCancellationResult, error) {
	r.gotSessionID = sessionID
	r.gotActorID = actorID
	return r.result, nil
}

type cancelSessionOutbox struct {
	events []outbox.WriteEvent
}

func (w *cancelSessionOutbox) Write(_ context.Context, event any) error {
	if e, ok := event.(outbox.WriteEvent); ok {
		w.events = append(w.events, e)
	}
	return nil
}

func TestCancelSessionClosesAndVoidsInOneTransaction(t *testing.T) {
	restaurantID := uuid.New()
	sessionID := uuid.New()
	memberSessionID := uuid.New()
	actorID := uuid.New()
	invoiceID := uuid.New()
	repo := &cancelSessionRepo{result: &domain.SessionCancellationResult{
		SessionID:        sessionID,
		SessionIDs:       []uuid.UUID{sessionID, memberSessionID},
		VoidedInvoiceIDs: []uuid.UUID{invoiceID},
		ClosedNow:        true,
	}}
	events := &cancelSessionOutbox{}
	useCase := NewCancelSession(cancelSessionTx{}, repo, events, restaurantID)

	out, err := useCase.Handle(context.Background(), CancelSessionRequest{
		SessionID: sessionID,
		ActorID:   actorID,
	})
	if err != nil {
		t.Fatal(err)
	}
	if repo.gotSessionID != sessionID || repo.gotActorID != actorID {
		t.Fatalf("repository received session=%s actor=%s", repo.gotSessionID, repo.gotActorID)
	}
	if out.Status != "CLOSED" || len(out.VoidedInvoiceIDs) != 1 || out.VoidedInvoiceIDs[0] != invoiceID {
		t.Fatalf("unexpected response: %+v", out)
	}
	if len(events.events) != 3 || events.events[0].EventType != "billing.invoice_voided" || events.events[1].EventType != "dining.session_closed" || events.events[2].EventType != "dining.session_closed" {
		t.Fatalf("unexpected outbox events: %+v", events.events)
	}
	if events.events[1].AggregateID != sessionID || events.events[2].AggregateID != memberSessionID {
		t.Fatalf("session events were not scoped to every merged member: %+v", events.events)
	}
}

func TestCancelSessionRejectsMissingActor(t *testing.T) {
	_, err := NewCancelSession(cancelSessionTx{}, &cancelSessionRepo{}, nil, uuid.New()).Handle(
		context.Background(),
		CancelSessionRequest{SessionID: uuid.New()},
	)
	if !apperr.Is(err, apperr.CodeUnauthorized) {
		t.Fatalf("expected unauthorized, got %v", err)
	}
}
