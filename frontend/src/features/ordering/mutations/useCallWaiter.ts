import { useMutation } from '@tanstack/react-query'
import { callWaiter } from '../api'

export function useCallWaiter() {
  return useMutation({
    mutationFn: (v: { deviceAccessToken: string; reason?: string }) =>
      callWaiter(v.deviceAccessToken, v.reason),
  })
}
