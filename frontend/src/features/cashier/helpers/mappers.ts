import type { CashierSession, LineItem, Order } from '@/features/cashier/types'
import type { StaffOrderDTO, StaffOrderItemDTO, StaffTableDTO } from '@/features/waiter/api'
import type { BillingInvoiceItemDTO } from '@/features/billing/api'

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
    is_takeaway: item.is_takeaway,
    _order_id: item.order_id,
  }
}

export function toInvoiceItem(item: BillingInvoiceItemDTO): LineItem {
  return {
    id: item.order_item_id ?? item.id,
    name_snapshot_vi: item.name_snapshot,
    name_snapshot_en: item.name_snapshot,
    options_text_vi: '',
    options_text_en: '',
    notes: '',
    qty: item.quantity,
    unit_price_snapshot: item.unit_price_vnd,
    line_total: item.total_amount_vnd,
    is_takeaway: item.is_takeaway,
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

/**
 * Bàn đã gộp thanh toán chung một hoá đơn, nên thu ngân chỉ thấy một dòng:
 * phiên mở sớm nhất làm phiên chủ, món của các bàn phụ dồn vào đó.
 */
function mergeGroupedTables(rows: StaffTableDTO[]): StaffTableDTO[] {
  const groups = new Map<string, StaffTableDTO[]>()
  for (const table of rows) {
    const groupId = table.session?.merge_group_id
    if (!groupId) continue
    groups.set(groupId, [...(groups.get(groupId) ?? []), table])
  }
  if (groups.size === 0) return rows

  const folded = new Map<string, StaffTableDTO>()
  for (const [groupId, members] of groups) {
    // Phiên mở sớm nhất làm phiên chủ — khớp với billingSessions ở backend
    const sorted = [...members].sort((a, b) =>
      a.session!.opened_at.localeCompare(b.session!.opened_at),
    )
    const primary = sorted[0]
    folded.set(groupId, {
      ...primary,
      code: sorted.map((table) => table.code).join(' + '),
      session: {
        ...primary.session!,
        orders: sorted.flatMap((table) => table.session!.orders),
      },
    })
  }

  const emitted = new Set<string>()
  return rows.flatMap((table) => {
    const groupId = table.session?.merge_group_id
    if (!groupId) return [table]
    if (emitted.has(groupId)) return []
    emitted.add(groupId)
    return [folded.get(groupId)!]
  })
}

export function toCashierSessions(rows: StaffTableDTO[]): CashierSession[] {
  return mergeGroupedTables(rows).flatMap((table) => {
    if (!table.session) return []
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
        table_label: table.code || table.name,
        area_name_vi: table.area_name || 'Nhà hàng',
        area_name_en: table.area_name || 'Restaurant',
        guest_count: table.session.customer_count || table.capacity || 1,
        guest_name: table.session.guest_name,
        started_at: new Date(table.session.opened_at),
        bill_requested_at: billRequested,
        status: table.session.status === 'AWAITING_PAYMENT' ? 'bill_requested' : 'dining',
        invoices: [
          {
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
            payment: null,
          },
        ],
        activeInvoiceId: null,
      } satisfies CashierSession,
    ]
  })
}
