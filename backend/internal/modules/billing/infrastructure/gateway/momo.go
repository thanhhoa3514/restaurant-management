package gateway

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"restaurant-management/internal/modules/billing/domain"
	"restaurant-management/internal/shared/apperr"
)

type MoMoConfig struct {
	Endpoint    string
	PartnerCode string
	AccessKey   string
	SecretKey   string
	HTTPClient  *http.Client
}

type MoMo struct {
	cfg    MoMoConfig
	client *http.Client
}

func NewMoMo(cfg MoMoConfig) *MoMo { return &MoMo{cfg: cfg, client: clientOrDefault(cfg.HTTPClient)} }

func (m *MoMo) Provider() string { return "momo" }

func (m *MoMo) Initiate(ctx context.Context, in domain.InitiateInput) (domain.InitiateResult, error) {
	endpoint := strings.TrimRight(m.cfg.Endpoint, "/") + "/v2/gateway/api/create"
	amountStr := strconv.FormatInt(in.AmountVND, 10)
	req := map[string]any{
		"partnerCode": m.cfg.PartnerCode,
		"accessKey":   m.cfg.AccessKey,
		"requestId":   in.PaymentNumber,
		"amount":      amountStr,
		"orderId":     in.PaymentNumber,
		"orderInfo":   in.Description,
		"redirectUrl": in.ReturnURL,
		"ipnUrl":      in.IPNURL,
		"extraData":   "",
		"requestType": "captureWallet",
		"lang":        "vi",
	}
	signData := fmt.Sprintf("accessKey=%s&amount=%s&extraData=&ipnUrl=%s&orderId=%s&orderInfo=%s&partnerCode=%s&redirectUrl=%s&requestId=%s&requestType=captureWallet",
		m.cfg.AccessKey, amountStr, in.IPNURL, in.PaymentNumber, in.Description, m.cfg.PartnerCode, in.ReturnURL, in.PaymentNumber)
	req["signature"] = hmacSHA256Hex(m.cfg.SecretKey, signData)

	var resp struct {
		PartnerCode string `json:"partnerCode"`
		OrderID     string `json:"orderId"`
		RequestID   string `json:"requestId"`
		Amount      int64  `json:"amount"`
		ResultCode  int    `json:"resultCode"`
		Message     string `json:"message"`
		PayURL      string `json:"payUrl"`
		Deeplink    string `json:"deeplink"`
		QRCodeURL   string `json:"qrCodeUrl"`
	}
	request, err := json.Marshal(req)
	if err != nil {
		return domain.InitiateResult{}, err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(string(request)))
	if err != nil {
		return domain.InitiateResult{}, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpResp, err := m.client.Do(httpReq)
	if err != nil {
		return domain.InitiateResult{}, err
	}
	defer httpResp.Body.Close()
	if err := json.NewDecoder(httpResp.Body).Decode(&resp); err != nil {
		return domain.InitiateResult{}, apperr.Wrap(apperr.CodeInternal, "invalid momo response", err)
	}
	if httpResp.StatusCode < 200 || httpResp.StatusCode >= 300 || resp.ResultCode != 0 {
		return domain.InitiateResult{}, apperr.New(apperr.CodeInternal, "momo initiate failed: "+resp.Message)
	}
	raw := map[string]any{}
	b, _ := json.Marshal(resp)
	_ = json.Unmarshal(b, &raw)
	gatewayID := resp.RequestID
	if resp.OrderID != "" {
		gatewayID = resp.OrderID
	}
	return domain.InitiateResult{GatewayTransactionID: gatewayID, PayURL: resp.PayURL, Deeplink: resp.Deeplink, QRCodeURL: resp.QRCodeURL, Raw: raw}, nil
}

type momoIPN struct {
	PartnerCode  string `json:"partnerCode"`
	OrderID      string `json:"orderId"`
	RequestID    string `json:"requestId"`
	Amount       int64  `json:"amount"`
	OrderInfo    string `json:"orderInfo"`
	OrderType    string `json:"orderType"`
	TransID      any    `json:"transId"`
	ResultCode   int    `json:"resultCode"`
	Message      string `json:"message"`
	PayType      string `json:"payType"`
	ResponseTime any    `json:"responseTime"`
	ExtraData    string `json:"extraData"`
	Signature    string `json:"signature"`
}

func (m *MoMo) ParseWebhook(_ context.Context, raw []byte, _ http.Header) (domain.WebhookEvent, error) {
	var payload momoIPN
	if err := json.Unmarshal(raw, &payload); err != nil {
		return domain.WebhookEvent{}, apperr.Wrap(apperr.CodeInvalid, "invalid momo ipn", err)
	}
	responseTime := gatewayString(payload.ResponseTime)
	transID := gatewayString(payload.TransID)
	signData := fmt.Sprintf("accessKey=%s&amount=%d&extraData=%s&message=%s&orderId=%s&orderInfo=%s&orderType=%s&partnerCode=%s&payType=%s&requestId=%s&responseTime=%s&resultCode=%d&transId=%s",
		m.cfg.AccessKey, payload.Amount, payload.ExtraData, payload.Message, payload.OrderID, payload.OrderInfo, payload.OrderType, payload.PartnerCode, payload.PayType, payload.RequestID, responseTime, payload.ResultCode, transID)
	if !verifyHMAC(m.cfg.SecretKey, signData, payload.Signature) {
		return domain.WebhookEvent{}, apperr.New(apperr.CodeUnauthorized, "invalid momo signature")
	}
	status := domain.PaymentFailed
	if payload.ResultCode == 0 {
		status = domain.PaymentCompleted
	}
	rawMap := map[string]any{}
	_ = json.Unmarshal(raw, &rawMap)
	gatewayID := transID
	if gatewayID == "" || gatewayID == "<nil>" {
		gatewayID = payload.OrderID
	}
	eventID := gatewayID
	if eventID == "" {
		eventID = payload.RequestID
	}
	return domain.WebhookEvent{Provider: "momo", EventID: eventID, GatewayTransactionID: gatewayID, OrderRef: payload.OrderID, AmountVND: payload.Amount, Status: status, Raw: rawMap}, nil
}

func (m *MoMo) WebhookAck(domain.WebhookEvent) domain.WebhookAck {
	return domain.WebhookAck{Status: http.StatusNoContent}
}
