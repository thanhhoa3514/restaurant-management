import { apiRequest } from '@/lib/api'

// ── Session join (QR landing) ────────────────────────────────────────────────

export interface JoinSessionResult {
  status: string
  session_token?: string
  session_id?: string
  table_id?: string
  table_code?: string
  table_name?: string
}

export function joinDiningSession(qrToken: string): Promise<JoinSessionResult> {
  return apiRequest<JoinSessionResult>('/api/v1/customer/sessions/join', {
    method: 'POST',
    body: { qr_token: qrToken },
  })
}

// ── Menu reads (guest) ───────────────────────────────────────────────────────
// All menu/order calls authenticate with the dining session token via
// X-Session-Token. Endpoints live under /api/v1/customer/*.

export interface ApiCategory {
  id: string
  name: string
  slug: string
  description: string
  image_url: string
  icon: string
  display_order: number
}

export interface ApiMenuItemSummary {
  id: string
  category_id: string
  name: string
  slug: string
  short_description: string
  image_url: string
  base_price_vnd: number
  availability_status: string
  is_available: boolean
  has_variants: boolean
  price_from_vnd: number | null
}

export interface ApiVariant {
  id: string
  name: string
  unit: string
  price_vnd: number
  is_default: boolean
  is_available: boolean
  display_order: number
}

export interface ApiOption {
  id: string
  name: string
  price_delta_vnd: number
  is_default: boolean
  is_available: boolean
  display_order: number
}

export interface ApiOptionGroup {
  id: string
  name: string
  description: string
  selection_type: string
  is_required: boolean
  min_selections: number
  max_selections: number | null
  display_order: number
  options: ApiOption[]
}

export interface ApiMenuItemDetail {
  id: string
  category_id: string
  name: string
  slug: string
  description: string
  short_description: string
  image_url: string
  images: string[]
  base_price_vnd: number
  availability_status: string
  is_available: boolean
  is_spicy: boolean
  variants: ApiVariant[]
  option_groups: ApiOptionGroup[]
}

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

export interface PlaceOrderOptionInput {
  option_id: string
  quantity: number
}

export interface PlaceOrderLineInput {
  menu_item_id: string
  variant_id?: string
  quantity: number
  note: string
  options: PlaceOrderOptionInput[]
}

export interface PlaceOrderInput {
  note: string
  items: PlaceOrderLineInput[]
}

export interface OrderOptionDTO {
  name_snapshot: string
  price_delta_snapshot_vnd: number
  quantity: number
}

export interface OrderItemDTO {
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
  options: OrderOptionDTO[]
}

export interface PlaceOrderResult {
  order_id: string
  order_number: string
  order_type: string
  items: OrderItemDTO[]
  session_total_vnd: number
}

export interface GuestOrderDTO {
  id: string
  order_number: string
  order_type: string
  status: string
  submitted_at: string
  note: string
  items: OrderItemDTO[]
}

export interface GuestOrdersResponse {
  orders: GuestOrderDTO[]
  session_total_vnd: number
}

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
