package gateway

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"restaurant-management/internal/modules/billing/domain"
	"restaurant-management/internal/shared/apperr"
)

type ZaloPayConfig struct {
	Endpoint   string
	AppID      string
	Key1       string
	Key2       string
	HTTPClient *http.Client
}

type ZaloPay struct {
	cfg    ZaloPayConfig
	client *http.Client
}

func NewZaloPay(cfg ZaloPayConfig) *ZaloPay {
	return &ZaloPay{cfg: cfg, client: clientOrDefault(cfg.HTTPClient)}
}

func (z *ZaloPay) Provider() string { return "zalopay" }

func (z *ZaloPay) Initiate(ctx context.Context, in domain.InitiateInput) (domain.InitiateResult, error) {
	endpoint := strings.TrimRight(z.cfg.Endpoint, "/") + "/v2/create"
	appID, _ := strconv.Atoi(z.cfg.AppID)
	appTransID := time.Now().Format("060102") + "_" + in.PaymentNumber
	appTime := time.Now().UnixMilli()
	embedData := fmt.Sprintf(`{"redirecturl":"%s","callback_url":"%s"}`, in.ReturnURL, in.IPNURL)
	items := "[]"
	macData := fmt.Sprintf("%d|%s|restaurant-cashier|%d|%d|%s|%s", appID, appTransID, in.AmountVND, appTime, embedData, items)
	form := url.Values{}
	form.Set("app_id", strconv.Itoa(appID))
	form.Set("app_trans_id", appTransID)
	form.Set("app_user", "restaurant-cashier")
	form.Set("amount", strconv.FormatInt(in.AmountVND, 10))
	form.Set("app_time", strconv.FormatInt(appTime, 10))
	form.Set("embed_data", embedData)
	form.Set("item", items)
	form.Set("description", in.Description)
	form.Set("bank_code", "")
	form.Set("callback_url", in.IPNURL)
	form.Set("mac", hmacSHA256Hex(z.cfg.Key1, macData))

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return domain.InitiateResult{}, err
	}
	httpReq.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	httpResp, err := z.client.Do(httpReq)
	if err != nil {
		return domain.InitiateResult{}, err
	}
	defer httpResp.Body.Close()
	var resp struct {
		ReturnCode   int    `json:"return_code"`
		ReturnMsg    string `json:"return_message"`
		OrderURL     string `json:"order_url"`
		ZPTransToken string `json:"zp_trans_token"`
	}
	if err := json.NewDecoder(httpResp.Body).Decode(&resp); err != nil {
		return domain.InitiateResult{}, apperr.Wrap(apperr.CodeInternal, "invalid zalopay response", err)
	}
	if httpResp.StatusCode < 200 || httpResp.StatusCode >= 300 || resp.ReturnCode != 1 {
		return domain.InitiateResult{}, apperr.New(apperr.CodeInternal, "zalopay initiate failed: "+resp.ReturnMsg)
	}
	raw := map[string]any{"return_code": resp.ReturnCode, "return_message": resp.ReturnMsg, "order_url": resp.OrderURL, "zp_trans_token": resp.ZPTransToken, "app_trans_id": appTransID, "pay_url": resp.OrderURL, "qr_code_url": resp.OrderURL}
	return domain.InitiateResult{GatewayTransactionID: appTransID, PayURL: resp.OrderURL, QRCodeURL: resp.OrderURL, Raw: raw}, nil
}

func (z *ZaloPay) ParseWebhook(_ context.Context, raw []byte, _ http.Header) (domain.WebhookEvent, error) {
	var wrapper struct {
		Data string `json:"data"`
		Mac  string `json:"mac"`
		Type int    `json:"type"`
	}
	if err := json.Unmarshal(raw, &wrapper); err != nil {
		return domain.WebhookEvent{}, apperr.Wrap(apperr.CodeInvalid, "invalid zalopay callback", err)
	}
	if !verifyHMAC(z.cfg.Key2, wrapper.Data, wrapper.Mac) {
		return domain.WebhookEvent{}, apperr.New(apperr.CodeUnauthorized, "invalid zalopay signature")
	}
	var data struct {
		AppTransID string `json:"app_trans_id"`
		ZPTransID  any    `json:"zp_trans_id"`
		Amount     int64  `json:"amount"`
	}
	if err := json.Unmarshal([]byte(wrapper.Data), &data); err != nil {
		return domain.WebhookEvent{}, apperr.Wrap(apperr.CodeInvalid, "invalid zalopay data", err)
	}
	rawMap := map[string]any{}
	_ = json.Unmarshal([]byte(wrapper.Data), &rawMap)
	zpTransID := gatewayString(data.ZPTransID)
	orderRef := data.AppTransID
	if idx := strings.Index(orderRef, "_"); idx >= 0 && idx+1 < len(orderRef) {
		orderRef = orderRef[idx+1:]
	}
	return domain.WebhookEvent{Provider: "zalopay", EventID: zpTransID, GatewayTransactionID: zpTransID, OrderRef: orderRef, AmountVND: data.Amount, Status: domain.PaymentCompleted, Raw: rawMap}, nil
}

func (z *ZaloPay) WebhookAck(domain.WebhookEvent) domain.WebhookAck {
	return domain.WebhookAck{Status: http.StatusOK, Body: map[string]any{"return_code": 1, "return_message": "success"}}
}
