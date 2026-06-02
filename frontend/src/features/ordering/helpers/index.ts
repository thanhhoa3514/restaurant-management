import type { MenuItem, OptionGroup, CartLine } from '../types'
import { getMenuItem } from '../data/menu'

export function formatVND(price: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(price)
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function priceForItem(
  item: MenuItem,
  selections?: CartLine['selections'],
): number {
  if (!selections || Object.keys(selections).length === 0) {
    return item.price
  }
  let total = item.price
  for (const group of item.option_groups) {
    const selected = selections[group.id]
    if (!selected) continue
    const ids = Array.isArray(selected) ? selected : [selected]
    for (const id of ids) {
      const opt = group.options.find((o) => o.id === id)
      if (opt) total += opt.price_modifier
    }
  }
  return total
}

export function defaultSelections(groups: OptionGroup[]): CartLine['selections'] {
  const selections: CartLine['selections'] = {}
  for (const group of groups) {
    if (group.type === 'single') {
      selections[group.id] = group.options[0]?.id ?? ''
    } else {
      selections[group.id] = []
    }
  }
  return selections
}

export function summarizeOptions(
  itemId: string,
  selections: CartLine['selections'],
  lang: 'vi' | 'en',
): string {
  const item = getMenuItem(itemId)
  if (!item) return ''
  const parts: string[] = []
  for (const group of item.option_groups) {
    const selected = selections[group.id]
    if (!selected) continue
    const ids = Array.isArray(selected) ? selected : [selected]
    const names = ids
      .map((id) => {
        const opt = group.options.find((o) => o.id === id)
        return opt ? (lang === 'vi' ? opt.name_vi : opt.name_en) : ''
      })
      .filter(Boolean)
    if (names.length > 0) {
      parts.push(names.join(', '))
    }
  }
  return parts.join(' · ')
}

export function cartTotal(cart: CartLine[]): number {
  return cart.reduce((sum, line) => sum + line.unitPrice * line.qty, 0)
}

export function totalItems(cart: CartLine[]): number {
  return cart.reduce((sum, line) => sum + line.qty, 0)
}
