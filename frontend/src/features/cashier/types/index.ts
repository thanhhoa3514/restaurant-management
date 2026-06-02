export type SessionStatus =
  | 'dining'
  | 'bill_requested'
  | 'in_payment'
  | 'paid'
  | 'closed'
  | 'voided'

export type PaymentMethod = 'cash' | 'card' | 'ewallet'
export type SubMethod = 'cash' | 'card' | 'momo' | 'zalopay' | 'vnpay'
export type PaymentRecordStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface LineItem {
  id: string
  name_snapshot_vi: string
  name_snapshot_en: string
  options_text_vi: string
  options_text_en: string
  notes: string
  qty: number
  unit_price_snapshot: number
  line_total: number
  _order_id?: string
  _order_submitted_at?: Date
}

export interface Order {
  id: string
  submitted_at: Date
  items: LineItem[]
}

export interface DiscountRecord {
  amount: number
  reason: string
  applied_by: string
  applied_at: Date
  action: 'applied' | 'removed'
}

export interface Invoice {
  number: string
  created_at: Date
  items: LineItem[]
  orders: Order[]
  subtotal: number
  vat_amount: number
  discount: DiscountRecord | null
  total: number
  discount_history: DiscountRecord[]
}

export interface PaymentRecord {
  method: PaymentMethod
  sub_method: SubMethod
  status: PaymentRecordStatus
  transaction_id: string
  initiated_at: Date
  completed_at: Date | null
  amount_tendered: number | null
  change: number | null
  last4: string | null
  bank: string | null
}

export interface CashierSession {
  id: string
  table_number: number
  area_name_vi: string
  area_name_en: string
  guest_count: number
  started_at: Date
  bill_requested_at: Date | null
  status: SessionStatus
  invoice: Invoice
  payment: PaymentRecord | null
}

export interface Provider {
  id: SubMethod
  name: string
  accent: string
  dot: string
}

export type Lang = 'vi' | 'en'
