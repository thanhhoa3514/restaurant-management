package gateway

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"restaurant-management/internal/modules/billing/domain"
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
