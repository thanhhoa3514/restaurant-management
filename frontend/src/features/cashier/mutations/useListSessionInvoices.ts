import { useQuery } from '@tanstack/react-query'
import { listSessionInvoices } from '@/features/billing/api'

export function useListSessionInvoices(diningSessionId: string | null) {
  return useQuery({
    queryKey: ['cashier', 'invoices', diningSessionId],
    queryFn: () => listSessionInvoices(diningSessionId!),
    enabled: !!diningSessionId,
    refetchInterval: 8_000,
  })
}
