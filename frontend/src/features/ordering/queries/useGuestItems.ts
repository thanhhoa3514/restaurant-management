import { useQuery } from '@tanstack/react-query'
import { fetchMenuItems } from '@/features/ordering/api'
import type { ApiMenuItemSummary } from '@/features/ordering/types'

export function useGuestItems(deviceAccessToken?: string) {
  return useQuery<ApiMenuItemSummary[]>({
    queryKey: ['guest-items', deviceAccessToken],
    queryFn: () => fetchMenuItems(deviceAccessToken!),
    enabled: !!deviceAccessToken,
  })
}
