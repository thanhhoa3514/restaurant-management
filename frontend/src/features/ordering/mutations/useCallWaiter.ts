import { useMutation } from '@tanstack/react-query'
import { callWaiter } from '../api'

export function useCallWaiter() {
  return useMutation({
    mutationFn: (v: { sessionToken: string; reason?: string }) =>
      callWaiter(v.sessionToken, v.reason),
  })
}
