import { useMutation, useQueryClient } from '@tanstack/react-query'
import { placeGuestOrder } from '@/features/ordering/api'
import type { PlaceOrderInput } from '@/features/ordering/types'

export function usePlaceGuestOrder(deviceAccessToken?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: PlaceOrderInput) => placeGuestOrder(deviceAccessToken!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-orders', deviceAccessToken] })
    },
  })
}
