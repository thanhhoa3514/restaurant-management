package postgres

import (
	"regexp"
	"testing"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/billing/domain"
	"restaurant-management/internal/shared/apperr"
)

func TestRandomPaymentCodeMatchesSePayStructure(t *testing.T) {
	code, err := randomPaymentCode()
	if err != nil {
		t.Fatal(err)
	}
	if !regexp.MustCompile(`^PAY[A-F0-9]{16}$`).MatchString(code) {
		t.Fatalf("payment code %q does not match SePay structure", code)
	}
}

func TestShouldCloseSession(t *testing.T) {
	if !shouldCloseSession(0) {
		t.Fatal("expected close when no other invoice is open")
	}
	if shouldCloseSession(1) {
		t.Fatal("expected no close when another invoice (e.g. an unpaid split sibling) is still open")
	}
}

func TestShouldReopenSessionAfterVoid(t *testing.T) {
	if !shouldReopenSessionAfterVoid(0) {
		t.Fatal("expected session to reopen after its final non-VOID invoice is voided")
	}
	if shouldReopenSessionAfterVoid(1) {
		t.Fatal("expected session to remain awaiting payment while a split sibling invoice remains")
	}
}

func TestValidateSplitGroupsPartitionsExactly(t *testing.T) {
	id1, id2, id3, id4 := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	billable := map[uuid.UUID]billableItem{
		id1: {OrderItemID: id1}, id2: {OrderItemID: id2}, id3: {OrderItemID: id3}, id4: {OrderItemID: id4},
	}
	groups := []domain.SplitGroupInput{
		{Label: "Người 1", OrderItemIDs: []uuid.UUID{id1, id2}},
		{Label: "Người 2", OrderItemIDs: []uuid.UUID{id3, id4}},
	}
	if err := validateSplitGroups(billable, groups); err != nil {
		t.Fatalf("expected valid partition, got %v", err)
	}
}

func TestValidateSplitGroupsRejectsFewerThanTwoGroups(t *testing.T) {
	id1 := uuid.New()
	billable := map[uuid.UUID]billableItem{id1: {OrderItemID: id1}}
	groups := []domain.SplitGroupInput{{Label: "Người 1", OrderItemIDs: []uuid.UUID{id1}}}
	err := validateSplitGroups(billable, groups)
	if !apperr.Is(err, apperr.CodeInvalid) {
		t.Fatalf("expected CodeInvalid, got %v", err)
	}
}

func TestValidateSplitGroupsRejectsDuplicateAssignment(t *testing.T) {
	id1, id2 := uuid.New(), uuid.New()
	billable := map[uuid.UUID]billableItem{id1: {OrderItemID: id1}, id2: {OrderItemID: id2}}
	groups := []domain.SplitGroupInput{
		{Label: "Người 1", OrderItemIDs: []uuid.UUID{id1, id2}},
		{Label: "Người 2", OrderItemIDs: []uuid.UUID{id2}},
	}
	err := validateSplitGroups(billable, groups)
	if !apperr.Is(err, apperr.CodeInvalid) {
		t.Fatalf("expected CodeInvalid for double-assigned item, got %v", err)
	}
}

func TestValidateSplitGroupsRejectsUnknownItem(t *testing.T) {
	id1, foreign := uuid.New(), uuid.New()
	billable := map[uuid.UUID]billableItem{id1: {OrderItemID: id1}}
	groups := []domain.SplitGroupInput{
		{Label: "Người 1", OrderItemIDs: []uuid.UUID{id1}},
		{Label: "Người 2", OrderItemIDs: []uuid.UUID{foreign}},
	}
	err := validateSplitGroups(billable, groups)
	if !apperr.Is(err, apperr.CodeInvalid) {
		t.Fatalf("expected CodeInvalid for unknown order_item_id, got %v", err)
	}
}

func TestValidateSplitGroupsRejectsLeftoverItem(t *testing.T) {
	id1, id2 := uuid.New(), uuid.New()
	billable := map[uuid.UUID]billableItem{id1: {OrderItemID: id1}, id2: {OrderItemID: id2}}
	groups := []domain.SplitGroupInput{
		{Label: "Người 1", OrderItemIDs: []uuid.UUID{id1}},
		{Label: "Người 2", OrderItemIDs: []uuid.UUID{}},
	}
	err := validateSplitGroups(billable, groups)
	if !apperr.Is(err, apperr.CodeInvalid) {
		t.Fatalf("expected CodeInvalid for empty group, got %v", err)
	}
}

func TestInvoiceTotalsWorkedExample(t *testing.T) {
	subtotal := int64(500000)
	discount := int64(50000)
	base := subtotal - discount
	service := roundBPS(base, 500)
	vat := roundBPS(base+service, 800)
	total := base + service + vat

	if service != 22500 {
		t.Fatalf("service charge = %d, want 22500", service)
	}
	if vat != 37800 {
		t.Fatalf("vat = %d, want 37800", vat)
	}
	if total != 510300 {
		t.Fatalf("total = %d, want 510300", total)
	}
}

func TestCalculatePartialPaymentAllowsMultipleCompletedPayments(t *testing.T) {
	first, err := calculatePartialPayment(0, 300000, 1000000, true)
	if err != nil {
		t.Fatalf("first partial payment failed: %v", err)
	}
	if first.RunningPaid != 300000 || first.Status != "PARTIALLY_PAID" || first.Change != 0 {
		t.Fatalf("first payment returned %+v", first)
	}

	second, err := calculatePartialPayment(first.RunningPaid, 700000, 1000000, true)
	if err != nil {
		t.Fatalf("second partial payment failed: %v", err)
	}
	if second.RunningPaid != 1000000 || second.Status != "PAID" || second.Change != 0 {
		t.Fatalf("second payment returned %+v", second)
	}
}

func TestCalculatePartialPaymentCashOverpaymentBecomesChange(t *testing.T) {
	got, err := calculatePartialPayment(300000, 1000000, 1000000, true)
	if err != nil {
		t.Fatalf("cash overpayment failed: %v", err)
	}
	if got.Applied != 700000 || got.Change != 300000 {
		t.Fatalf("applied=%d change=%d, want 700000/300000", got.Applied, got.Change)
	}
	if got.RunningPaid != 1000000 || got.Status != "PAID" {
		t.Fatalf("running=%d status=%s, want 1000000/PAID", got.RunningPaid, got.Status)
	}
}

func TestCalculatePartialPaymentRejectsNonCashOverpayment(t *testing.T) {
	_, err := calculatePartialPayment(300000, 700001, 1000000, false)
	if !apperr.Is(err, apperr.CodeInvalid) {
		t.Fatalf("expected CodeInvalid for overpayment, got %v", err)
	}
}

func TestCalculatePartialPaymentRejectsWhenNothingLeft(t *testing.T) {
	_, err := calculatePartialPayment(1000000, 1000, 1000000, true)
	if !apperr.Is(err, apperr.CodeInvalid) {
		t.Fatalf("expected CodeInvalid when invoice already settled, got %v", err)
	}
}
