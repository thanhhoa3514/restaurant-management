import { useMutation, useQueryClient } from '@tanstack/react-query'
import { waiterService } from '@/features/waiter/services/waiterService'
import { waiterKeys } from '@/features/waiter/queries/waiter.keys'

export function useRequestBill() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (sessionId: string) => waiterService.requestBill(sessionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: waiterKeys.tables() })
    },
  })
}
