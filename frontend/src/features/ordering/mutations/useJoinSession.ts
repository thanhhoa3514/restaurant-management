import { useMutation } from '@tanstack/react-query'
import { joinDiningSession } from '@/features/ordering/api'

export function useJoinSession() {
  return useMutation({
    mutationFn: ({ qrToken, guestName }: { qrToken: string; guestName?: string }) =>
      joinDiningSession(qrToken, guestName),
  })
}
