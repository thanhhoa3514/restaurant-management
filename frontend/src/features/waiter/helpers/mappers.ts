import type {
  ItemStatus as WaiterItemStatus,
  WFItem,
  WFOrder,
  WFSession,
  WFTable,
} from '@/features/waiter/types'
import type { StaffOrderDTO, StaffOrderItemDTO, StaffTableDTO } from '@/features/waiter/api'

// Key theo mã bàn, không theo số: T01 và V01 cùng số nhưng là hai bàn khác nhau
const TABLE_LAYOUT: Record<string, { x_pct: number; y_pct: number }> = {
  T01: { x_pct: 22, y_pct: 18 },
  T02: { x_pct: 34, y_pct: 18 },
  T03: { x_pct: 64, y_pct: 18 },
  T04: { x_pct: 76, y_pct: 18 },
  T05: { x_pct: 24, y_pct: 36 },
  T06: { x_pct: 36, y_pct: 36 },
  T07: { x_pct: 50, y_pct: 36 },
  T08: { x_pct: 64, y_pct: 36 },
  T09: { x_pct: 24, y_pct: 52 },
  T10: { x_pct: 36, y_pct: 52 },
  V01: { x_pct: 76, y_pct: 52 },
  V02: { x_pct: 76, y_pct: 66 },
}

function parseTableNumber(code: string, name: string): number {
  const source = code || name
  const match = source.match(/\d+/)
  return match ? Number(match[0]) : 0
}

// ponytail: bàn chưa có toạ độ thì xếp lưới theo thứ tự trả về, đủ để không chồng nhau
function fallbackPosition(index: number) {
  return { x_pct: 12 + (index % 8) * 10, y_pct: 76 + Math.floor(index / 8) * 10 }
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
  return rows.map((table, index) => {
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
          merge_group_id: table.session.merge_group_id ?? null,
          orders: table.session.orders.map(toWaiterOrder),
        }
      : null
    return {
      id: table.id,
      code: table.code || table.name,
      number,
      capacity: table.capacity || 4,
      position: TABLE_LAYOUT[table.code] ?? fallbackPosition(index),
      status: session ? 'occupied' : 'empty',
      session,
    }
  })
}
