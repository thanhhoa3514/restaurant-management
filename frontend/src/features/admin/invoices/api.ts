import { apiRequest } from '@/lib/api'
import type { PaidInvoiceDetail, PaidInvoiceFilters, PaidInvoiceListResponse } from './types'

export function listPaidInvoices(filters: PaidInvoiceFilters): Promise<PaidInvoiceListResponse> {
  const query = new URLSearchParams({
    page: String(filters.page),
    page_size: String(filters.pageSize),
  })
  if (filters.search) query.set('search', filters.search)
  if (filters.from) query.set('from', filters.from)
  if (filters.to) query.set('to', filters.to)
  if (filters.paymentMethod) query.set('payment_method', filters.paymentMethod)
  return apiRequest<PaidInvoiceListResponse>(`/api/v1/restaurant/invoices/paid?${query}`)
}

export function getPaidInvoice(invoiceID: string): Promise<PaidInvoiceDetail> {
  return apiRequest<PaidInvoiceDetail>(`/api/v1/restaurant/invoices/paid/${invoiceID}`)
}
