package postgres

import "testing"

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
