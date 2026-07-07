import { apiRequest } from '@/lib/api'

export interface KitchenTicketItemDTO {
  id: string
  order_item_id: string
  menu_item_id: string
  name_snapshot: string
  variant_name_snapshot: string | null
  quantity: number
  status: string
  note: string
  options: Array<{
    name_snapshot: string
    option_group_name_snapshot: string
    price_delta_snapshot_vnd: number
    quantity: number
  }>
  status_history: Array<{ status: string; timestamp: string }>
}

export interface KitchenTicketDTO {
  id: string
  order_id: string
  session_id: string
  table_id: string
  table_code: string
  table_name: string
  ticket_number: string
  station: string
  priority: string
  status: string
  submitted_at: string
  items: KitchenTicketItemDTO[]
}

export interface KitchenQueueResponse {
  tickets: KitchenTicketDTO[]
}

export function fetchKitchenQueue(): Promise<KitchenQueueResponse> {
  return apiRequest<KitchenQueueResponse>('/api/v1/kitchen/queue')
}

export function updateKitchenOrderItemStatus(
  itemId: string,
  status: string,
): Promise<{ id: string; status: string }> {
  return apiRequest(`/api/v1/kitchen/items/${itemId}/status`, {
    method: 'PATCH',
    body: { status },
  })
}
