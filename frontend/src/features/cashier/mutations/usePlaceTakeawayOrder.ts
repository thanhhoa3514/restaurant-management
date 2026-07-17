import { useMutation } from '@tanstack/react-query'
import { placeStaffTakeawayOrder, type StaffTakeawayInput } from '@/features/cashier/api'

export function usePlaceTakeawayOrder() {
  return useMutation({
    mutationFn: (input: StaffTakeawayInput) => placeStaffTakeawayOrder(input),
  })
}
