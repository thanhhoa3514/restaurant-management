export type SessionStatus =
  | 'dining'
  | 'bill_requested'
  | 'in_payment'
  | 'paid'
  | 'closed'
  | 'voided'

export type PaymentMethod = 'cash' | 'card' | 'ewallet'
export type SubMethod = 'cash' | 'card' | 'momo' | 'zalopay' | 'vnpay' | 'mock'
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
  id?: string
  number: string
  created_at: Date
  items: LineItem[]
  orders: Order[]
  status?: string
  subtotal: number
  service_charge_amount: number
  service_charge_basis_points: number
  vat_amount: number
  vat_basis_points: number
  discount: DiscountRecord | null
  total: number
  paid_amount: number
  change_amount: number
  discount_history: DiscountRecord[]
  payment: PaymentRecord | null
  payments?: PaymentRecord[]
  remaining?: number
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
  pay_url?: string
  deeplink?: string
  qr_code_url?: string
}

export interface CashierSession {
  id: string
  /** Mã bàn hiển thị; nhóm gộp là "T09 + V01" */
  table_label: string
  area_name_vi: string
  area_name_en: string
  guest_count: number
  guest_name: string
  started_at: Date
  bill_requested_at: Date | null
  status: SessionStatus
  invoices: Invoice[]
  activeInvoiceId: string | null
}

export interface Provider {
  id: SubMethod
  name: string
  accent: string
  dot: string
}

export type { Lang } from '@/constants'
