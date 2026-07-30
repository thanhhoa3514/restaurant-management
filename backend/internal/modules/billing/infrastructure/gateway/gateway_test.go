package gateway

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"

	"restaurant-management/internal/modules/billing/domain"
	"restaurant-management/internal/shared/apperr"
)

func TestMockGatewayInitiateAndParseWebhook(t *testing.T) {
	gateway := NewMock(MockConfig{PublicBaseURL: "http://app.test", Secret: "secret"})
	result, err := gateway.Initiate(context.Background(), domain.InitiateInput{
		PaymentNumber: "PAY-1",
		AmountVND:     120000,
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.GatewayTransactionID != "MOCK-PAY-1" || !strings.Contains(result.PayURL, "/dev/mock-pay/PAY-1") {
		t.Fatalf("unexpected initiate result: %+v", result)
	}

	raw, _, err := BuildMockWebhook("PAY-1", 120000, "success")
	if err != nil {
		t.Fatal(err)
	}
	headers := http.Header{"X-Mock-Signature": []string{gateway.Sign(raw)}}
	event, err := gateway.ParseWebhook(context.Background(), raw, headers)
	if err != nil {
		t.Fatal(err)
	}
	if event.Status != domain.PaymentCompleted || event.OrderRef != "PAY-1" || event.AmountVND != 120000 {
		t.Fatalf("unexpected webhook event: %+v", event)
	}
}

func TestMoMoGatewayInitiateAndParseWebhook(t *testing.T) {
	var seen map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v2/gateway/api/create" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if err := json.NewDecoder(r.Body).Decode(&seen); err != nil {
			t.Fatal(err)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"partnerCode": "MOMO",
			"orderId":     "PAY-2",
			"requestId":   "PAY-2",
			"amount":      150000,
			"resultCode":  0,
			"message":     "ok",
			"payUrl":      "https://pay.momo.vn/PAY-2",
			"deeplink":    "momo://PAY-2",
			"qrCodeUrl":   "https://qr/PAY-2",
		})
	}))
	defer server.Close()

	gateway := NewMoMo(MoMoConfig{
		Endpoint:    server.URL,
		PartnerCode: "MOMO",
		AccessKey:   "access",
		SecretKey:   "secret",
		HTTPClient:  server.Client(),
	})
	result, err := gateway.Initiate(context.Background(), domain.InitiateInput{
		PaymentNumber: "PAY-2",
		AmountVND:     150000,
		Description:   "Invoice PAY-2",
		ReturnURL:     "https://app/cashier",
		IPNURL:        "https://app/api/v1/billing/payments/webhook/momo",
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.PayURL == "" || seen["signature"] == "" {
		t.Fatalf("missing pay url/signature result=%+v request=%+v", result, seen)
	}

	ipn := map[string]any{
		"partnerCode":  "MOMO",
		"orderId":      "PAY-2",
		"requestId":    "PAY-2",
		"amount":       int64(150000),
		"orderInfo":    "Invoice PAY-2",
		"orderType":    "momo_wallet",
		"transId":      "MOMO-TXN-2",
		"resultCode":   0,
		"message":      "Successful",
		"payType":      "qr",
		"responseTime": 1710000000000,
		"extraData":    "",
	}
	signData := "accessKey=access&amount=150000&extraData=&message=Successful&orderId=PAY-2&orderInfo=Invoice PAY-2&orderType=momo_wallet&partnerCode=MOMO&payType=qr&requestId=PAY-2&responseTime=1710000000000&resultCode=0&transId=MOMO-TXN-2"
	ipn["signature"] = hmacSHA256Hex("secret", signData)
	raw, _ := json.Marshal(ipn)
	event, err := gateway.ParseWebhook(context.Background(), raw, nil)
	if err != nil {
		t.Fatal(err)
	}
	if event.Status != domain.PaymentCompleted || event.GatewayTransactionID != "MOMO-TXN-2" || event.OrderRef != "PAY-2" {
		t.Fatalf("unexpected momo event: %+v", event)
	}
}

func TestSePayGatewayInitiateAndParseWebhook(t *testing.T) {
	now := time.Unix(1_752_000_000, 0)
	gateway := NewSePay(SePayConfig{
		BankCode:      "Vietcombank",
		AccountNumber: "0000000001",
		AccountName:   "HO KINH DOANH TEST 3CBA",
		WebhookSecret: "test-secret",
		QRBaseURL:     "https://vietqr.app/img",
		Now:           func() time.Time { return now },
	})
	paymentCode := "PAY0123456789ABCDEF"
	result, err := gateway.Initiate(context.Background(), domain.InitiateInput{
		PaymentNumber: paymentCode,
		AmountVND:     150000,
	})
	if err != nil {
		t.Fatal(err)
	}
	qrURL, err := url.Parse(result.QRCodeURL)
	if err != nil {
		t.Fatal(err)
	}
	query := qrURL.Query()
	if query.Get("acc") != "0000000001" || query.Get("bank") != "Vietcombank" ||
		query.Get("amount") != "150000" || query.Get("des") != paymentCode {
		t.Fatalf("unexpected SePay QR query: %s", qrURL.RawQuery)
	}
	if result.Raw["expected_webhook_amount_vnd"] != int64(150000) ||
		result.Raw["demo_amount_override"] != false {
		t.Fatalf("unexpected SePay reconciliation metadata: %+v", result.Raw)
	}

	raw := []byte(`{"id":92704,"gateway":"Vietcombank","transactionDate":"2026-07-26 12:00:00","accountNumber":"0000000001","subAccount":"","code":null,"content":"PAY0123456789ABCDEF thanh toan","transferType":"in","description":"sandbox","transferAmount":150000,"accumulated":500000,"referenceCode":"SB1A2B3C4"}`)
	timestamp := strconv.FormatInt(now.Unix(), 10)
	headers := http.Header{
		"X-Sepay-Timestamp": []string{timestamp},
		"X-Sepay-Signature": []string{"sha256=" + hmacSHA256Hex("test-secret", timestamp+"."+string(raw))},
	}
	event, err := gateway.ParseWebhook(context.Background(), raw, headers)
	if err != nil {
		t.Fatal(err)
	}
	if event.Provider != "sepay" || event.EventID != "92704" ||
		event.GatewayTransactionID != "SB1A2B3C4" || event.OrderRef != paymentCode ||
		event.AmountVND != 150000 || event.Status != domain.PaymentCompleted {
		t.Fatalf("unexpected SePay event: %+v", event)
	}
	ack := gateway.WebhookAck(event)
	if ack.Status != http.StatusOK || !ack.Unwrapped {
		t.Fatalf("unexpected SePay ack: %+v", ack)
	}
}

func TestSePayGatewayDemoAmountKeepsInvoiceAmountSeparate(t *testing.T) {
	gateway := NewSePay(SePayConfig{
		BankCode:      "VPBank",
		AccountNumber: "123456789",
		AccountName:   "TEST HOLDER",
		WebhookSecret: "test-secret",
		DemoAmountVND: 5000,
	})

	result, err := gateway.Initiate(context.Background(), domain.InitiateInput{
		PaymentNumber: "PAY0123456789ABCDEF",
		AmountVND:     875000,
	})
	if err != nil {
		t.Fatal(err)
	}
	qrURL, err := url.Parse(result.QRCodeURL)
	if err != nil {
		t.Fatal(err)
	}
	if got := qrURL.Query().Get("amount"); got != "5000" {
		t.Fatalf("QR amount=%q, want 5000", got)
	}
	if result.Raw["invoice_amount_vnd"] != int64(875000) {
		t.Fatalf("invoice amount metadata=%v, want 875000", result.Raw["invoice_amount_vnd"])
	}
	if result.Raw["expected_webhook_amount_vnd"] != int64(5000) ||
		result.Raw["demo_amount_override"] != true {
		t.Fatalf("unexpected SePay demo reconciliation metadata: %+v", result.Raw)
	}
}

func TestSePayGatewayRejectsInvalidWebhook(t *testing.T) {
	now := time.Unix(1_752_000_000, 0)
	gateway := NewSePay(SePayConfig{
		BankCode:      "Vietcombank",
		AccountNumber: "0000000001",
		WebhookSecret: "test-secret",
		Now:           func() time.Time { return now },
	})
	validRaw := []byte(`{"id":92704,"gateway":"Vietcombank","accountNumber":"0000000001","code":"PAY0123456789ABCDEF","content":"PAY0123456789ABCDEF","transferType":"in","transferAmount":150000,"referenceCode":"SB1A2B3C4"}`)

	t.Run("tampered body", func(t *testing.T) {
		timestamp := strconv.FormatInt(now.Unix(), 10)
		headers := http.Header{
			"X-Sepay-Timestamp": []string{timestamp},
			"X-Sepay-Signature": []string{"sha256=" + hmacSHA256Hex("test-secret", timestamp+"."+string(validRaw))},
		}
		tampered := bytes.Replace(validRaw, []byte("150000"), []byte("150001"), 1)
		_, err := gateway.ParseWebhook(context.Background(), tampered, headers)
		if !apperr.Is(err, apperr.CodeUnauthorized) {
			t.Fatalf("expected unauthorized tampered webhook, got %v", err)
		}
	})

	t.Run("expired timestamp", func(t *testing.T) {
		timestamp := strconv.FormatInt(now.Add(-6*time.Minute).Unix(), 10)
		headers := http.Header{
			"X-Sepay-Timestamp": []string{timestamp},
			"X-Sepay-Signature": []string{"sha256=" + hmacSHA256Hex("test-secret", timestamp+"."+string(validRaw))},
		}
		_, err := gateway.ParseWebhook(context.Background(), validRaw, headers)
		if !apperr.Is(err, apperr.CodeUnauthorized) {
			t.Fatalf("expected unauthorized expired webhook, got %v", err)
		}
	})

	t.Run("wrong account", func(t *testing.T) {
		raw := bytes.Replace(validRaw, []byte("0000000001"), []byte("0000000002"), 1)
		timestamp := strconv.FormatInt(now.Unix(), 10)
		headers := http.Header{
			"X-Sepay-Timestamp": []string{timestamp},
			"X-Sepay-Signature": []string{"sha256=" + hmacSHA256Hex("test-secret", timestamp+"."+string(raw))},
		}
		_, err := gateway.ParseWebhook(context.Background(), raw, headers)
		if !apperr.Is(err, apperr.CodeUnauthorized) {
			t.Fatalf("expected unauthorized account, got %v", err)
		}
	})
}

func TestZaloPayGatewayInitiateAndParseWebhook(t *testing.T) {
	var form url.Values
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v2/create" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		body, _ := io.ReadAll(r.Body)
		form, _ = url.ParseQuery(string(body))
		_ = json.NewEncoder(w).Encode(map[string]any{
			"return_code":    1,
			"return_message": "success",
			"order_url":      "https://zalopay.vn/pay/PAY-3",
			"zp_trans_token": "token-3",
		})
	}))
	defer server.Close()

	gateway := NewZaloPay(ZaloPayConfig{
		Endpoint:   server.URL,
		AppID:      "2553",
		Key1:       "key1",
		Key2:       "key2",
		HTTPClient: server.Client(),
	})
	result, err := gateway.Initiate(context.Background(), domain.InitiateInput{
		PaymentNumber: "PAY-3",
		AmountVND:     99000,
		Description:   "Invoice PAY-3",
		ReturnURL:     "https://app/cashier",
		IPNURL:        "https://app/api/v1/billing/payments/webhook/zalopay",
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.PayURL == "" || form.Get("mac") == "" || !strings.HasSuffix(result.GatewayTransactionID, "_PAY-3") {
		t.Fatalf("unexpected zalopay initiate result=%+v form=%+v", result, form)
	}

	data := `{"app_trans_id":"230605_PAY-3","zp_trans_id":"ZP-3","amount":99000}`
	raw, _ := json.Marshal(map[string]any{"data": data, "mac": hmacSHA256Hex("key2", data), "type": 1})
	event, err := gateway.ParseWebhook(context.Background(), raw, nil)
	if err != nil {
		t.Fatal(err)
	}
	if event.Status != domain.PaymentCompleted || event.OrderRef != "PAY-3" || event.GatewayTransactionID != "ZP-3" {
		t.Fatalf("unexpected zalopay event: %+v", event)
	}
}
