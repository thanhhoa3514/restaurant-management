import { apiRequest } from '@/lib/api'

export interface KitchenTicketItemDTO {
  id: string
  order_item_id: string
  menu_item_id: string
  name_snapshot: string
  variant_name_snapshot: string | null
  quantity: number
  is_takeaway: boolean
  status: string
  note: string
  options: Array<{
    name_snapshot: string
    option_group_name_snapshot: string
    price_delta_snapshot_vnd: number
    quantity: number
  }>
  status_history: Array<{
    status: string
    from_status: string | null
    to_status: string
    timestamp: string
    changed_by_name: string | null
    changed_by_role: string | null
    reason: string | null
    note: string | null
  }>
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
  return apiRequest<KitchenQueueResponse>('/api/v1/restaurant/kitchen/queue')
}

export function updateKitchenOrderItemStatus(
  itemId: string,
  status: string,
): Promise<{ id: string; status: string }> {
  return apiRequest(`/api/v1/restaurant/kitchen/items/${itemId}/status`, {
    method: 'PATCH',
    body: { status },
  })
}

export interface CancelRequestDTO {
  id: string
  order_item_id: string
  order_id: string
  session_id: string
  table_code: string
  name_snapshot: string
  quantity: number
  item_status: string
  reason: string
  status: string
  requested_at: string
}

export function fetchPendingCancelRequests(): Promise<{
  cancel_requests: CancelRequestDTO[]
}> {
  return apiRequest('/api/v1/restaurant/kitchen/cancel-requests')
}

export function reviewCancelRequest(
  cancelRequestId: string,
  action: 'approve' | 'reject',
  note = '',
): Promise<{
  cancel_request_id: string
  order_item_id: string
  status: string
  item_status: string
}> {
  return apiRequest(`/api/v1/restaurant/kitchen/cancel-requests/${cancelRequestId}/review`, {
    method: 'POST',
    body: { action, note },
  })
}
