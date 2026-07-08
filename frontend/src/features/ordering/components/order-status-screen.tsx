import { type FC, useMemo } from 'react'
import { Plus, ShoppingBag, UtensilsCrossed } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useOrdering } from '../hooks/use-ordering'
import { DICT } from '../data/i18n'
import { formatTime } from '../helpers'
import { fetchGuestOrders, fetchMenuItems, type OrderItemDTO } from '../api'
import type { Lang } from '../types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

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

  const { data: menuItems } = useQuery({
    queryKey: ['guest-items', sessionToken],
    queryFn: () => fetchMenuItems(sessionToken!),
    enabled: !!sessionToken,
  })

  const imageByItemId = useMemo(() => {
    const map: Record<string, string> = {}
    for (const m of menuItems ?? []) if (m.image_url) map[m.id] = m.image_url
    return map
  }, [menuItems])

  const orders = ordersData?.orders ?? []

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--surface-grouped)]">
      <header className="sticky top-0 z-[var(--z-sticky)] bg-[var(--material-thin)]/80 backdrop-blur-2xl border-b border-[var(--separator)] shadow-sm">
        <div className="mx-auto w-full max-w-lg px-4 pt-5 pb-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-[var(--text)] tracking-tight">{t.your_order}</h1>
          <Badge className="rounded-full bg-[var(--system-green)]/15 text-[var(--system-green)] text-xs font-bold px-3 py-1 border-0">
            {orders.length} {t.orders_history.toLowerCase()}
          </Badge>
        </div>
      </header>

      <div className="flex-1 w-full">
        <div className="mx-auto w-full max-w-lg px-4 py-4 flex flex-col gap-4">
          {isOrdersLoading ? (
            <>
              <Skeleton className="h-24 rounded-2xl" />
              <Skeleton className="h-24 rounded-2xl" />
            </>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--surface-grouped)]">
                <ShoppingBag size={30} className="text-quaternary" />
              </div>
              <p className="text-sm text-tertiary">{t.empty_cart}</p>
            </div>
          ) : (
            orders.map((order) => (
              <section
                key={order.id}
                className="rounded-2xl bg-elevated p-4 flex flex-col gap-3 shadow-sm border border-[var(--separator)]/60"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-tertiary">
                    {t.submitted_at} {formatTime(new Date(order.submitted_at))}
                  </span>
                  <span className="text-xs font-semibold text-tertiary tabular-nums">
                    #{order.order_number}
                  </span>
                </div>
                <div className="flex flex-col divide-y divide-[var(--separator)]/50">
                  {order.items.map((item) => (
                    <OrderItemRow
                      key={item.order_item_id}
                      item={item}
                      lang={state.lang}
                      imageUrl={imageByItemId[item.menu_item_id]}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>

      <div className="sticky bottom-0 bg-[var(--material-thin)]/80 backdrop-blur-2xl border-t border-[var(--separator)] shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
        <div className="mx-auto w-full max-w-lg px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button
            size="lg"
            className="w-full rounded-2xl h-14 text-base font-semibold text-white shadow-lg shadow-[var(--system-orange)]/25 bg-gradient-to-r from-[var(--system-orange)] to-[var(--system-red)] hover:opacity-90"
            onClick={() => dispatch({ type: 'SET_SCREEN', payload: 'menu' })}
          >
            <Plus size={20} className="mr-1.5" strokeWidth={2.5} />
            {t.order_more}
          </Button>
        </div>
      </div>
    </div>
  )
}

const OrderItemRow: FC<{ item: OrderItemDTO; lang: Lang; imageUrl?: string }> = ({
  item,
  lang,
  imageUrl,
}) => {
  const t = DICT[lang]
  const labelKey = `status_${item.status.toLowerCase()}` as keyof typeof t
  const statusLabel = t[labelKey] ?? item.status
  const statusColor = STATUS_COLORS[item.status] ?? 'bg-tertiary/20 text-tertiary'
  const name = item.variant_name_snapshot
    ? `${item.name_snapshot} · ${item.variant_name_snapshot}`
    : item.name_snapshot

  return (
    <div className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[var(--surface-grouped)]">
        {imageUrl ? (
          <img src={imageUrl} alt={name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <UtensilsCrossed size={18} className="text-quaternary" />
          </div>
        )}
        <span className="absolute -bottom-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--text)] px-1 text-[10px] font-bold text-[var(--bg-elevated)] tabular-nums ring-2 ring-[var(--bg-elevated)]">
          {item.quantity}
        </span>
      </div>
      <p className="flex-1 min-w-0 text-sm font-medium text-primary truncate">{name}</p>
      <Badge
        className={`rounded-full text-[11px] px-2.5 py-0.5 font-semibold border-0 ${statusColor}`}
      >
        {statusLabel}
      </Badge>
    </div>
  )
}
