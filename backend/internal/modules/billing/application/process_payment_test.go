package application

import (
	"testing"

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
