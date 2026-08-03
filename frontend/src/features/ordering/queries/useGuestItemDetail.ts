import { useQuery } from '@tanstack/react-query'
import { fetchMenuItem } from '@/features/ordering/api'
import type { ApiMenuItemDetail } from '@/features/ordering/types'

export function useGuestItemDetail(deviceAccessToken?: string, itemId?: string | null) {
  return useQuery<ApiMenuItemDetail>({
    queryKey: ['guest-item', deviceAccessToken, itemId],
    queryFn: () => fetchMenuItem(deviceAccessToken!, itemId!),
    enabled: !!deviceAccessToken && !!itemId,
  })
}
