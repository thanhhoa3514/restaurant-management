import { apiRequest } from '@/lib/api'

export interface BillingInvoiceItemDTO {
  id: string
  order_item_id: string | null
  name_snapshot: string
  unit_price_vnd: number
  quantity: number
  subtotal_vnd: number
  discount_amount_vnd: number
  total_amount_vnd: number
}

export interface BillingPaymentDTO {
  id: string
  payment_number: string
  method_code: string
  method_type: string
  amount_vnd: number
  received_amount_vnd: number
  change_amount_vnd: number
  status: string
  reference_code: string | null
  pay_url?: string
  deeplink?: string
  qr_code_url?: string
  processed_at: string | null
}

export interface BillingInvoiceDTO {
  id: string
  invoice_number: string
  dining_session_id: string
  status: string
  subtotal_vnd: number
  discount_amount_vnd: number
  discount_reason: string | null
  service_charge_basis_points: number
  service_charge_amount_vnd: number
  vat_basis_points: number
  vat_amount_vnd: number
  total_amount_vnd: number
  paid_amount_vnd: number
  change_amount_vnd: number
  issued_at: string | null
  paid_at: string | null
  version: number
  items: BillingInvoiceItemDTO[]
  payment: BillingPaymentDTO | null
  payments?: BillingPaymentDTO[]
}

export interface BillingInvoiceResponse {
  invoice: BillingInvoiceDTO
}

export interface BillingInvoiceListResponse {
  invoices: BillingInvoiceDTO[]
}

function buildInvoice(diningSessionId: string): Promise<BillingInvoiceResponse> {
  return apiRequest<BillingInvoiceResponse>('/api/v1/restaurant/invoices', {
    method: 'POST',
    body: { dining_session_id: diningSessionId },
  })
}

export function adjustInvoice(
  invoiceId: string,
  discountAmountVND: number,
  discountReason: string,
): Promise<BillingInvoiceResponse> {
  return apiRequest<BillingInvoiceResponse>(
    `/api/v1/restaurant/invoices/${encodeURIComponent(invoiceId)}/adjust`,
    {
      method: 'POST',
      body: {
        discount_amount_vnd: Math.max(0, Math.round(discountAmountVND)),
        discount_reason: discountReason,
      },
    },
  )
}

export function voidInvoice(
  invoiceId: string,
  voidReason: string,
): Promise<BillingInvoiceResponse> {
  return apiRequest<BillingInvoiceResponse>(
    `/api/v1/restaurant/invoices/${encodeURIComponent(invoiceId)}/void`,
    {
      method: 'POST',
      body: {
        void_reason: voidReason,
      },
    },
  )
}

export function processPayment(args: {
  invoiceId: string
  paymentMethodCode: string
  receivedAmountVND: number
  referenceCode?: string
}): Promise<BillingInvoiceResponse> {
  return apiRequest<BillingInvoiceResponse>(
    `/api/v1/restaurant/invoices/${encodeURIComponent(args.invoiceId)}/pay`,
    {
      method: 'POST',
      body: {
        payment_method_code: args.paymentMethodCode,
        received_amount_vnd: Math.max(0, Math.round(args.receivedAmountVND)),
        reference_code: args.referenceCode ?? '',
      },
    },
  )
}

export function cancelPayment(
  invoiceId: string,
  paymentId: string,
): Promise<BillingInvoiceResponse> {
  return apiRequest<BillingInvoiceResponse>(
    `/api/v1/restaurant/invoices/${encodeURIComponent(invoiceId)}/payments/${encodeURIComponent(paymentId)}/cancel`,
    { method: 'POST' },
  )
}

export function processPartialPayment(args: {
  invoiceId: string
  paymentMethodCode: string
  receivedAmountVND: number
  referenceCode?: string
}): Promise<BillingInvoiceResponse> {
  return apiRequest<BillingInvoiceResponse>(
    `/api/v1/restaurant/invoices/${encodeURIComponent(args.invoiceId)}/pay-partial`,
    {
      method: 'POST',
      body: {
        payment_method_code: args.paymentMethodCode,
        received_amount_vnd: Math.max(0, Math.round(args.receivedAmountVND)),
        reference_code: args.referenceCode ?? '',
      },
    },
  )
}

export function mockCompletePayment(args: {
  paymentNumber: string
  result: 'success' | 'failed'
}): Promise<BillingInvoiceResponse> {
  return apiRequest<BillingInvoiceResponse>('/api/v1/billing/payments/mock/complete', {
    method: 'POST',
    body: {
      payment_number: args.paymentNumber,
      result: args.result,
    },
  })
}

export function listSessionInvoices(diningSessionId: string): Promise<BillingInvoiceListResponse> {
  return apiRequest<BillingInvoiceListResponse>(
    `/api/v1/restaurant/invoices?dining_session_id=${encodeURIComponent(diningSessionId)}`,
  )
}

export function splitInvoice(
  diningSessionId: string,
  groups: { label: string; order_item_ids: string[] }[],
): Promise<BillingInvoiceListResponse> {
  return apiRequest<BillingInvoiceListResponse>('/api/v1/restaurant/invoices/split', {
    method: 'POST',
    body: { dining_session_id: diningSessionId, groups },
  })
}

export const createInvoice = buildInvoice
