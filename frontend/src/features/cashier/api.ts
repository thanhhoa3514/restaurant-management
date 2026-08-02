import { apiRequest } from '@/lib/api'

export interface StaffTakeawayLineInput {
  menu_item_id: string
  variant_id?: string
  quantity: number
  note: string
  options: { option_id: string; quantity: number }[]
}

export interface StaffTakeawayInput {
  items: StaffTakeawayLineInput[]
  customer_name: string
  customer_phone: string
  pickup_time?: string
  note?: string
}

export interface StaffTakeawayItemDTO {
  order_item_id: string
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
  is_takeaway: boolean
}

export interface StaffTakeawayResult {
  order_id: string
  order_number: string
  order_type: string
  items: StaffTakeawayItemDTO[]
  total_vnd: number
}

export function reopenSession(sessionId: string): Promise<{ session_id: string; status: string }> {
  return apiRequest(`/api/v1/restaurant/sessions/${sessionId}/reopen`, { method: 'POST' })
}

export function placeStaffTakeawayOrder(input: StaffTakeawayInput): Promise<StaffTakeawayResult> {
  return apiRequest<StaffTakeawayResult>('/api/v1/restaurant/orders/takeaway', {
    method: 'POST',
    body: input,
  })
}

export type StaffSessionTakeawayInput = Pick<StaffTakeawayInput, 'items' | 'note'>

export function addStaffSessionTakeawayItems(
  sessionId: string,
  input: StaffSessionTakeawayInput,
): Promise<StaffTakeawayResult> {
  return apiRequest<StaffTakeawayResult>(
    `/api/v1/restaurant/sessions/${encodeURIComponent(sessionId)}/takeaway-items`,
    {
      method: 'POST',
      body: input,
    },
  )
}
