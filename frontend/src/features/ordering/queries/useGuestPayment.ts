import { useQuery } from '@tanstack/react-query'
import { fetchGuestPayment } from '@/features/ordering/api'
import type { GuestCheckoutResponse } from '@/features/ordering/types'

export function useGuestPayment(sessionToken?: string, poll = false) {
  return useQuery<GuestCheckoutResponse>({
    queryKey: ['guest-payment', sessionToken],
    queryFn: () => fetchGuestPayment(sessionToken!),
    enabled: Boolean(sessionToken),
    refetchInterval: poll ? 10_000 : false,
  })
}
