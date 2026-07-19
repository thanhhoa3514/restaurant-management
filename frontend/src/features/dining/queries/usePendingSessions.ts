import { useQuery } from '@tanstack/react-query'
import { fetchPendingSessions } from '@/features/dining/api'
import type { PendingSessionsResponse } from '@/features/dining/types'

export function usePendingSessions() {
  return useQuery<PendingSessionsResponse>({
    queryKey: ['dining', 'pending-sessions'],
    queryFn: fetchPendingSessions,
    refetchInterval: 5_000,
  })
}
