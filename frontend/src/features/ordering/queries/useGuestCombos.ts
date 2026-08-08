import { useQuery } from '@tanstack/react-query'
import { fetchCombo, fetchCombos } from '@/features/ordering/api'
import type { ApiComboDetail, ApiComboSummary } from '@/features/ordering/types'

export function useGuestCombos(deviceAccessToken?: string) {
  return useQuery<ApiComboSummary[]>({
    queryKey: ['guest-combos', deviceAccessToken],
    queryFn: () => fetchCombos(deviceAccessToken!),
    enabled: !!deviceAccessToken,
  })
}

export function useGuestComboDetail(deviceAccessToken?: string, comboId?: string | null) {
  return useQuery<ApiComboDetail>({
    queryKey: ['guest-combo', deviceAccessToken, comboId],
    queryFn: () => fetchCombo(deviceAccessToken!, comboId!),
    enabled: !!deviceAccessToken && !!comboId,
  })
}
