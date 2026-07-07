import { apiRequest } from '@/lib/api'

export interface StaffStatusDTO {
  status: string
  timestamp: string
}

export interface StaffOptionDTO {
  name_snapshot: string
  option_group_name_snapshot: string
  price_delta_snapshot_vnd: number
  quantity: number
}

export interface StaffOrderItemDTO {
  id: string
  order_id: string
  menu_item_id: string
  name_snapshot: string
  variant_name_snapshot: string | null
  quantity: number
  unit_price_vnd: number
  options_total_vnd: number
  subtotal_vnd: number
  total_amount_vnd: number
  status: string
  station: string
  note: string
  options: StaffOptionDTO[]
  status_history: StaffStatusDTO[]
}

export interface StaffOrderDTO {
  id: string
  order_number: string
  order_type: string
  status: string
  submitted_at: string
  note: string
  items: StaffOrderItemDTO[]
}

export interface StaffSessionDTO {
  id: string
  session_code: string
  status: string
  customer_count: number
  opened_at: string
  bill_requested_at: string | null
  orders: StaffOrderDTO[]
  total_vnd: number
}

export interface StaffTableDTO {
  id: string
  code: string
  name: string
  capacity: number
  status: string
  area_name: string
  session: StaffSessionDTO | null
}

export interface StaffTablesResponse {
  tables: StaffTableDTO[]
}

export function fetchStaffTables(): Promise<StaffTablesResponse> {
  return apiRequest<StaffTablesResponse>('/api/v1/staff/tables')
}

export function requestSessionBill(
  sessionId: string,
): Promise<{ session_id: string; status: string; requested_at: string | null }> {
  return apiRequest(`/api/v1/staff/sessions/${sessionId}/request-bill`, { method: 'POST' })
}

export function updateStaffOrderItemStatus(
  itemId: string,
  status: string,
): Promise<{ id: string; status: string }> {
  return apiRequest(`/api/v1/staff/order-items/${itemId}/status`, {
    method: 'PATCH',
    body: { status },
  })
}
