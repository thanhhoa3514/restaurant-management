import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { getPaidInvoice, listPaidInvoices } from './api'
import type { PaidInvoiceFilters } from './types'

export const paidInvoiceKeys = {
  all: ['billing', 'paid-invoices'] as const,
  list: (filters: PaidInvoiceFilters) => [...paidInvoiceKeys.all, 'list', filters] as const,
  detail: (invoiceID: string) => [...paidInvoiceKeys.all, 'detail', invoiceID] as const,
}

export function usePaidInvoices(filters: PaidInvoiceFilters) {
  return useQuery({
    queryKey: paidInvoiceKeys.list(filters),
    queryFn: () => listPaidInvoices(filters),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
}

export function usePaidInvoiceDetail(invoiceID: string | null) {
  return useQuery({
    queryKey: paidInvoiceKeys.detail(invoiceID ?? ''),
    queryFn: () => getPaidInvoice(invoiceID!),
    enabled: Boolean(invoiceID),
    staleTime: 30_000,
  })
}
