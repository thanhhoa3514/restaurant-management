import { useQuery } from '@tanstack/react-query'
import { fetchGuestOrders } from '@/features/ordering/api'
import type { GuestOrdersResponse } from '@/features/ordering/types'

export function useGuestOrders(sessionToken?: string) {
  return useQuery<GuestOrdersResponse>({
    queryKey: ['guest-orders', sessionToken],
    queryFn: () => fetchGuestOrders(sessionToken!),
    enabled: !!sessionToken,
  })
}
