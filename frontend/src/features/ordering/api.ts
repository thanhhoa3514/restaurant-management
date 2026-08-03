import { apiRequest } from '@/lib/api'
import { getDeviceId } from '@/lib/device'
import { loadDeviceAccessToken, saveDeviceAccessToken } from '@/features/ordering/session-store'
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
  GuestCheckoutResponse,
} from './types'

export async function joinDiningSession(
  qrToken: string,
  guestName?: string,
): Promise<JoinSessionResult> {
  const resumeAccessToken = loadDeviceAccessToken(qrToken)
  const result = await apiRequest<JoinSessionResult>('/api/v1/customer/sessions/join', {
    method: 'POST',
    body: { qr_token: qrToken, guest_name: guestName, device_id: getDeviceId() },
    deviceAccessToken: resumeAccessToken,
  })
  if (result.access_token) {
    saveDeviceAccessToken(qrToken, result.access_token)
  }
  return result
}

// Poll with the device token in a header so it never enters browser history,
// proxy URLs, or ordinary access logs.
export function fetchDeviceStatus(deviceAccessToken: string): Promise<{ status: string }> {
  return apiRequest<{ status: string }>('/api/v1/customer/sessions/device-status', {
    deviceAccessToken,
  })
}

export function fetchCategories(deviceAccessToken: string): Promise<ApiCategory[]> {
  return apiRequest<ApiCategory[]>('/api/v1/customer/menu/categories', { deviceAccessToken })
}

export function fetchMenuItems(
  deviceAccessToken: string,
  categoryId?: string,
): Promise<ApiMenuItemSummary[]> {
  const query = categoryId ? `?category_id=${encodeURIComponent(categoryId)}` : ''
  return apiRequest<ApiMenuItemSummary[]>(`/api/v1/customer/menu/items${query}`, {
    deviceAccessToken,
  })
}

export function fetchMenuItem(deviceAccessToken: string, id: string): Promise<ApiMenuItemDetail> {
  return apiRequest<ApiMenuItemDetail>(`/api/v1/customer/menu/items/${id}`, { deviceAccessToken })
}

export function placeGuestOrder(
  deviceAccessToken: string,
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  return apiRequest<PlaceOrderResult>('/api/v1/customer/orders', {
    method: 'POST',
    body: input,
    deviceAccessToken,
  })
}

export function fetchGuestOrders(deviceAccessToken: string): Promise<GuestOrdersResponse> {
  return apiRequest<GuestOrdersResponse>('/api/v1/customer/orders', { deviceAccessToken })
}

export function editGuestOrder(
  deviceAccessToken: string,
  orderId: string,
  input: EditOrderInput,
): Promise<EditOrderResult> {
  return apiRequest<EditOrderResult>(`/api/v1/customer/orders/${orderId}/items`, {
    method: 'PUT',
    body: input,
    deviceAccessToken,
  })
}

export function cancelGuestOrder(deviceAccessToken: string, orderId: string): Promise<void> {
  return apiRequest<void>(`/api/v1/customer/orders/${orderId}`, {
    method: 'DELETE',
    deviceAccessToken,
  })
}

export function requestBill(deviceAccessToken: string): Promise<RequestBillResponse> {
  return apiRequest<RequestBillResponse>('/api/v1/customer/request-bill', {
    method: 'POST',
    deviceAccessToken,
  })
}

export function fetchGuestPayment(deviceAccessToken: string): Promise<GuestCheckoutResponse> {
  return apiRequest<GuestCheckoutResponse>('/api/v1/customer/payment', { deviceAccessToken })
}

export function callWaiter(
  deviceAccessToken: string,
  reason?: string,
): Promise<{ session_id: string; status: string }> {
  return apiRequest('/api/v1/customer/call-waiter', {
    method: 'POST',
    deviceAccessToken,
    body: { reason: reason ?? '' },
  })
}
