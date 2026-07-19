import { useQuery } from '@tanstack/react-query'
import { fetchPendingSessions } from '@/features/dining/api'
import type { PendingSession } from '@/features/dining/types'

export function usePendingSessions() {
  return useQuery<PendingSession[]>({
    queryKey: ['dining', 'pending-sessions'],
    queryFn: fetchPendingSessions,
    refetchInterval: 5_000,
  })
}
