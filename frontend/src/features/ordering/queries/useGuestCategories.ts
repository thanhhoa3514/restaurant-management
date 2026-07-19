import { useQuery } from '@tanstack/react-query'
import { fetchCategories } from '@/features/ordering/api'
import type { ApiCategory } from '@/features/ordering/types'

export function useGuestCategories(sessionToken?: string) {
  return useQuery<ApiCategory[]>({
    queryKey: ['guest-categories', sessionToken],
    queryFn: () => fetchCategories(sessionToken!),
    enabled: !!sessionToken,
  })
}
