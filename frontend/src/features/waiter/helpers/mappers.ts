import type {
  ItemStatus as WaiterItemStatus,
  WFItem,
  WFOrder,
  WFSession,
  WFTable,
} from '@/features/waiter/types'
import type { StaffOrderDTO, StaffOrderItemDTO, StaffTableDTO } from '@/features/waiter/api'

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
          waiter_call_reason: table.session.waiter_call_reason ?? '',
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
      position:
        table.position_x != null && table.position_y != null
          ? { x_pct: table.position_x, y_pct: table.position_y }
          : fallbackPosition(index),
      status: session ? 'occupied' : 'empty',
      session,
    }
  })
}
