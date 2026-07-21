import { useMutation, useQueryClient } from '@tanstack/react-query'

import { mergeSessions, splitSessions } from '@/features/waiter/api'
import { waiterKeys } from '@/features/waiter/queries/waiter.keys'

export function useMergeSessions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (sessionIds: string[]) => mergeSessions(sessionIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: waiterKeys.tables() })
    },
  })
}

export function useSplitSessions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (mergeGroupId: string) => splitSessions(mergeGroupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: waiterKeys.tables() })
    },
  })
}
