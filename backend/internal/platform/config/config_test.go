package config

import "testing"

func TestLoadAcceptsSePayBankAndHolderAliases(t *testing.T) {
	t.Setenv("SEPAY_BANK_CODE", "")
	t.Setenv("SEPAY_ACCOUNT_NAME", "")
	t.Setenv("SEPAY_BANK", "VPBank")
	t.Setenv("SEPAY_ACCOUNT_HOLDER", "TEST ACCOUNT HOLDER")
	t.Setenv("SEPAY_DEMO_AMOUNT_VND", "5000")

	cfg := Load()

	if cfg.SePayBankCode != "VPBank" {
		t.Fatalf("SePayBankCode=%q, want VPBank", cfg.SePayBankCode)
	}
	if cfg.SePayAccountName != "TEST ACCOUNT HOLDER" {
		t.Fatalf("SePayAccountName=%q, want alias value", cfg.SePayAccountName)
	}
	if cfg.SePayDemoAmountVND != 5000 {
		t.Fatalf("SePayDemoAmountVND=%d, want 5000", cfg.SePayDemoAmountVND)
	}
}

func TestLoadPrefersCanonicalSePayNames(t *testing.T) {
	t.Setenv("SEPAY_BANK_CODE", "Vietcombank")
	t.Setenv("SEPAY_BANK", "VPBank")
	t.Setenv("SEPAY_ACCOUNT_NAME", "CANONICAL HOLDER")
	t.Setenv("SEPAY_ACCOUNT_HOLDER", "ALIAS HOLDER")

	cfg := Load()

	if cfg.SePayBankCode != "Vietcombank" {
		t.Fatalf("SePayBankCode=%q, want canonical value", cfg.SePayBankCode)
	}
	if cfg.SePayAccountName != "CANONICAL HOLDER" {
		t.Fatalf("SePayAccountName=%q, want canonical value", cfg.SePayAccountName)
	}
}
