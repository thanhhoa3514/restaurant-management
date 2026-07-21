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
}

export const STATUS_FLOW: ItemStatus[] = [
  'pending',
  'acknowledged',
  'preparing',
  'ready',
  'served',
]
