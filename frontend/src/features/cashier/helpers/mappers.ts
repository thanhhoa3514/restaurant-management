import type { CashierSession, LineItem, Order } from '@/features/cashier/types'
import type { StaffOrderDTO, StaffOrderItemDTO, StaffTableDTO } from '@/features/waiter/api'

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
