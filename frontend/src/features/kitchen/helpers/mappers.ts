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
  history: Array<{
    status: string
    from_status?: string | null
    to_status?: string
    timestamp: string
    changed_by_name?: string | null
    changed_by_role?: string | null
    reason?: string | null
    note?: string | null
  }>,
  fallbackStatus: string,
  fallbackAt: string,
): Array<{
  status: T
  timestamp: Date
  from_status: T | null
  to_status: T
  changed_by_name: string | null
  changed_by_role: string | null
  reason: string | null
  note: string | null
}> {
  const rows = history.length > 0 ? history : [{ status: fallbackStatus, timestamp: fallbackAt }]
  return rows.map((row) => {
    const toStatus = (row.to_status || row.status).toLowerCase() as T
    return {
      status: toStatus,
      timestamp: new Date(row.timestamp),
      from_status: row.from_status ? (row.from_status.toLowerCase() as T) : null,
      to_status: toStatus,
      changed_by_name: row.changed_by_name ?? null,
      changed_by_role: row.changed_by_role ?? null,
      reason: row.reason ?? null,
      note: row.note ?? null,
    }
  })
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
