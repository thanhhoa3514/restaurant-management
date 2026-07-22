import { useMutation, useQueryClient } from '@tanstack/react-query'
import { waiterService } from '@/features/waiter/services/waiterService'
import { waiterKeys } from '@/features/waiter/queries/waiter.keys'

export function useOpenSession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (tableId: string) => waiterService.openSession(tableId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: waiterKeys.tables() })
    },
  })
}
