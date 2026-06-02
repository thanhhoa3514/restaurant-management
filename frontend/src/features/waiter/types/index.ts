export type ItemStatus =
  | 'pending'
  | 'acknowledged'
  | 'preparing'
  | 'ready'
  | 'served'

export type TableOccupancy = 'empty' | 'occupied'

export type WFPriority =
  | 'call'
  | 'ready'
  | 'bill'
  | 'idle'
  | 'occupied'
  | 'empty'

export interface StatusHistoryEntry {
  status: ItemStatus
  timestamp: Date
}

export interface WFItem {
  id: string
  name_vi: string
  name_en: string
  qty: number
  options_text_vi: string
  options_text_en: string
  notes: string
  status: ItemStatus
  status_history: StatusHistoryEntry[]
  unit_price: number
}

export interface WFOrder {
  id: string
  submitted_at: Date
  items: WFItem[]
}

export interface WFSession {
  id: string
  started_at: Date
  guest_count: number
  waiter_called_at: Date | null
  bill_requested_at: Date | null
  orders: WFOrder[]
}

export interface TablePosition {
  x_pct: number
  y_pct: number
}

export interface WFTable {
  id: string
  number: number
  capacity: number
  position: TablePosition
  status: TableOccupancy
  session: WFSession | null
}

export interface Landmark {
  key: string
  x: number
  y: number
  w: number
  h: number
  tone: string
}

export interface MenuItemOption {
  id: string
  name_vi: string
  name_en: string
  opts_vi: string
  opts_en: string
  price: number
}

export interface WFCounts {
  calls: number
  ready: number
  bills: number
  occupied: number
  total: number
}

export type Lang = 'vi' | 'en'

export const STATUS_FLOW: ItemStatus[] = [
  'pending',
  'acknowledged',
  'preparing',
  'ready',
  'served',
]
