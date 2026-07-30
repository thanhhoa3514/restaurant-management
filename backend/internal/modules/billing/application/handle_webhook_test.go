package application

import (
	"testing"

	"restaurant-management/internal/modules/billing/domain"
)

func TestExpectedWebhookAmountUsesConfiguredGatewayAmount(t *testing.T) {
	payment := &domain.WebhookPayment{
		AmountVND:        875000,
		WebhookAmountVND: 5000,
	}

	if got := expectedWebhookAmount(payment); got != 5000 {
		t.Fatalf("expectedWebhookAmount=%d, want 5000", got)
	}
}

func TestExpectedWebhookAmountFallsBackToInvoicePaymentAmount(t *testing.T) {
	payment := &domain.WebhookPayment{AmountVND: 875000}

	if got := expectedWebhookAmount(payment); got != 875000 {
		t.Fatalf("expectedWebhookAmount=%d, want 875000", got)
	}
}
