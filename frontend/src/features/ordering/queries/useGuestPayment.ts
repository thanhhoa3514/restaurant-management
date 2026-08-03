import { useQuery } from '@tanstack/react-query'
import { fetchGuestPayment } from '@/features/ordering/api'
import type { GuestCheckoutResponse } from '@/features/ordering/types'

export function useGuestPayment(deviceAccessToken?: string, poll = false) {
  return useQuery<GuestCheckoutResponse>({
    queryKey: ['guest-payment', deviceAccessToken],
    queryFn: () => fetchGuestPayment(deviceAccessToken!),
    enabled: Boolean(deviceAccessToken),
    refetchInterval: poll ? 10_000 : false,
  })
}
