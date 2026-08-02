import { useMutation, useQueryClient } from '@tanstack/react-query'

import {
  addStaffSessionTakeawayItems,
  type StaffSessionTakeawayInput,
} from '@/features/cashier/api'
import { waiterKeys } from '@/features/waiter/queries/waiter.keys'

interface AddSessionTakeawayItemsVariables {
  sessionId: string
  input: StaffSessionTakeawayInput
}

export function useAddSessionTakeawayItems() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ sessionId, input }: AddSessionTakeawayItemsVariables) =>
      addStaffSessionTakeawayItems(sessionId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: waiterKeys.tables() })
    },
  })
}
