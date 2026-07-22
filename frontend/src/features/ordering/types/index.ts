// ── Client-only domain types ──────────────────────────────────────────────
// Menu/order shapes from the backend live below; this section holds the
// client-only session + cart model.

export type { Lang } from '@/constants'

export type Screen = 'qr' | 'menu' | 'order' | 'summary' | 'invoice'

export interface Session {
  token: string
  table: string
  startedAt: Date
  sessionId?: string
  tableId?: string
  status?: string
}

// A chosen option inside a cart line. priceDeltaVnd/nameSnapshot are kept for
// local display + estimate only — the server reprices authoritatively on place.
export interface CartOption {
  optionId: string
  groupId: string
  nameSnapshot: string
  priceDeltaVnd: number
  quantity: number
}

// A line in the local cart, modelled to match the place-order payload so no
// re-mapping is needed at submit time (variant is distinct from options).
export interface CartLine {
  id?: string
  menuItemId: string
  variantId?: string
  variantNameSnapshot?: string
  quantity: number
  note: string
  // Display snapshot for cart rendering (server has authoritative pricing).
  nameSnapshot: string
  imageUrl: string
  // base/variant price + summed option deltas, for the pre-submit estimate.
  estUnitPriceVnd: number
  options: CartOption[]
}

// ── Backend DTOs (API response shapes) ───────────────────────────────────

export interface JoinSessionResult {
  status: string
  session_token?: string
  session_id?: string
  table_id?: string
  table_code?: string
  table_name?: string
}

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
  has_required_options: boolean
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
  option_id: string
  option_group_id: string
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
  is_takeaway: boolean
  options: OrderOptionDTO[]
  unavailable_reason?: string | null
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
  version: number
  items: OrderItemDTO[]
}

export interface GuestOrdersResponse {
  orders: GuestOrderDTO[]
  session_total_vnd: number
}

// ── Request-bill types ────────────────────────────────────────────────────

export interface RequestBillResponse {
  session_id: string
  status: string
  requested_at: string
}

// ── Edit-order types ──────────────────────────────────────────────────────

export interface EditOrderOptionInput {
  option_id: string
  quantity: number
}

export interface EditOrderLineInput {
  order_item_id: string
  quantity: number
  note: string
  options: EditOrderOptionInput[]
}

export interface EditOrderInput {
  version: number
  items: EditOrderLineInput[]
}

export interface EditOrderResult {
  order_id: string
  order_number: string
  order_type: string
  version: number
  status: string
  items: OrderItemDTO[]
  session_total_vnd: number
}
