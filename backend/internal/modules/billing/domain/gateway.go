package domain

import (
	"context"
	"net/http"
	"strings"
)

type PaymentGateway interface {
	Provider() string
	Initiate(ctx context.Context, in InitiateInput) (InitiateResult, error)
	ParseWebhook(ctx context.Context, raw []byte, headers http.Header) (WebhookEvent, error)
}

type WebhookAcker interface {
	WebhookAck(event WebhookEvent) WebhookAck
}

type InitiateInput struct {
	PaymentNumber string
	AmountVND     int64
	Description   string
	ReturnURL     string
	IPNURL        string
}

type InitiateResult struct {
	GatewayTransactionID string
	PayURL               string
	Deeplink             string
	QRCodeURL            string
	Raw                  map[string]any
}

type WebhookEvent struct {
	Provider             string
	EventID              string
	GatewayTransactionID string
	OrderRef             string
	AmountVND            int64
	Status               PaymentStatus
	Raw                  map[string]any
}

type WebhookAck struct {
	Status int
	Body   any
}

type GatewayRegistry struct {
	gateways map[string]PaymentGateway
}

func NewGatewayRegistry(gateways ...PaymentGateway) *GatewayRegistry {
	r := &GatewayRegistry{gateways: map[string]PaymentGateway{}}
	for _, gateway := range gateways {
		r.Register(gateway)
	}
	return r
}

func (r *GatewayRegistry) Register(gateway PaymentGateway) {
	if r == nil || gateway == nil {
		return
	}
	provider := strings.ToLower(strings.TrimSpace(gateway.Provider()))
	if provider == "" {
		return
	}
	r.gateways[provider] = gateway
}

func (r *GatewayRegistry) Get(provider string) (PaymentGateway, bool) {
	if r == nil {
		return nil, false
	}
	gateway, ok := r.gateways[strings.ToLower(strings.TrimSpace(provider))]
	return gateway, ok
}

func (r *GatewayRegistry) Has(provider string) bool {
	_, ok := r.Get(provider)
	return ok
}
