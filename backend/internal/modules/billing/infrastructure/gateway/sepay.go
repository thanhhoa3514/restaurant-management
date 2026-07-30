package gateway

import (
	"bytes"
	"context"
	"crypto/hmac"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"restaurant-management/internal/modules/billing/domain"
	"restaurant-management/internal/shared/apperr"
)

const sePayWebhookTolerance = 5 * time.Minute

var sePayPaymentCodePattern = regexp.MustCompile(`(?:^|[^A-Z0-9])(PAY[A-F0-9]{16})(?:$|[^A-Z0-9])`)

type SePayConfig struct {
	BankCode      string
	AccountNumber string
	AccountName   string
	WebhookSecret string
	QRBaseURL     string
	DemoAmountVND int64
	Now           func() time.Time
}

type SePay struct {
	cfg SePayConfig
	now func() time.Time
}

func NewSePay(cfg SePayConfig) *SePay {
	if strings.TrimSpace(cfg.QRBaseURL) == "" {
		cfg.QRBaseURL = "https://vietqr.app/img"
	}
	now := cfg.Now
	if now == nil {
		now = time.Now
	}
	return &SePay{cfg: cfg, now: now}
}

func (s *SePay) Provider() string { return "sepay" }

func (s *SePay) Initiate(_ context.Context, in domain.InitiateInput) (domain.InitiateResult, error) {
	if in.AmountVND <= 0 {
		return domain.InitiateResult{}, apperr.New(apperr.CodeInvalid, "sepay amount must be positive")
	}
	paymentCode := strings.ToUpper(strings.TrimSpace(in.PaymentNumber))
	if !isSePayPaymentCode(paymentCode) {
		return domain.InitiateResult{}, apperr.New(apperr.CodeInvalid, "invalid sepay payment code")
	}
	if strings.TrimSpace(s.cfg.BankCode) == "" || strings.TrimSpace(s.cfg.AccountNumber) == "" {
		return domain.InitiateResult{}, apperr.New(apperr.CodeNotImplemented, "sepay bank account is not configured")
	}

	qrURL, err := url.Parse(s.cfg.QRBaseURL)
	if err != nil {
		return domain.InitiateResult{}, apperr.Wrap(apperr.CodeInternal, "invalid sepay qr base url", err)
	}
	query := qrURL.Query()
	qrAmountVND := in.AmountVND
	if s.cfg.DemoAmountVND > 0 {
		qrAmountVND = s.cfg.DemoAmountVND
	}
	query.Set("acc", strings.TrimSpace(s.cfg.AccountNumber))
	query.Set("bank", strings.TrimSpace(s.cfg.BankCode))
	query.Set("amount", strconv.FormatInt(qrAmountVND, 10))
	query.Set("des", paymentCode)
	query.Set("template", "compact")
	query.Set("showinfo", "true")
	query.Set("fullacc", "true")
	if holder := strings.TrimSpace(s.cfg.AccountName); holder != "" {
		query.Set("holder", holder)
	}
	qrURL.RawQuery = query.Encode()

	return domain.InitiateResult{
		GatewayTransactionID: "SEPAY-" + paymentCode,
		QRCodeURL:            qrURL.String(),
		Raw: map[string]any{
			"provider":                    "sepay",
			"bank_code":                   strings.TrimSpace(s.cfg.BankCode),
			"account_number":              strings.TrimSpace(s.cfg.AccountNumber),
			"account_name":                strings.TrimSpace(s.cfg.AccountName),
			"payment_code":                paymentCode,
			"invoice_amount_vnd":          in.AmountVND,
			"expected_webhook_amount_vnd": qrAmountVND,
			"demo_amount_override":        qrAmountVND != in.AmountVND,
		},
	}, nil
}

type sePayWebhookPayload struct {
	ID              int64   `json:"id"`
	Gateway         string  `json:"gateway"`
	TransactionDate string  `json:"transactionDate"`
	AccountNumber   string  `json:"accountNumber"`
	SubAccount      string  `json:"subAccount"`
	Code            *string `json:"code"`
	Content         string  `json:"content"`
	TransferType    string  `json:"transferType"`
	Description     string  `json:"description"`
	TransferAmount  int64   `json:"transferAmount"`
	Accumulated     int64   `json:"accumulated"`
	ReferenceCode   string  `json:"referenceCode"`
}

func (s *SePay) ParseWebhook(_ context.Context, raw []byte, headers http.Header) (domain.WebhookEvent, error) {
	if err := s.verifyWebhook(raw, headers); err != nil {
		return domain.WebhookEvent{}, err
	}

	var payload sePayWebhookPayload
	decoder := json.NewDecoder(bytes.NewReader(raw))
	if err := decoder.Decode(&payload); err != nil {
		return domain.WebhookEvent{}, apperr.Wrap(apperr.CodeInvalid, "invalid sepay webhook", err)
	}
	if payload.ID <= 0 || payload.TransferAmount <= 0 {
		return domain.WebhookEvent{}, apperr.New(apperr.CodeInvalid, "invalid sepay transaction")
	}
	if !strings.EqualFold(strings.TrimSpace(payload.TransferType), "in") {
		return domain.WebhookEvent{}, apperr.New(apperr.CodeInvalid, "sepay transaction is not incoming")
	}
	if !strings.EqualFold(strings.TrimSpace(payload.Gateway), strings.TrimSpace(s.cfg.BankCode)) {
		return domain.WebhookEvent{}, apperr.New(apperr.CodeUnauthorized, "unexpected sepay bank")
	}
	if strings.TrimSpace(payload.AccountNumber) != strings.TrimSpace(s.cfg.AccountNumber) {
		return domain.WebhookEvent{}, apperr.New(apperr.CodeUnauthorized, "unexpected sepay account")
	}

	paymentCode := ""
	if payload.Code != nil {
		paymentCode = strings.ToUpper(strings.TrimSpace(*payload.Code))
	}
	if !isSePayPaymentCode(paymentCode) {
		paymentCode = extractSePayPaymentCode(payload.Content)
	}
	if paymentCode == "" {
		return domain.WebhookEvent{}, apperr.New(apperr.CodeInvalid, "sepay payment code is missing")
	}

	rawMap := map[string]any{}
	if err := json.Unmarshal(raw, &rawMap); err != nil {
		return domain.WebhookEvent{}, apperr.Wrap(apperr.CodeInvalid, "invalid sepay webhook payload", err)
	}
	gatewayTransactionID := strings.TrimSpace(payload.ReferenceCode)
	if gatewayTransactionID == "" {
		gatewayTransactionID = fmt.Sprintf("SEPAY-%d", payload.ID)
	}
	return domain.WebhookEvent{
		Provider:             "sepay",
		EventID:              strconv.FormatInt(payload.ID, 10),
		GatewayTransactionID: gatewayTransactionID,
		OrderRef:             paymentCode,
		AmountVND:            payload.TransferAmount,
		Status:               domain.PaymentCompleted,
		Raw:                  rawMap,
	}, nil
}

func (s *SePay) WebhookAck(domain.WebhookEvent) domain.WebhookAck {
	return domain.WebhookAck{
		Status:    http.StatusOK,
		Body:      map[string]any{"success": true},
		Unwrapped: true,
	}
}

func (s *SePay) verifyWebhook(raw []byte, headers http.Header) error {
	if len(raw) == 0 {
		return apperr.New(apperr.CodeInvalid, "empty sepay webhook body")
	}
	secret := s.cfg.WebhookSecret
	if secret == "" {
		return apperr.New(apperr.CodeNotImplemented, "sepay webhook secret is not configured")
	}
	timestampText := strings.TrimSpace(headers.Get("X-SePay-Timestamp"))
	timestamp, err := strconv.ParseInt(timestampText, 10, 64)
	if err != nil || timestamp <= 0 {
		return apperr.New(apperr.CodeUnauthorized, "invalid sepay timestamp")
	}
	delta := s.now().Sub(time.Unix(timestamp, 0))
	if delta < 0 {
		delta = -delta
	}
	if delta > sePayWebhookTolerance {
		return apperr.New(apperr.CodeUnauthorized, "expired sepay webhook")
	}

	signature := strings.TrimSpace(headers.Get("X-SePay-Signature"))
	expected := "sha256=" + hmacSHA256Hex(secret, timestampText+"."+string(raw))
	if len(signature) != len(expected) || !hmac.Equal([]byte(signature), []byte(expected)) {
		return apperr.New(apperr.CodeUnauthorized, "invalid sepay signature")
	}
	return nil
}

func isSePayPaymentCode(code string) bool {
	if len(code) != 19 || !strings.HasPrefix(code, "PAY") {
		return false
	}
	for _, r := range code[3:] {
		if !strings.ContainsRune("0123456789ABCDEF", r) {
			return false
		}
	}
	return true
}

func extractSePayPaymentCode(content string) string {
	matches := sePayPaymentCodePattern.FindStringSubmatch(strings.ToUpper(content))
	if len(matches) != 2 {
		return ""
	}
	return matches[1]
}
