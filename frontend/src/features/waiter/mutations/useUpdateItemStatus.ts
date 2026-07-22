import { useMutation, useQueryClient } from '@tanstack/react-query'
import { waiterService } from '@/features/waiter/services/waiterService'
import { waiterKeys } from '@/features/waiter/queries/waiter.keys'

export function useUpdateItemStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: string }) =>
      waiterService.updateItemStatus(itemId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: waiterKeys.tables() })
    },
  })
}
