import type { CartLine } from '../types'

const vndFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
})

export function formatVND(price: number): string {
  return vndFormatter.format(price)
}

export { fmtTime as formatTime } from '@/shared/date'

// One-line summary of a cart line's variant + chosen options, for display.
export function summarizeCartLine(line: CartLine): string {
  const parts: string[] = []
  if (line.variantNameSnapshot) parts.push(line.variantNameSnapshot)
  for (const opt of line.options) parts.push(opt.nameSnapshot)
  return parts.join(' · ')
}

// Pre-submit estimate only — the server returns authoritative totals on place.
export function cartTotal(cart: CartLine[]): number {
  return cart.reduce((sum, line) => sum + line.estUnitPriceVnd * line.quantity, 0)
}

export function totalItems(cart: CartLine[]): number {
  return cart.reduce((sum, line) => sum + line.quantity, 0)
}
