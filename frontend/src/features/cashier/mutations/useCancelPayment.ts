import { useMutation } from '@tanstack/react-query'

import { cancelPayment } from '@/features/billing/api'

export function useCancelPayment() {
  return useMutation({
    mutationFn: ({ invoiceId, paymentId }: { invoiceId: string; paymentId: string }) =>
      cancelPayment(invoiceId, paymentId),
  })
}
