import { useMutation, useQueryClient } from '@tanstack/react-query'
import { editGuestOrder } from '@/features/ordering/api'
import type { EditOrderInput } from '@/features/ordering/types'

export function useEditGuestOrder(deviceAccessToken?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ orderId, input }: { orderId: string; input: EditOrderInput }) =>
      editGuestOrder(deviceAccessToken!, orderId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-orders', deviceAccessToken] })
    },
  })
}
