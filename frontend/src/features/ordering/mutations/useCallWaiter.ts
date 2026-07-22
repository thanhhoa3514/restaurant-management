import { useMutation } from '@tanstack/react-query'
import { callWaiter } from '../api'

export function useCallWaiter() {
  return useMutation({
    mutationFn: (sessionToken: string) => callWaiter(sessionToken),
  })
}
