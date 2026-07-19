import { useQuery } from '@tanstack/react-query'
import { fetchGuestTables } from '@/features/dining/api'
import type { GuestTable } from '@/features/dining/types'

export function useGuestTables(enabled: boolean) {
  return useQuery({
    queryKey: ['dining', 'guest-tables'],
    queryFn: fetchGuestTables,
    enabled,
    select: (data) => data.filter((t: GuestTable) => t.qr_token),
    staleTime: 30_000,
  })
}
