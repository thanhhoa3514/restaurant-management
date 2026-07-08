import { useQuery } from '@tanstack/react-query'

import { fetchKitchenQueue } from '@/features/kitchen/api'
import { toKdsTickets } from '@/features/kitchen/helpers/mappers'
import type { Ticket } from '@/features/kitchen/types'

export const KITCHEN_QUEUE_KEY = ['kitchen', 'queue'] as const

export interface UseKdsQueueValue {
  tickets: Ticket[]
  refetch: () => void
}

export function useKdsQueue(paused: boolean): UseKdsQueueValue {
  const { data: queueData, refetch: refetchQuery } = useQuery({
    queryKey: KITCHEN_QUEUE_KEY,
    queryFn: fetchKitchenQueue,
    refetchInterval: paused ? false : 5_000,
  })

  return {
    tickets: toKdsTickets(queueData?.tickets ?? []),
    refetch: refetchQuery,
  }
}
