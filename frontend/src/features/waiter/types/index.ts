import type { ItemStatus, StatusHistoryEntry } from '@/constants'
export type { ItemStatus, StatusHistoryEntry } from '@/constants'
export { STATUS_FLOW } from '@/constants'

export type TableOccupancy = 'empty' | 'occupied'

export type WFPriority = 'call' | 'ready' | 'bill' | 'idle' | 'occupied' | 'empty'

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
  is_takeaway: boolean
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
  guest_name: string
  waiter_called_at: Date | null
  waiter_call_reason: string
  bill_requested_at: Date | null
  merge_group_id: string | null
  orders: WFOrder[]
}

export interface TablePosition {
  x_pct: number
  y_pct: number
}

export interface WFTable {
  id: string
  /** Mã bàn duy nhất (T01, V01…) — dùng để hiển thị, `number` chỉ để sắp xếp */
  code: string
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
  pending: number
}

import type { Lang } from '@/constants'
export type { Lang } from '@/constants'

export type WaiterView = 'plan' | 'grid'

export interface WaiterState {
  tables: WFTable[]
  now: Date
  timeMultiplier: number
  autoOn: boolean
  lang: Lang
  soundOn: boolean
  view: WaiterView
  selectedTableId: string | null
  justChangedIds: Set<string>
  demoOpen: boolean
  mergeMode: boolean
  mergeSelectedIds: string[]
}

export interface WaiterActions {
  selectTable: (tableId: string | null) => void
  acknowledgeCall: (tableId: string) => void
  notifyCashier: (tableId: string) => void
  markItemServed: (tableId: string, itemId: string) => void
  markAllServed: (tableId: string) => void
  confirmItem: (tableId: string, itemId: string) => void
  rejectItem: (tableId: string, itemId: string, reason: string) => void
  requestBill: (tableId: string) => void
  openSession: (tableId: string, guestCount: number, notes: string) => void
  injectItemReady: () => void
  injectCall: () => void
  injectBill: () => void
  injectNewSession: () => void
  setAutoOn: (value: boolean | ((prev: boolean) => boolean)) => void
  setTimeMultiplier: (value: number | ((prev: number) => number)) => void
  setLang: (lang: Lang) => void
  setSoundOn: (value: boolean | ((prev: boolean) => boolean)) => void
  setView: (value: WaiterView | ((prev: WaiterView) => WaiterView)) => void
  setDemoOpen: (value: boolean | ((prev: boolean) => boolean)) => void
  toggleMergeMode: () => void
  toggleMergeSelection: (tableId: string) => void
  confirmMerge: () => void
  splitGroup: (tableId: string) => void
}

export interface UseWaiterValue {
  state: WaiterState
  actions: WaiterActions
  counts: WFCounts
  selectedTable: WFTable | null
  t: (key: string, ...args: Array<string | number>) => string
}
