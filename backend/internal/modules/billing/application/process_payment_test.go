package application

import (
	"testing"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/billing/domain"
)

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
