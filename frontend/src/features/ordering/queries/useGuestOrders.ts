import { useQuery } from '@tanstack/react-query'
import { fetchGuestOrders } from '@/features/ordering/api'
import type { GuestOrdersResponse } from '@/features/ordering/types'

export function useGuestOrders(deviceAccessToken?: string) {
  return useQuery<GuestOrdersResponse>({
    queryKey: ['guest-orders', deviceAccessToken],
    queryFn: () => fetchGuestOrders(deviceAccessToken!),
    enabled: !!deviceAccessToken,
    // Polling floor: realtime is the fast path, but if the socket drops or a
    // confirm lands during a reconnect gap the guest still sees status changes
    // within ~15s instead of never.
    refetchInterval: 15_000,
  })
}
