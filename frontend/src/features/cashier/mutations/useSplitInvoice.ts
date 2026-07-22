import { useMutation } from '@tanstack/react-query'
import { splitInvoice } from '@/features/billing/api'

export function useSplitInvoice() {
  return useMutation({
    mutationFn: ({
      diningSessionId,
      groups,
    }: {
      diningSessionId: string
      groups: { label: string; order_item_ids: string[] }[]
    }) => splitInvoice(diningSessionId, groups),
  })
}
