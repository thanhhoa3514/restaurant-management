import { useMutation } from '@tanstack/react-query'
import { processPartialPayment } from '@/features/billing/api'

interface ProcessPartialPaymentArgs {
  invoiceId: string
  paymentMethodCode: string
  receivedAmountVND: number
  referenceCode?: string
}

export function useProcessPartialPayment() {
  return useMutation({
    mutationFn: (args: ProcessPartialPaymentArgs) => processPartialPayment(args),
  })
}
