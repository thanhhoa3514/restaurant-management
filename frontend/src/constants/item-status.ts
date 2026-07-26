export type ItemStatus =
  | 'placed'
  | 'pending'
  | 'acknowledged'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'cancelled'

export interface StatusHistoryEntry {
  status: ItemStatus
  timestamp: Date
  from_status?: ItemStatus | null
  to_status?: ItemStatus
  changed_by_name?: string | null
  changed_by_role?: string | null
  reason?: string | null
  note?: string | null
}

export const STATUS_FLOW: ItemStatus[] = ['pending', 'acknowledged', 'preparing', 'ready', 'served']
