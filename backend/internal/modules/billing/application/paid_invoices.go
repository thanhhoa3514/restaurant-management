package application

import (
	"context"
	"strings"
	"time"

	"github.com/google/uuid"

	"restaurant-management/internal/modules/billing/domain"
	"restaurant-management/internal/shared/apperr"
)

const paidInvoiceDateLayout = "2006-01-02"

type PaidInvoiceListRequest struct {
	Page              int    `form:"page"`
	PageSize          int    `form:"page_size"`
	Search            string `form:"search"`
	From              string `form:"from"`
	To                string `form:"to"`
	PaymentMethodCode string `form:"payment_method"`
}

type PaidInvoiceListItemDTO struct {
	ID                 uuid.UUID `json:"id"`
	InvoiceNumber      string    `json:"invoice_number"`
	PaidAt             time.Time `json:"paid_at"`
	SubtotalVND        int64     `json:"subtotal_vnd"`
	DiscountAmountVND  int64     `json:"discount_amount_vnd"`
	ServiceChargeVND   int64     `json:"service_charge_amount_vnd"`
	VATAmountVND       int64     `json:"vat_amount_vnd"`
	TotalAmountVND     int64     `json:"total_amount_vnd"`
	PaidAmountVND      int64     `json:"paid_amount_vnd"`
	SessionReference   string    `json:"session_reference"`
	TableLabel         string    `json:"table_label"`
	CustomerName       string    `json:"customer_name"`
	ItemCount          int       `json:"item_count"`
	PaymentMethodCodes []string  `json:"payment_method_codes"`
	PaymentMethodNames []string  `json:"payment_method_names"`
}

type PaidInvoiceSummaryDTO struct {
	InvoiceCount      int64 `json:"invoice_count"`
	TotalRevenueVND   int64 `json:"total_revenue_vnd"`
	TotalDiscountVND  int64 `json:"total_discount_vnd"`
	AverageInvoiceVND int64 `json:"average_invoice_vnd"`
}

type PaidInvoicePaymentMethodDTO struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

type PaidInvoicePaginationDTO struct {
	Page       int   `json:"page"`
	PageSize   int   `json:"page_size"`
	TotalItems int64 `json:"total_items"`
	TotalPages int   `json:"total_pages"`
}

type PaidInvoiceListResponse struct {
	Items          []PaidInvoiceListItemDTO      `json:"items"`
	Summary        PaidInvoiceSummaryDTO         `json:"summary"`
	PaymentMethods []PaidInvoicePaymentMethodDTO `json:"payment_methods"`
	Pagination     PaidInvoicePaginationDTO      `json:"pagination"`
}

type PaidInvoiceContextDTO struct {
	SessionReference string `json:"session_reference"`
	TableLabel       string `json:"table_label"`
	CustomerName     string `json:"customer_name"`
	CustomerPhone    string `json:"customer_phone"`
}

type PaidInvoiceDetailResponse struct {
	Invoice InvoiceDTO            `json:"invoice"`
	Context PaidInvoiceContextDTO `json:"context"`
}

type PaidInvoices struct {
	repo                domain.PaidInvoiceRepository
	defaultRestaurantID uuid.UUID
}

func NewPaidInvoices(repo domain.PaidInvoiceRepository, defaultRestaurantID uuid.UUID) *PaidInvoices {
	return &PaidInvoices{repo: repo, defaultRestaurantID: defaultRestaurantID}
}

func (s *PaidInvoices) List(ctx context.Context, req PaidInvoiceListRequest) (PaidInvoiceListResponse, error) {
	page := req.Page
	if page <= 0 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	from, err := parsePaidInvoiceDate(req.From, "from")
	if err != nil {
		return PaidInvoiceListResponse{}, err
	}
	to, err := parsePaidInvoiceDate(req.To, "to")
	if err != nil {
		return PaidInvoiceListResponse{}, err
	}
	if from != nil && to != nil && from.After(*to) {
		return PaidInvoiceListResponse{}, apperr.New(apperr.CodeInvalid, "from must be on or before to")
	}
	var toExclusive *time.Time
	if to != nil {
		nextDay := to.AddDate(0, 0, 1)
		toExclusive = &nextDay
	}

	search := strings.TrimSpace(req.Search)
	if len([]rune(search)) > 120 {
		return PaidInvoiceListResponse{}, apperr.New(apperr.CodeInvalid, "search is too long")
	}

	result, err := s.repo.ListPaidInvoices(ctx, s.defaultRestaurantID, domain.PaidInvoiceFilter{
		Search:            search,
		From:              from,
		ToExclusive:       toExclusive,
		PaymentMethodCode: strings.TrimSpace(strings.ToLower(req.PaymentMethodCode)),
		Limit:             pageSize,
		Offset:            (page - 1) * pageSize,
	})
	if err != nil {
		return PaidInvoiceListResponse{}, err
	}

	items := make([]PaidInvoiceListItemDTO, 0, len(result.Items))
	for _, item := range result.Items {
		items = append(items, PaidInvoiceListItemDTO{
			ID:                 item.ID,
			InvoiceNumber:      item.InvoiceNumber,
			PaidAt:             item.PaidAt,
			SubtotalVND:        item.SubtotalVND,
			DiscountAmountVND:  item.DiscountAmountVND,
			ServiceChargeVND:   item.ServiceChargeVND,
			VATAmountVND:       item.VATAmountVND,
			TotalAmountVND:     item.TotalAmountVND,
			PaidAmountVND:      item.PaidAmountVND,
			SessionReference:   item.SessionReference,
			TableLabel:         item.TableLabel,
			CustomerName:       item.CustomerName,
			ItemCount:          item.ItemCount,
			PaymentMethodCodes: splitAggregate(item.PaymentMethodCodes),
			PaymentMethodNames: splitAggregate(item.PaymentMethodNames),
		})
	}

	methods := make([]PaidInvoicePaymentMethodDTO, 0, len(result.PaymentMethods))
	for _, method := range result.PaymentMethods {
		methods = append(methods, PaidInvoicePaymentMethodDTO{Code: method.Code, Name: method.Name})
	}

	totalPages := 0
	if result.Total > 0 {
		totalPages = int((result.Total + int64(pageSize) - 1) / int64(pageSize))
	}
	return PaidInvoiceListResponse{
		Items: items,
		Summary: PaidInvoiceSummaryDTO{
			InvoiceCount:      result.Summary.InvoiceCount,
			TotalRevenueVND:   result.Summary.TotalRevenueVND,
			TotalDiscountVND:  result.Summary.TotalDiscountVND,
			AverageInvoiceVND: result.Summary.AverageInvoiceVND,
		},
		PaymentMethods: methods,
		Pagination: PaidInvoicePaginationDTO{
			Page:       page,
			PageSize:   pageSize,
			TotalItems: result.Total,
			TotalPages: totalPages,
		},
	}, nil
}

func (s *PaidInvoices) Get(ctx context.Context, invoiceID uuid.UUID) (PaidInvoiceDetailResponse, error) {
	if invoiceID == uuid.Nil {
		return PaidInvoiceDetailResponse{}, apperr.New(apperr.CodeInvalid, "invoice_id is required")
	}
	detail, err := s.repo.GetPaidInvoice(ctx, s.defaultRestaurantID, invoiceID)
	if err != nil {
		return PaidInvoiceDetailResponse{}, err
	}
	response := toResponse(detail.Invoice)
	return PaidInvoiceDetailResponse{
		Invoice: response.Invoice,
		Context: PaidInvoiceContextDTO{
			SessionReference: detail.Context.SessionReference,
			TableLabel:       detail.Context.TableLabel,
			CustomerName:     detail.Context.CustomerName,
			CustomerPhone:    detail.Context.CustomerPhone,
		},
	}, nil
}

func parsePaidInvoiceDate(value, field string) (*time.Time, error) {
	if strings.TrimSpace(value) == "" {
		return nil, nil
	}
	parsed, err := time.Parse(paidInvoiceDateLayout, value)
	if err != nil {
		return nil, apperr.Wrap(apperr.CodeInvalid, field+" must use YYYY-MM-DD", err)
	}
	return &parsed, nil
}

func splitAggregate(value string) []string {
	if value == "" {
		return []string{}
	}
	return strings.Split(value, " · ")
}
