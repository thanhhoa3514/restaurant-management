import { useMutation } from '@tanstack/react-query'
import { mockCompletePayment } from '@/features/billing/api'

export function useMockCompletePayment() {
  return useMutation({
    mutationFn: mockCompletePayment,
  })
}
