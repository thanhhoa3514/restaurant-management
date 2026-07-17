import { useMutation } from '@tanstack/react-query'
import { voidInvoice } from '@/features/billing/api'

export function useVoidInvoice() {
  return useMutation({
    mutationFn: ({
      invoiceId,
      voidReason,
    }: {
      invoiceId: string
      voidReason: string
    }) => voidInvoice(invoiceId, voidReason),
  })
}
