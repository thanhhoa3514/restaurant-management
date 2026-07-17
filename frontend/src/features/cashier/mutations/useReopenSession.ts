import { useMutation, useQueryClient } from '@tanstack/react-query'
import { reopenSession } from '@/features/cashier/api'

const STAFF_TABLES_QUERY_KEY = ['staff', 'tables'] as const

export function useReopenSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => reopenSession(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STAFF_TABLES_QUERY_KEY })
    },
  })
}
