import { type FC } from 'react'
import { ShoppingBag } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useOrdering } from '../hooks/use-ordering'
import { DICT } from '../data/i18n'
import { formatVND, formatTime } from '../helpers'
import { fetchGuestOrders, type OrderItemDTO } from '../api'
import type { Lang } from '../types'
import { Button } from '../../../components/ui/button'
import { Badge } from '../../../components/ui/badge'
import { Skeleton } from '../../../components/ui/skeleton'

// Maps backend order-item status to a display label + colour. Unknown statuses
// fall back to a neutral chip showing the raw value.
const STATUS_LABELS: Record<Lang, Record<string, string>> = {
  vi: { PENDING: 'Chờ xác nhận', CONFIRMED: 'Đã xác nhận', PREPARING: 'Đang chuẩn bị', READY: 'Sẵn sàng', SERVED: 'Đã phục vụ', CANCELLED: 'Đã huỷ' },
  en: { PENDING: 'Pending', CONFIRMED: 'Confirmed', PREPARING: 'Preparing', READY: 'Ready', SERVED: 'Served', CANCELLED: 'Cancelled' },
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-system-orange/15 text-system-orange',
  CONFIRMED: 'bg-system-blue/15 text-system-blue',
  PREPARING: 'bg-system-blue/15 text-system-blue',
  READY: 'bg-system-green/15 text-system-green',
  SERVED: 'bg-tertiary/20 text-tertiary',
  CANCELLED: 'bg-system-red/15 text-system-red',
}

export const OrderStatusScreen: FC = () => {
  const { state, dispatch } = useOrdering()
  const t = DICT[state.lang]
  const sessionToken = state.session?.token

  const { data: ordersData, isLoading: isOrdersLoading } = useQuery({
    queryKey: ['guest-orders', sessionToken],
    queryFn: () => fetchGuestOrders(sessionToken!),
    enabled: !!sessionToken,
  })

  const orders = ordersData?.orders ?? []

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-[var(--z-sticky)] bg-[var(--material-thin)]/80 backdrop-blur-2xl border-b border-[var(--separator)] shadow-sm px-4 pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-[var(--text)] tracking-tight flex items-center gap-2">
              {t.your_order}
            </h1>
          </div>
          <Badge className="rounded-full bg-[var(--system-green)]/15 text-[var(--system-green)] text-xs font-bold px-3 py-1 border-0">
            {orders.length} {t.orders_history.toLowerCase()}
          </Badge>
        </div>
      </header>

      <div className="flex-1 px-4 py-4 flex flex-col gap-4">
        {isOrdersLoading ? (
          <>
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <ShoppingBag size={32} className="text-quaternary" />
            <p className="text-sm text-tertiary">{t.empty_cart}</p>
          </div>
        ) : (
          orders.map((order) => (
            <div key={order.id} className="rounded-xl bg-elevated p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-tertiary">
                  {t.submitted_at} {formatTime(new Date(order.submitted_at))}
                </span>
                <span className="text-xs text-tertiary">#{order.order_number}</span>
              </div>
              {order.items.map((item) => (
                <OrderItemRow key={item.order_item_id} item={item} lang={state.lang} />
              ))}
            </div>
          ))
        )}
      </div>

      <div className="sticky bottom-0 px-4 py-4 bg-[var(--material-thin)]/80 backdrop-blur-2xl border-t border-[var(--separator)] flex flex-col gap-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
        <Button
          className="w-full rounded-xl h-14 text-base font-semibold"
          size="lg"
          onClick={() => dispatch({ type: 'SET_SCREEN', payload: 'menu' })}
        >
          {t.order_more}
        </Button>
        {orders.length > 0 && (
          <Button
            variant="secondary"
            className="w-full rounded-xl h-12 text-sm font-medium"
            onClick={() => dispatch({ type: 'SET_SCREEN', payload: 'summary' })}
          >
            {t.request_bill}
          </Button>
        )}
      </div>
    </div>
  )
}

const OrderItemRow: FC<{ item: OrderItemDTO; lang: Lang }> = ({ item, lang }) => {
  const statusLabel = STATUS_LABELS[lang][item.status] ?? item.status
  const statusColor = STATUS_COLORS[item.status] ?? 'bg-tertiary/20 text-tertiary'
  const name = item.variant_name_snapshot
    ? `${item.name_snapshot} · ${item.variant_name_snapshot}`
    : item.name_snapshot

  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-primary truncate">{name}</p>
          <span className="text-xs text-tertiary whitespace-nowrap tabular-nums">x{item.quantity}</span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <Badge className={`rounded-full text-[10px] px-2 py-0 h-5 font-medium ${statusColor}`}>
            {statusLabel}
          </Badge>
          <span className="text-xs font-medium text-primary tabular-nums">
            {formatVND(item.total_amount_vnd)}
          </span>
        </div>
      </div>
    </div>
  )
}
