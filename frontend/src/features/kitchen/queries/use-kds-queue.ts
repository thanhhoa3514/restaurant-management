import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'

import { fetchKitchenQueue } from '@/features/kitchen/api'
import { toKdsTickets } from '@/features/kitchen/helpers/mappers'
import type { Ticket } from '@/features/kitchen/types'

export const KITCHEN_QUEUE_KEY = ['kitchen', 'queue'] as const

export interface UseKdsQueueValue {
  tickets: Ticket[]
  error: Error | null
  isError: boolean
  isFetching: boolean
  refetch: () => void
}

export function useKdsQueue(paused: boolean): UseKdsQueueValue {
  const {
    data: queueData,
    error,
    isError,
    isFetching,
    refetch: refetchQuery,
  } = useQuery({
    queryKey: KITCHEN_QUEUE_KEY,
    queryFn: fetchKitchenQueue,
    refetchInterval: paused ? false : 5_000,
  })
  const refetch = useCallback(() => {
    void refetchQuery()
  }, [refetchQuery])

  return {
    tickets: toKdsTickets(queueData?.tickets ?? []),
    error,
    isError,
    isFetching,
    refetch,
  }
}
