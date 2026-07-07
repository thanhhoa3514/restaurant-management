// Domain types for the guest ordering flow. Menu/order shapes live in ../api
// (backend DTOs); this file holds the client-only session + cart model.

export type Lang = 'vi' | 'en'

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
