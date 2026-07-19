import { useMutation, useQueryClient } from '@tanstack/react-query'
import { placeGuestOrder } from '@/features/ordering/api'
import type { PlaceOrderInput } from '@/features/ordering/types'

export function usePlaceGuestOrder(sessionToken?: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: PlaceOrderInput) => placeGuestOrder(sessionToken!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-orders', sessionToken] })
    },
  })
}
