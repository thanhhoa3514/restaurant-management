package application

import (
	"time"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/billing/domain"
)

type BuildInvoiceRequest struct {
	DiningSessionID uuid.UUID `json:"dining_session_id"`
}

type AdjustInvoiceRequest struct {
	InvoiceID         uuid.UUID `json:"invoice_id"`
	DiscountAmountVND int64     `json:"discount_amount_vnd"`
	DiscountReason    string    `json:"discount_reason"`
}

type ProcessPaymentRequest struct {
	InvoiceID         uuid.UUID `json:"invoice_id"`
	PaymentMethodCode string    `json:"payment_method_code"`
	ReceivedAmountVND int64     `json:"received_amount_vnd"`
	ReferenceCode     string    `json:"reference_code"`
	ActorID           uuid.UUID `json:"-"`
}

type InvoiceResponse struct {
	Invoice InvoiceDTO `json:"invoice"`
}

type InvoiceDTO struct {
	ID                       uuid.UUID        `json:"id"`
	InvoiceNumber            string           `json:"invoice_number"`
	DiningSessionID          uuid.UUID        `json:"dining_session_id"`
	Status                   string           `json:"status"`
	SubtotalVND              int64            `json:"subtotal_vnd"`
	DiscountAmountVND        int64            `json:"discount_amount_vnd"`
	DiscountReason           *string          `json:"discount_reason"`
	ServiceChargeBasisPoints int              `json:"service_charge_basis_points"`
	ServiceChargeAmountVND   int64            `json:"service_charge_amount_vnd"`
	VATBasisPoints           int              `json:"vat_basis_points"`
	VATAmountVND             int64            `json:"vat_amount_vnd"`
	TotalAmountVND           int64            `json:"total_amount_vnd"`
	PaidAmountVND            int64            `json:"paid_amount_vnd"`
	ChangeAmountVND          int64            `json:"change_amount_vnd"`
	IssuedAt                 *time.Time       `json:"issued_at"`
	PaidAt                   *time.Time       `json:"paid_at"`
	Version                  int              `json:"version"`
	Items                    []InvoiceItemDTO `json:"items"`
	Payment                  *PaymentDTO      `json:"payment"`
}

type InvoiceItemDTO struct {
	ID                uuid.UUID  `json:"id"`
	OrderItemID       *uuid.UUID `json:"order_item_id"`
	NameSnapshot      string     `json:"name_snapshot"`
	UnitPriceVND      int64      `json:"unit_price_vnd"`
	Quantity          int        `json:"quantity"`
	SubtotalVND       int64      `json:"subtotal_vnd"`
	DiscountAmountVND int64      `json:"discount_amount_vnd"`
	TotalAmountVND    int64      `json:"total_amount_vnd"`
}

type PaymentDTO struct {
	ID                uuid.UUID  `json:"id"`
	PaymentNumber     string     `json:"payment_number"`
	MethodCode        string     `json:"method_code"`
	MethodType        string     `json:"method_type"`
	AmountVND         int64      `json:"amount_vnd"`
	ReceivedAmountVND int64      `json:"received_amount_vnd"`
	ChangeAmountVND   int64      `json:"change_amount_vnd"`
	Status            string     `json:"status"`
	ReferenceCode     *string    `json:"reference_code"`
	ProcessedAt       *time.Time `json:"processed_at"`
	PayURL            string     `json:"pay_url,omitempty"`
	Deeplink          string     `json:"deeplink,omitempty"`
	QRCodeURL         string     `json:"qr_code_url,omitempty"`
}

func toResponse(inv *domain.Invoice) InvoiceResponse {
	items := make([]InvoiceItemDTO, 0, len(inv.Items))
	for _, item := range inv.Items {
		items = append(items, InvoiceItemDTO{
			ID:                item.ID,
			OrderItemID:       item.OrderItemID,
			NameSnapshot:      item.NameSnapshot,
			UnitPriceVND:      item.UnitPriceVND,
			Quantity:          item.Quantity,
			SubtotalVND:       item.SubtotalVND,
			DiscountAmountVND: item.DiscountAmountVND,
			TotalAmountVND:    item.TotalAmountVND,
		})
	}
	var payment *PaymentDTO
	if inv.Payment != nil {
		payment = &PaymentDTO{
			ID:                inv.Payment.ID,
			PaymentNumber:     inv.Payment.PaymentNumber,
			MethodCode:        inv.Payment.MethodCode,
			MethodType:        inv.Payment.MethodType,
			AmountVND:         inv.Payment.AmountVND,
			ReceivedAmountVND: inv.Payment.ReceivedAmountVND,
			ChangeAmountVND:   inv.Payment.ChangeAmountVND,
			Status:            string(inv.Payment.Status),
			ReferenceCode:     inv.Payment.ReferenceCode,
			ProcessedAt:       inv.Payment.ProcessedAt,
			PayURL:            inv.Payment.PayURL,
			Deeplink:          inv.Payment.Deeplink,
			QRCodeURL:         inv.Payment.QRCodeURL,
		}
	}
	return InvoiceResponse{Invoice: InvoiceDTO{
		ID:                       inv.ID,
		InvoiceNumber:            inv.InvoiceNumber,
		DiningSessionID:          inv.DiningSessionID,
		Status:                   string(inv.Status),
		SubtotalVND:              inv.SubtotalVND,
		DiscountAmountVND:        inv.DiscountAmountVND,
		DiscountReason:           inv.DiscountReason,
		ServiceChargeBasisPoints: inv.ServiceChargeBasisPoints,
		ServiceChargeAmountVND:   inv.ServiceChargeAmountVND,
		VATBasisPoints:           inv.VATBasisPoints,
		VATAmountVND:             inv.VATAmountVND,
		TotalAmountVND:           inv.TotalAmountVND,
		PaidAmountVND:            inv.PaidAmountVND,
		ChangeAmountVND:          inv.ChangeAmountVND,
		IssuedAt:                 inv.IssuedAt,
		PaidAt:                   inv.PaidAt,
		Version:                  inv.Version,
		Items:                    items,
		Payment:                  payment,
	}}
}
