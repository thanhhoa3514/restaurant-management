import { useMutation } from '@tanstack/react-query'
import { processPayment } from '@/features/billing/api'
import type { BillingInvoiceResponse } from '@/features/billing/api'

interface ProcessPaymentArgs {
  invoiceId: string
  paymentMethodCode: string
  receivedAmountVND: number
  referenceCode?: string
}

export function useProcessPayment() {
  return useMutation({
    mutationFn: (args: ProcessPaymentArgs) => processPayment(args),
  })
}

export type { ProcessPaymentArgs, BillingInvoiceResponse }
