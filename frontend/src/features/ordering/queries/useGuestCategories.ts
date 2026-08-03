import { useQuery } from '@tanstack/react-query'
import { fetchCategories } from '@/features/ordering/api'
import type { ApiCategory } from '@/features/ordering/types'

export function useGuestCategories(deviceAccessToken?: string) {
  return useQuery<ApiCategory[]>({
    queryKey: ['guest-categories', deviceAccessToken],
    queryFn: () => fetchCategories(deviceAccessToken!),
    enabled: !!deviceAccessToken,
  })
}
