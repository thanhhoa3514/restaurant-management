import { apiRequest } from '@/lib/api'
import type {
  JoinSessionResult,
  ApiCategory,
  ApiMenuItemSummary,
  ApiMenuItemDetail,
  PlaceOrderInput,
  PlaceOrderResult,
  GuestOrdersResponse,
  EditOrderInput,
  EditOrderResult,
  RequestBillResponse,
} from './types'

// ── Session join (QR landing) ────────────────────────────────────────────────

export function joinDiningSession(qrToken: string, guestName?: string): Promise<JoinSessionResult> {
  return apiRequest<JoinSessionResult>('/api/v1/customer/sessions/join', {
    method: 'POST',
    body: { qr_token: qrToken, guest_name: guestName },
  })
}

// ── Menu reads (guest) ───────────────────────────────────────────────────────
// All menu/order calls authenticate with the dining session token via
// X-Session-Token. Endpoints live under /api/v1/customer/*.

export function fetchCategories(sessionToken: string): Promise<ApiCategory[]> {
  return apiRequest<ApiCategory[]>('/api/v1/customer/menu/categories', { sessionToken })
}

export function fetchMenuItems(
  sessionToken: string,
  categoryId?: string,
): Promise<ApiMenuItemSummary[]> {
  const query = categoryId ? `?category_id=${encodeURIComponent(categoryId)}` : ''
  return apiRequest<ApiMenuItemSummary[]>(`/api/v1/customer/menu/items${query}`, { sessionToken })
}

export function fetchMenuItem(sessionToken: string, id: string): Promise<ApiMenuItemDetail> {
  return apiRequest<ApiMenuItemDetail>(`/api/v1/customer/menu/items/${id}`, { sessionToken })
}

// ── Order mutations / reads (guest) ──────────────────────────────────────────

export function placeGuestOrder(
  sessionToken: string,
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  return apiRequest<PlaceOrderResult>('/api/v1/customer/orders', {
    method: 'POST',
    body: input,
    sessionToken,
  })
}

export function fetchGuestOrders(sessionToken: string): Promise<GuestOrdersResponse> {
  return apiRequest<GuestOrdersResponse>('/api/v1/customer/orders', { sessionToken })
}

// ── Order mutations (guest) ──────────────────────────────────────────────────

export function editGuestOrder(
  sessionToken: string,
  orderId: string,
  input: EditOrderInput,
): Promise<EditOrderResult> {
  return apiRequest<EditOrderResult>(`/api/v1/customer/orders/${orderId}/items`, {
    method: 'PUT',
    body: input,
    sessionToken,
  })
}

export function cancelGuestOrder(sessionToken: string, orderId: string): Promise<void> {
  return apiRequest<void>(`/api/v1/customer/orders/${orderId}`, {
    method: 'DELETE',
    sessionToken,
  })
}

// ── Request bill ───────────────────────────────────────────────────────────

export function requestBill(sessionToken: string): Promise<RequestBillResponse> {
  return apiRequest<RequestBillResponse>('/api/v1/customer/request-bill', {
    method: 'POST',
    sessionToken,
  })
}

// ── Call waiter ──────────────────────────────────────────────────────────────

export function callWaiter(sessionToken: string): Promise<{ session_id: string; status: string }> {
  return apiRequest('/api/v1/customer/call-waiter', {
    method: 'POST',
    sessionToken,
  })
}
