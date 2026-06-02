import { type FC } from 'react'
import { useOrdering } from '../hooks/use-ordering'
import { DICT } from '../data/i18n'
import { getMenuItem } from '../data/menu'
import { formatVND, formatTime } from '../helpers'
import type { Lang, ItemStatus } from '../types'
import { Button } from '../../../components/ui/button'
import { Badge } from '../../../components/ui/badge'

export const OrderStatusScreen: FC = () => {
  const { state, dispatch } = useOrdering()
  const t = DICT[state.lang]
  const lastOrder = state.orders[state.orders.length - 1]

  const handleOrderMore = () => {
    dispatch({ type: 'SET_SCREEN', payload: 'menu' })
  }

  const handleGoSummary = () => {
    dispatch({ type: 'SET_SCREEN', payload: 'summary' })
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-sticky bg-background/80 backdrop-blur-xl border-b border-separator px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-primary">{t.your_order}</h1>
            {lastOrder && (
              <p className="text-xs text-tertiary mt-0.5">
                {t.submitted_at} {formatTime(lastOrder.placedAt)}
              </p>
            )}
          </div>
          <Badge className="rounded-full bg-system-green/15 text-system-green text-xs font-medium">
            {state.orders.length} {t.orders_history.toLowerCase()}
          </Badge>
        </div>
      </header>

      <div className="flex-1 px-4 py-4 flex flex-col gap-4">
        {state.orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-quaternary">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0" />
            </svg>
            <p className="text-sm text-tertiary">{t.empty_cart}</p>
          </div>
        ) : (
          state.orders.toReversed().map((order, oi) => (
            <div key={oi} className="rounded-xl bg-elevated p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-tertiary">
                  {t.submitted_at} {formatTime(order.placedAt)}
                </span>
                <span className="text-xs text-tertiary">
                  #{state.orders.length - oi}
                </span>
              </div>
              {order.items.map((item, ii) => (
                <OrderItemRow key={ii} itemId={item.itemId} status={item.status} qty={item.qty} unitPrice={item.unitPrice} lang={state.lang} />
              ))}
            </div>
          ))
        )}
      </div>

      <div className="sticky bottom-0 px-4 py-3 bg-background/80 backdrop-blur-xl border-t border-separator flex flex-col gap-2">
        <Button
          className="w-full rounded-xl h-14 text-base font-semibold"
          size="lg"
          onClick={handleOrderMore}
        >
          {t.order_more}
        </Button>
        {state.orders.length > 0 && (
          <Button
            variant="secondary"
            className="w-full rounded-xl h-12 text-sm font-medium"
            onClick={handleGoSummary}
          >
            {t.request_bill}
          </Button>
        )}
      </div>
    </div>
  )
}

interface OrderItemRowProps {
  itemId: string
  status: ItemStatus
  qty: number
  unitPrice: number
  lang: Lang
}

const STATUS_LABELS: Record<Lang, Record<ItemStatus, string>> = {
  vi: { pending: 'Chờ xác nhận', preparing: 'Đang chuẩn bị', ready: 'Sẵn sàng', served: 'Đã phục vụ' },
  en: { pending: 'Pending', preparing: 'Preparing', ready: 'Ready', served: 'Served' },
}

const STATUS_COLORS: Record<ItemStatus, string> = {
  pending: 'bg-system-orange/15 text-system-orange',
  preparing: 'bg-system-blue/15 text-system-blue',
  ready: 'bg-system-green/15 text-system-green',
  served: 'bg-tertiary/20 text-tertiary',
}

const OrderItemRow: FC<OrderItemRowProps> = ({ itemId, status, qty, unitPrice, lang }) => {
  const item = getMenuItem(itemId)
  if (!item) return null
  const name = lang === 'vi' ? item.name.vi : item.name.en
  const statusLabel = STATUS_LABELS[lang][status]
  const statusColor = STATUS_COLORS[status]

  return (
    <div className="flex items-center gap-3">
      <div className="size-10 rounded-lg bg-surface-grouped overflow-hidden shrink-0">
        <img src={item.image} alt={name} className="size-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-primary truncate">{name}</p>
          <span className="text-xs text-tertiary whitespace-nowrap tabular-nums">
            x{qty}
          </span>
        </div>
        <div className="flex items-center justify-between mt-0.5">
          <Badge className={`rounded-full text-[10px] px-2 py-0 h-5 font-medium ${statusColor}`}>
            {statusLabel}
          </Badge>
          <span className="text-xs font-medium text-primary tabular-nums">
            {formatVND(unitPrice * qty)}
          </span>
        </div>
      </div>
    </div>
  )
}
