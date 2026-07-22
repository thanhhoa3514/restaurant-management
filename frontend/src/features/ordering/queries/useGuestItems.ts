import { useQuery } from '@tanstack/react-query'
import { fetchMenuItems } from '@/features/ordering/api'
import type { ApiMenuItemSummary } from '@/features/ordering/types'

export function useGuestItems(sessionToken?: string) {
  return useQuery<ApiMenuItemSummary[]>({
    queryKey: ['guest-items', sessionToken],
    queryFn: () => fetchMenuItems(sessionToken!),
    enabled: !!sessionToken,
  })
}
