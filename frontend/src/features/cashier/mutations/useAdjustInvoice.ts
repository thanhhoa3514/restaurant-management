import { useMutation } from '@tanstack/react-query'
import { adjustInvoice } from '@/features/billing/api'

export function useAdjustInvoice() {
  return useMutation({
    mutationFn: ({
      invoiceId,
      discountAmountVND,
      discountReason,
    }: {
      invoiceId: string
      discountAmountVND: number
      discountReason: string
    }) => adjustInvoice(invoiceId, discountAmountVND, discountReason),
  })
}
