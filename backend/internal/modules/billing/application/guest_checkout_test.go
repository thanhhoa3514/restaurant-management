package application

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/billing/domain"
	"restaurant-management/internal/platform/guest"
	"restaurant-management/internal/shared/apperr"
)

type guestCheckoutRepo struct {
	restaurantID  uuid.UUID
	sessionID     uuid.UUID
	sessionStatus string
	invoices      []*domain.Invoice
}

func (r *guestCheckoutRepo) ListSessionInvoices(_ context.Context, restaurantID, sessionID uuid.UUID) ([]*domain.Invoice, error) {
	r.restaurantID = restaurantID
	r.sessionID = sessionID
	return r.invoices, nil
}

func (r *guestCheckoutRepo) GuestSessionStatus(_ context.Context, restaurantID, sessionID uuid.UUID) (string, error) {
	r.restaurantID = restaurantID
	r.sessionID = sessionID
	return r.sessionStatus, nil
}

func TestGuestCheckoutUsesAuthenticatedSessionScope(t *testing.T) {
	restaurantID := uuid.New()
	sessionID := uuid.New()
	repo := &guestCheckoutRepo{sessionStatus: "AWAITING_PAYMENT", invoices: []*domain.Invoice{{
		ID:              uuid.New(),
		DiningSessionID: sessionID,
		Status:          domain.InvoicePending,
		Payment: &domain.Payment{
			ID:            uuid.New(),
			PaymentNumber: "PAY0123456789ABCDEF",
			MethodCode:    "sepay",
			Status:        domain.PaymentProcessing,
			QRCodeURL:     "https://vietqr.app/img?acc=0000000001",
		},
	}}}
	usecase := NewGuestCheckout(repo, uuid.New())
	ctx := guest.WithSession(context.Background(), guest.Session{
		RestaurantID: restaurantID,
		SessionID:    sessionID,
		TableID:      uuid.New(),
	})

	out, err := usecase.Handle(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if repo.restaurantID != restaurantID || repo.sessionID != sessionID {
		t.Fatalf("unexpected repository scope restaurant=%s session=%s", repo.restaurantID, repo.sessionID)
	}
	if out.SessionStatus != "AWAITING_PAYMENT" {
		t.Fatalf("session status=%q, want AWAITING_PAYMENT", out.SessionStatus)
	}
	if len(out.Invoices) != 1 || out.Invoices[0].Payment == nil ||
		out.Invoices[0].Payment.QRCodeURL == "" {
		t.Fatalf("guest checkout omitted payment QR: %+v", out)
	}
}

func TestGuestCheckoutRejectsMissingSession(t *testing.T) {
	_, err := NewGuestCheckout(&guestCheckoutRepo{}, uuid.New()).Handle(context.Background())
	if !apperr.Is(err, apperr.CodeUnauthorized) {
		t.Fatalf("expected unauthorized, got %v", err)
	}
}

func TestGuestCheckoutReturnsActiveSessionEvenWithStalePendingInvoice(t *testing.T) {
	restaurantID := uuid.New()
	sessionID := uuid.New()
	repo := &guestCheckoutRepo{
		sessionStatus: "ACTIVE",
		invoices: []*domain.Invoice{{
			ID:              uuid.New(),
			DiningSessionID: sessionID,
			Status:          domain.InvoicePending,
		}},
	}
	ctx := guest.WithSession(context.Background(), guest.Session{
		RestaurantID: restaurantID,
		SessionID:    sessionID,
	})

	out, err := NewGuestCheckout(repo, restaurantID).Handle(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if out.SessionStatus != "ACTIVE" {
		t.Fatalf("session status=%q, want ACTIVE", out.SessionStatus)
	}
	if len(out.Invoices) != 1 || out.Invoices[0].Status != string(domain.InvoicePending) {
		t.Fatalf("expected stale pending invoice to remain visible alongside authoritative status: %+v", out)
	}
}
