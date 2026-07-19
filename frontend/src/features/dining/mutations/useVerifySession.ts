import { useMutation, useQueryClient } from '@tanstack/react-query'
import { verifySession } from '@/features/dining/api'

export function useVerifySession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ sessionId, action }: { sessionId: string; action: 'approve' | 'reject' }) =>
      verifySession(sessionId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dining', 'pending-sessions'] })
    },
  })
}
