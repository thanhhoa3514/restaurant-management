import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cancelGuestOrder } from '@/features/ordering/api'

export function useCancelGuestOrder(sessionToken?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (orderId: string) => cancelGuestOrder(sessionToken!, orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-orders', sessionToken] })
    },
  })
}
