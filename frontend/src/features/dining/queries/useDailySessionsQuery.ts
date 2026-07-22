import { useQuery } from '@tanstack/react-query'
import { fetchDailySessions, fetchSessionDetail, type DailySessionsFilter } from '../api'

export function useDailySessionsQuery(filter: DailySessionsFilter) {
  return useQuery({
    queryKey: ['dining', 'daily-sessions', filter],
    queryFn: () => fetchDailySessions(filter),
    refetchInterval: 15000,
  })
}

export function useSessionDetailQuery(sessionId: string | null) {
  return useQuery({
    queryKey: ['dining', 'session-detail', sessionId],
    queryFn: () => fetchSessionDetail(sessionId!),
    enabled: !!sessionId,
  })
}
