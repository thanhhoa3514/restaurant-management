import { useMutation } from '@tanstack/react-query'

import { cancelBillingSession } from '@/features/billing/api'

export function useCancelBillingSession() {
  return useMutation({
    mutationFn: (sessionId: string) => cancelBillingSession(sessionId),
  })
}
