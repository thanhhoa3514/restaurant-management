import type {
  ItemStatus as WaiterItemStatus,
  WFItem,
  WFOrder,
  WFSession,
  WFTable,
} from '@/features/waiter/types'
import type { StaffOrderDTO, StaffOrderItemDTO, StaffTableDTO } from '@/features/waiter/api'

const TABLE_LAYOUT: Record<number, { x_pct: number; y_pct: number }> = {
  1: { x_pct: 22, y_pct: 18 },
  2: { x_pct: 34, y_pct: 18 },
  3: { x_pct: 64, y_pct: 18 },
  4: { x_pct: 76, y_pct: 18 },
  5: { x_pct: 88, y_pct: 32 },
  6: { x_pct: 88, y_pct: 48 },
  7: { x_pct: 24, y_pct: 36 },
  8: { x_pct: 36, y_pct: 36 },
  9: { x_pct: 50, y_pct: 36 },
  10: { x_pct: 64, y_pct: 36 },
  11: { x_pct: 76, y_pct: 66 },
  12: { x_pct: 24, y_pct: 52 },
  13: { x_pct: 36, y_pct: 52 },
  14: { x_pct: 50, y_pct: 52 },
  15: { x_pct: 64, y_pct: 52 },
  16: { x_pct: 76, y_pct: 52 },
  17: { x_pct: 50, y_pct: 68 },
  18: { x_pct: 22, y_pct: 68 },
  19: { x_pct: 22, y_pct: 84 },
  20: { x_pct: 38, y_pct: 84 },
}

function parseTableNumber(code: string, name: string): number {
  const source = code || name
  const match = source.match(/\d+/)
  return match ? Number(match[0]) : 0
}

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

function toWaiterItem(item: StaffOrderItemDTO, submittedAt: string): WFItem {
  const opts = optionText(item)
  return {
    id: item.id,
    name_vi: item.name_snapshot,
    name_en: item.name_snapshot,
    qty: item.quantity,
    options_text_vi: opts,
    options_text_en: opts,
    notes: item.note,
    status: item.status.toLowerCase() as WaiterItemStatus,
    status_history: statusHistory<WaiterItemStatus>(item.status_history, item.status, submittedAt),
    unit_price: item.unit_price_vnd,
  }
}

function toWaiterOrder(order: StaffOrderDTO): WFOrder {
  return {
    id: order.id,
    submitted_at: new Date(order.submitted_at),
    items: order.items.map((item) => toWaiterItem(item, order.submitted_at)),
  }
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

export function toWaiterTables(rows: StaffTableDTO[]): WFTable[] {
  return rows.map((table) => {
    const number = parseTableNumber(table.code, table.name)
    const session: WFSession | null = table.session
      ? {
          id: table.session.id,
          started_at: new Date(table.session.opened_at),
          guest_count: table.session.customer_count || table.capacity || 1,
          guest_name: table.session.guest_name,
          waiter_called_at: table.session.waiter_called_at
            ? new Date(table.session.waiter_called_at)
            : null,
          bill_requested_at:
            table.session.bill_requested_at || table.session.status === 'AWAITING_PAYMENT'
              ? new Date(table.session.bill_requested_at ?? table.session.opened_at)
              : null,
          orders: table.session.orders.map(toWaiterOrder),
        }
      : null
    return {
      id: table.id,
      number,
      capacity: table.capacity || 4,
      position: TABLE_LAYOUT[number] ?? {
        x_pct: 10 + (number % 8) * 10,
        y_pct: 20 + Math.floor(number / 8) * 18,
      },
      status: session ? 'occupied' : 'empty',
      session,
    }
  })
}
