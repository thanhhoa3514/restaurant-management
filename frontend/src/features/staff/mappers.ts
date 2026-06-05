import type { CashierSession, LineItem, Order } from '@/features/cashier/types'
import type { ItemStatus as KdsItemStatus, KDSItem, Ticket } from '@/features/kitchen/types'
import type {
  ItemStatus as WaiterItemStatus,
  WFItem,
  WFOrder,
  WFSession,
  WFTable,
} from '@/features/waiter/types'
import type { KitchenTicketDTO, StaffOrderDTO, StaffOrderItemDTO, StaffTableDTO } from './api'

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

function lowerStatus<T extends string>(status: string): T {
  return status.toLowerCase() as T
}

function optionText(item: {
  variant_name_snapshot: string | null
  options: Array<{ name_snapshot: string; quantity: number }>
}): string {
  const parts = [
    item.variant_name_snapshot,
    ...item.options.map((opt) =>
      opt.quantity > 1 ? `${opt.name_snapshot} ×${opt.quantity}` : opt.name_snapshot,
    ),
  ].filter(Boolean)
  return parts.join(' • ')
}

function statusHistory<T extends string>(
  history: Array<{ status: string; timestamp: string }>,
  fallbackStatus: string,
  fallbackAt: string,
): Array<{ status: T; timestamp: Date }> {
  const rows = history.length > 0 ? history : [{ status: fallbackStatus, timestamp: fallbackAt }]
  return rows.map((row) => ({
    status: lowerStatus<T>(row.status),
    timestamp: new Date(row.timestamp),
  }))
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
    status: lowerStatus<WaiterItemStatus>(item.status),
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

export function toWaiterTables(rows: StaffTableDTO[]): WFTable[] {
  return rows.map((table) => {
    const number = parseTableNumber(table.code, table.name)
    const session: WFSession | null = table.session
      ? {
          id: table.session.id,
          started_at: new Date(table.session.opened_at),
          guest_count: table.session.customer_count || table.capacity || 1,
          waiter_called_at: null,
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

function toLineItem(item: StaffOrderItemDTO): LineItem {
  const opts = optionText(item)
  return {
    id: item.id,
    name_snapshot_vi: item.name_snapshot,
    name_snapshot_en: item.name_snapshot,
    options_text_vi: opts,
    options_text_en: opts,
    notes: item.note,
    qty: item.quantity,
    unit_price_snapshot: item.unit_price_vnd,
    line_total: item.total_amount_vnd,
    _order_id: item.order_id,
  }
}

function toCashierOrder(order: StaffOrderDTO): Order {
  const submittedAt = new Date(order.submitted_at)
  return {
    id: order.id,
    submitted_at: submittedAt,
    items: order.items.map((item) => ({ ...toLineItem(item), _order_submitted_at: submittedAt })),
  }
}

export function toCashierSessions(rows: StaffTableDTO[]): CashierSession[] {
  return rows.flatMap((table) => {
    if (!table.session) return []
    const tableNumber = parseTableNumber(table.code, table.name)
    const orders = table.session.orders.map(toCashierOrder)
    const items = orders.flatMap((order) =>
      order.items.map((item) => ({
        ...item,
        _order_id: order.id,
        _order_submitted_at: order.submitted_at,
      })),
    )
    const subtotal = items.reduce((sum, item) => sum + item.line_total, 0)
    const vat = Math.round(subtotal * 0.08)
    const billRequested = table.session.bill_requested_at
      ? new Date(table.session.bill_requested_at)
      : null
    return [
      {
        id: table.session.id,
        table_number: tableNumber,
        area_name_vi: table.area_name || 'Nhà hàng',
        area_name_en: table.area_name || 'Restaurant',
        guest_count: table.session.customer_count || table.capacity || 1,
        started_at: new Date(table.session.opened_at),
        bill_requested_at: billRequested,
        status: table.session.status === 'AWAITING_PAYMENT' ? 'bill_requested' : 'dining',
        invoice: {
          number: table.session.session_code,
          created_at: new Date(table.session.opened_at),
          items,
          orders,
          status: 'LOCAL_DRAFT',
          subtotal,
          service_charge_amount: 0,
          service_charge_basis_points: 0,
          vat_amount: vat,
          vat_basis_points: 800,
          discount: null,
          total: subtotal + vat,
          paid_amount: 0,
          change_amount: 0,
          discount_history: [],
        },
        payment: null,
      } satisfies CashierSession,
    ]
  })
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
    status: lowerStatus<KdsItemStatus>(item.status),
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
