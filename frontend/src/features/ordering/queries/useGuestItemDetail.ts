import { useQuery } from '@tanstack/react-query'
import { fetchMenuItem } from '@/features/ordering/api'
import type { ApiMenuItemDetail } from '@/features/ordering/types'

export function useGuestItemDetail(sessionToken?: string, itemId?: string | null) {
  return useQuery<ApiMenuItemDetail>({
    queryKey: ['guest-item', sessionToken, itemId],
    queryFn: () => fetchMenuItem(sessionToken!, itemId!),
    enabled: !!sessionToken && !!itemId,
  })
}
