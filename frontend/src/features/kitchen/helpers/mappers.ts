import type { ItemStatus as KdsItemStatus, KDSItem, Ticket } from '@/features/kitchen/types'
import type { KitchenTicketDTO } from '@/features/kitchen/api'

function optionText(item: {
  variant_name_snapshot: string | null
  options: Array<{ name_snapshot: string; quantity: number }> | null
}): string {
  const parts = [
    item.variant_name_snapshot,
    ...(item.options ?? []).map((opt) =>
      opt.quantity > 1 ? `${opt.name_snapshot} \u00d7${opt.quantity}` : opt.name_snapshot,
    ),
  ].filter(Boolean)
  return parts.join(' \u2022 ')
}

function statusHistory<T extends string>(
  history: Array<{ status: string; timestamp: string }>,
  fallbackStatus: string,
  fallbackAt: string,
): Array<{ status: T; timestamp: Date }> {
  const rows = history.length > 0 ? history : [{ status: fallbackStatus, timestamp: fallbackAt }]
  return rows.map((row) => ({
    status: row.status.toLowerCase() as T,
    timestamp: new Date(row.timestamp),
  }))
}

function parseTableNumber(code: string, name: string): number {
  const source = code || name
  const match = source.match(/\d+/)
  return match ? Number(match[0]) : 0
}

function toKdsItem(item: KitchenTicketDTO['items'][number], submittedAt: string): KDSItem {
  const opts = optionText(item)
  return {
    id: item.order_item_id,
    name_vi: item.name_snapshot,
    name_en: item.name_snapshot,
    qty: item.quantity,
    options_text_vi: opts,
    options_text_en: opts,
    notes: item.note,
    status: item.status.toLowerCase() as KdsItemStatus,
    status_history: statusHistory<KdsItemStatus>(item.status_history, item.status, submittedAt),
  }
}

export function toKdsTickets(rows: KitchenTicketDTO[]): Ticket[] {
  return rows.map((ticket) => ({
    order_id: ticket.id,
    table_number: parseTableNumber(ticket.table_code, ticket.table_name),
    area_name_vi: ticket.station || 'Bếp',
    area_name_en: ticket.station || 'Kitchen',
    submitted_at: new Date(ticket.submitted_at),
    items: ticket.items.map((item) => toKdsItem(item, ticket.submitted_at)),
  }))
}
