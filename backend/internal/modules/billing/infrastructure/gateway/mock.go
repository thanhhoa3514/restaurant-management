package gateway

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"restaurant-management/internal/modules/billing/domain"
	"restaurant-management/internal/shared/apperr"
)

type MockConfig struct {
	PublicBaseURL string
	Secret        string
}

type Mock struct{ cfg MockConfig }

func NewMock(cfg MockConfig) *Mock {
	return &Mock{cfg: cfg}
}

func (m *Mock) Provider() string { return "mock" }

func (m *Mock) Initiate(_ context.Context, in domain.InitiateInput) (domain.InitiateResult, error) {
	base := strings.TrimRight(m.cfg.PublicBaseURL, "/")
	if base == "" {
		base = "http://localhost:8080"
	}
	payURL := fmt.Sprintf("%s/dev/mock-pay/%s", base, in.PaymentNumber)
	return domain.InitiateResult{
		GatewayTransactionID: "MOCK-" + in.PaymentNumber,
		PayURL:               payURL,
		Deeplink:             payURL,
		QRCodeURL:            payURL,
		Raw: map[string]any{
			"provider":               "mock",
			"gateway_transaction_id": "MOCK-" + in.PaymentNumber,
			"pay_url":                payURL,
			"deeplink":               payURL,
			"qr_code_url":            payURL,
		},
	}, nil
}

type MockWebhookPayload struct {
	EventID              string `json:"event_id"`
	GatewayTransactionID string `json:"gateway_transaction_id"`
	PaymentNumber        string `json:"payment_number"`
	AmountVND            int64  `json:"amount_vnd"`
	Status               string `json:"status"`
}

func (m *Mock) ParseWebhook(_ context.Context, raw []byte, headers http.Header) (domain.WebhookEvent, error) {
	if !verifyHMAC(m.cfg.Secret, string(raw), headers.Get("X-Mock-Signature")) {
		return domain.WebhookEvent{}, apperr.New(apperr.CodeUnauthorized, "invalid mock webhook signature")
	}
	var payload MockWebhookPayload
	if err := json.Unmarshal(raw, &payload); err != nil {
		return domain.WebhookEvent{}, apperr.Wrap(apperr.CodeInvalid, "invalid mock webhook", err)
	}
	if payload.EventID == "" || payload.PaymentNumber == "" || payload.GatewayTransactionID == "" {
		return domain.WebhookEvent{}, apperr.New(apperr.CodeInvalid, "invalid mock webhook")
	}
	status := domain.PaymentFailed
	if strings.EqualFold(payload.Status, "success") || strings.EqualFold(payload.Status, string(domain.PaymentCompleted)) {
		status = domain.PaymentCompleted
	}
	rawMap := map[string]any{}
	_ = json.Unmarshal(raw, &rawMap)
	return domain.WebhookEvent{
		Provider:             "mock",
		EventID:              payload.EventID,
		GatewayTransactionID: payload.GatewayTransactionID,
		OrderRef:             payload.PaymentNumber,
		AmountVND:            payload.AmountVND,
		Status:               status,
		Raw:                  rawMap,
	}, nil
}

func (m *Mock) Sign(raw []byte) string { return hmacSHA256Hex(m.cfg.Secret, string(raw)) }

func BuildMockWebhook(paymentNumber string, amountVND int64, result string) ([]byte, string, error) {
	status := "FAILED"
	if strings.EqualFold(result, "success") || strings.EqualFold(result, "completed") {
		status = "COMPLETED"
	}
	payload := MockWebhookPayload{
		EventID:              "mock:" + paymentNumber + ":" + strings.ToLower(status),
		GatewayTransactionID: "MOCK-" + paymentNumber,
		PaymentNumber:        paymentNumber,
		AmountVND:            amountVND,
		Status:               status,
	}
	raw, err := json.Marshal(payload)
	return raw, payload.EventID, err
}
