package application

import (
	"context"
	"testing"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/billing/domain"
)

type cancelPaymentTx struct{}

func (cancelPaymentTx) Run(ctx context.Context, fn func(context.Context) error) error {
	return fn(ctx)
}

type cancelPaymentRepo struct {
	invoiceID uuid.UUID
	paymentID uuid.UUID
	invoice   *domain.Invoice
}

func (r *cancelPaymentRepo) CancelProcessingPayment(_ context.Context, _ uuid.UUID, invoiceID, paymentID uuid.UUID) (*domain.Invoice, error) {
	r.invoiceID = invoiceID
	r.paymentID = paymentID
	return r.invoice, nil
}

func TestCancelPaymentCancelsSelectedPayment(t *testing.T) {
	restaurantID := uuid.New()
	invoiceID := uuid.New()
	paymentID := uuid.New()
	repo := &cancelPaymentRepo{invoice: &domain.Invoice{
		ID:              invoiceID,
		DiningSessionID: uuid.New(),
		Status:          domain.InvoicePending,
		Payment: &domain.Payment{
			ID:         paymentID,
			Status:     domain.PaymentFailed,
			MethodCode: "sepay",
		},
	}}
	useCase := NewCancelPayment(cancelPaymentTx{}, repo, nil, restaurantID)

	out, err := useCase.Handle(context.Background(), CancelPaymentRequest{
		InvoiceID: invoiceID,
		PaymentID: paymentID,
		ActorID:   uuid.New(),
	})
	if err != nil {
		t.Fatal(err)
	}
	if repo.invoiceID != invoiceID || repo.paymentID != paymentID {
		t.Fatalf("repository received invoice=%s payment=%s", repo.invoiceID, repo.paymentID)
	}
	if out.Invoice.Payment == nil || out.Invoice.Payment.Status != string(domain.PaymentFailed) {
		t.Fatalf("response did not contain cancelled payment: %+v", out.Invoice.Payment)
	}
}
