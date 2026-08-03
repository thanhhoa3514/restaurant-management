import { useMutation, useQueryClient } from '@tanstack/react-query'
import { cancelGuestOrder } from '@/features/ordering/api'

export function useCancelGuestOrder(deviceAccessToken?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (orderId: string) => cancelGuestOrder(deviceAccessToken!, orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-orders', deviceAccessToken] })
    },
  })
}
