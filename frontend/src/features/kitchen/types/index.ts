import type { ItemStatus, StatusHistoryEntry } from '@/constants'
export type { ItemStatus, StatusHistoryEntry } from '@/constants'
export { STATUS_FLOW } from '@/constants'

export type Urgency = 'green' | 'amber' | 'red'

export interface KDSItem {
  id: string
  name_vi: string
  name_en: string
  qty: number
  options_text_vi: string
  options_text_en: string
  notes: string
  is_takeaway: boolean
  status: ItemStatus
  status_history: StatusHistoryEntry[]
}

export interface Ticket {
  order_id: string
  table_number: number
  area_name_vi: string
  area_name_en: string
  submitted_at: Date
  items: KDSItem[]
}

export interface Dish {
  id: string
  name_vi: string
  name_en: string
  opts_vi: string
  opts_en: string
}

export interface Area {
  vi: string
  en: string
}

export interface KDSStats {
  pending: number
  preparing: number
  ready: number
}

export type { Lang } from '@/constants'
