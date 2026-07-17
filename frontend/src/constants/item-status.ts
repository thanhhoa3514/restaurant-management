export type ItemStatus =
  | 'pending'
  | 'acknowledged'
  | 'preparing'
  | 'ready'
  | 'served'

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
