package application

import (
	"testing"

	"github.com/google/uuid"

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

func TestTerminalPaymentStatusIgnoresLateWebhook(t *testing.T) {
	for _, status := range []domain.PaymentStatus{
		domain.PaymentCompleted,
		domain.PaymentFailed,
		domain.PaymentRefunded,
	} {
		if !isTerminalPaymentStatus(status) {
			t.Fatalf("status %s should be terminal", status)
		}
	}
	if isTerminalPaymentStatus(domain.PaymentProcessing) {
		t.Fatal("processing payment must still accept its webhook")
	}
}

func TestWebhookTransitionMustMatchTargetPaymentAndStatus(t *testing.T) {
	paymentID := uuid.New()
	invoice := &domain.Invoice{Payment: &domain.Payment{
		ID:     paymentID,
		Status: domain.PaymentCompleted,
	}}
	if !webhookTransitionApplied(invoice, paymentID, domain.PaymentCompleted) {
		t.Fatal("matching completed payment should be accepted")
	}
	if webhookTransitionApplied(invoice, paymentID, domain.PaymentFailed) {
		t.Fatal("mismatched status must be ignored")
	}
	if webhookTransitionApplied(invoice, uuid.New(), domain.PaymentCompleted) {
		t.Fatal("mismatched payment must be ignored")
	}
}
