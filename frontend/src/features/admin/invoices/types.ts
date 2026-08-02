export interface PaidInvoiceListItem {
  id: string
  invoice_number: string
  paid_at: string
  subtotal_vnd: number
  discount_amount_vnd: number
  service_charge_amount_vnd: number
  vat_amount_vnd: number
  total_amount_vnd: number
  paid_amount_vnd: number
  session_reference: string
  table_label: string
  customer_name: string
  item_count: number
  payment_method_codes: string[]
  payment_method_names: string[]
}

export interface PaidInvoiceSummary {
  invoice_count: number
  total_revenue_vnd: number
  total_discount_vnd: number
  average_invoice_vnd: number
}

export interface PaidInvoicePaymentMethod {
  code: string
  name: string
}

export interface PaidInvoicePagination {
  page: number
  page_size: number
  total_items: number
  total_pages: number
}

export interface PaidInvoiceListResponse {
  items: PaidInvoiceListItem[]
  summary: PaidInvoiceSummary
  payment_methods: PaidInvoicePaymentMethod[]
  pagination: PaidInvoicePagination
}

export interface PaidInvoiceFilters {
  page: number
  pageSize: number
  search: string
  from: string
  to: string
  paymentMethod: string
}

export interface InvoiceItem {
  id: string
  order_item_id: string | null
  name_snapshot: string
  unit_price_vnd: number
  quantity: number
  subtotal_vnd: number
  discount_amount_vnd: number
  total_amount_vnd: number
}

export interface InvoicePayment {
  id: string
  payment_number: string
  method_code: string
  method_type: string
  amount_vnd: number
  received_amount_vnd: number
  change_amount_vnd: number
  status: string
  reference_code: string | null
  processed_at: string | null
}

export interface PaidInvoiceDetail {
  invoice: {
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
    items: InvoiceItem[]
    payments: InvoicePayment[]
  }
  context: {
    session_reference: string
    table_label: string
    customer_name: string
    customer_phone: string
  }
}
