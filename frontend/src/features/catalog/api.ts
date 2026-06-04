import { apiRequest } from '@/lib/api'
import type { ToggleAvailabilityResult } from '@/features/catalog/types'

export interface ToggleAvailabilityArgs {
  itemId: string
  // Explicit target state (not a blind flip) so concurrent admin edits don't
  // net-cancel and the action is auditable.
  available: boolean
}

export function toggleMenuItemAvailability({
  itemId,
  available,
}: ToggleAvailabilityArgs): Promise<ToggleAvailabilityResult> {
  return apiRequest<ToggleAvailabilityResult>('/api/v1/catalog/toggle-availability', {
    method: 'POST',
    body: { item_id: itemId, available },
  })
}
