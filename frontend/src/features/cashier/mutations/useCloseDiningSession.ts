import { useMutation } from '@tanstack/react-query'
import { closeDiningSession } from '@/features/dining/api'

export function useCloseDiningSession() {
  return useMutation({
    mutationFn: (sessionId: string) => closeDiningSession(sessionId),
  })
}
