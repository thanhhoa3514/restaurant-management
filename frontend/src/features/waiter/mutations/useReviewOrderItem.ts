import { useMutation, useQueryClient } from '@tanstack/react-query'
import { waiterService } from '@/features/waiter/services/waiterService'
import { waiterKeys } from '@/features/waiter/queries/waiter.keys'

// Server-confirmation gate mutations: release a PLACED item to the kitchen
// (confirm) or cancel it before it gets there (reject).
export function useReviewOrderItem() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: waiterKeys.tables() })

  const confirm = useMutation({
    mutationFn: (itemId: string) => waiterService.confirmItem(itemId),
    onSuccess: invalidate,
  })
  const reject = useMutation({
    mutationFn: ({ itemId, reason }: { itemId: string; reason: string }) =>
      waiterService.rejectItem(itemId, reason),
    onSuccess: invalidate,
  })

  return { confirm, reject }
}
