package application

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/billing/domain"
)

func TestWritePaymentCompletedOnlyClosesSessionsReportedByTransaction(t *testing.T) {
	restaurantID := uuid.New()
	primaryID := uuid.New()
	memberID := uuid.New()
	invoice := &domain.Invoice{
		ID:              uuid.New(),
		DiningSessionID: primaryID,
		Payment: &domain.Payment{
			ID:     uuid.New(),
			Status: domain.PaymentCompleted,
		},
	}
	events := &cancelSessionOutbox{}
	useCase := &ProcessPayment{outbox: events, defaultRestaurantID: restaurantID}

	if err := useCase.writePaymentCompleted(context.Background(), invoice, uuid.New()); err != nil {
		t.Fatal(err)
	}
	if len(events.events) != 1 || events.events[0].EventType != "billing.payment_completed" {
		t.Fatalf("an open split bill must not emit session closed: %+v", events.events)
	}

	events.events = nil
	invoice.ClosedSessionIDs = []uuid.UUID{primaryID, memberID}
	if err := useCase.writePaymentCompleted(context.Background(), invoice, uuid.New()); err != nil {
		t.Fatal(err)
	}
	if len(events.events) != 3 {
		t.Fatalf("expected payment plus two session events, got %+v", events.events)
	}
	if events.events[1].AggregateID != primaryID || events.events[2].AggregateID != memberID {
		t.Fatalf("merged session events have wrong scope: %+v", events.events)
	}
}

func TestIsGatewayOnlyPaymentMethod(t *testing.T) {
	tests := []struct {
		name   string
		method *domain.PaymentMethod
		want   bool
	}{
		{name: "sepay bank transfer", method: &domain.PaymentMethod{Code: "sepay", Type: "BANK_TRANSFER"}, want: true},
		{name: "e-wallet", method: &domain.PaymentMethod{Code: "zalopay", Type: "E_WALLET"}, want: true},
		{name: "cash", method: &domain.PaymentMethod{Code: "cash", Type: "CASH"}, want: false},
		{name: "card", method: &domain.PaymentMethod{Code: "card", Type: "CARD"}, want: false},
		{name: "nil", method: nil, want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := isGatewayOnlyPaymentMethod(tt.method); got != tt.want {
				t.Fatalf("isGatewayOnlyPaymentMethod(%+v) = %v, want %v", tt.method, got, tt.want)
			}
		})
	}
}

func TestPaymentInitiatedPayloadCarriesGuestSessionAndQR(t *testing.T) {
	sessionID := uuid.New()
	invoice := &domain.Invoice{
		ID:              uuid.New(),
		DiningSessionID: sessionID,
		Payment: &domain.Payment{
			ID:            uuid.New(),
			PaymentNumber: "PAY0123456789ABCDEF",
			MethodCode:    "sepay",
			AmountVND:     275000,
			Status:        domain.PaymentProcessing,
			QRCodeURL:     "https://vietqr.app/img?acc=0000000001",
		},
	}

	payload := paymentInitiatedPayload(invoice)
	if payload["dining_session_id"] != sessionID {
		t.Fatalf("payload is not scoped to the guest session: %+v", payload)
	}
	if payload["qr_code_url"] != invoice.Payment.QRCodeURL ||
		payload["payment_number"] != invoice.Payment.PaymentNumber ||
		payload["amount_vnd"] != invoice.Payment.AmountVND {
		t.Fatalf("payload omitted guest payment details: %+v", payload)
	}
}
