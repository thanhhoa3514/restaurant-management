import { useMutation } from '@tanstack/react-query'
import { createInvoice } from '@/features/billing/api'

export function useCreateInvoice() {
  return useMutation({
    mutationFn: (diningSessionId: string) => createInvoice(diningSessionId),
  })
}
