import { useMutation, useQueryClient } from '@tanstack/react-query'
import { verifyDevice } from '@/features/dining/api'

// Approve/reject a single waiting device (by its session_devices row id).
export function useVerifySession() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ deviceId, action }: { deviceId: string; action: 'approve' | 'reject' }) =>
      verifyDevice(deviceId, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dining', 'pending-sessions'] })
    },
  })
}
