import { useQuery } from '@tanstack/react-query'

import { fetchPendingCancelRequests, type CancelRequestDTO } from '@/features/kitchen/api'

export const CANCEL_REQUESTS_KEY = ['kitchen', 'cancel-requests'] as const

export interface UseCancelRequestsValue {
  cancelRequests: CancelRequestDTO[]
  refetch: () => void
}

export function useCancelRequests(paused: boolean): UseCancelRequestsValue {
  const { data, refetch } = useQuery({
    queryKey: CANCEL_REQUESTS_KEY,
    queryFn: fetchPendingCancelRequests,
    refetchInterval: paused ? false : 5_000,
  })

  return {
    cancelRequests: data?.cancel_requests ?? [],
    refetch,
  }
}
