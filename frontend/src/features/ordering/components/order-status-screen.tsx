import { type FC, useMemo, useState } from 'react'
import {
  ChevronLeft,
  Plus,
  Pencil,
  ShoppingBag,
  UtensilsCrossed,
  RefreshCw,
  Receipt,
  Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { useOrdering } from '../hooks/use-ordering'
import { useRequestBill } from '../mutations/useRequestBill'
import { DICT } from '@/i18n'
import { formatTime } from '../helpers'
import type { Lang, OrderItemDTO, GuestOrderDTO } from '../types'
import { useGuestOrders } from '../queries/useGuestOrders'
import { useGuestItems } from '../queries/useGuestItems'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { OrderItemEditSheet } from './order-item-edit-sheet'

const STATUS_COLORS: Record<string, string> = {
  PLACED: 'bg-system-orange/15 text-system-orange',
  PENDING: 'bg-system-orange/15 text-system-orange',
  CONFIRMED: 'bg-system-blue/15 text-system-blue',
  PREPARING: 'bg-system-blue/15 text-system-blue',
  READY: 'bg-system-green/15 text-system-green',
  SERVED: 'bg-tertiary/20 text-tertiary',
  CANCELLED: 'bg-system-red/15 text-system-red',
  UNAVAILABLE: 'bg-system-red/15 text-system-red',
}

export const OrderStatusScreen: FC = () => {
  const { state, dispatch } = useOrdering()
  const t = DICT[state.lang]
  const sessionToken = state.session?.token

  const requestBill = useRequestBill()

  const { data: ordersData, isLoading: isOrdersLoading } = useGuestOrders(sessionToken)

  const { data: menuItems } = useGuestItems(sessionToken)

  const imageByItemId = useMemo(() => {
    const map: Record<string, string> = {}
    for (const m of menuItems ?? []) if (m.image_url) map[m.id] = m.image_url
    return map
  }, [menuItems])

  const orders = ordersData?.orders ?? []

  const [editTarget, setEditTarget] = useState<{
    order: GuestOrderDTO
    item: OrderItemDTO
  } | null>(null)

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--surface-grouped)]">
      <header className="sticky top-0 z-[var(--z-sticky)] bg-[var(--material-thin)]/80 backdrop-blur-2xl border-b border-[var(--separator)] shadow-sm">
        <div className="mx-auto w-full max-w-lg px-4 pt-5 pb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={t.back}
              onClick={() => dispatch({ type: 'SET_SCREEN', payload: 'menu' })}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-grouped)] text-[var(--text)] transition-colors hover:bg-[var(--separator)]/50 active:scale-95 shrink-0"
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
            <h1 className="text-xl font-bold text-[var(--text)] tracking-tight">{t.your_order}</h1>
          </div>
          <Badge className="rounded-full bg-[var(--system-green)]/15 text-[var(--system-green)] text-xs font-bold px-3 py-1 border-0 shrink-0">
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
                </div>
                <div className="flex flex-col divide-y divide-[var(--separator)]/50">
                  {order.items.map((item) => (
                    <OrderItemRow
                      key={item.order_item_id}
                      item={item}
                      lang={state.lang}
                      imageUrl={imageByItemId[item.menu_item_id]}
                      onEdit={
                        item.status === 'PLACED' ? () => setEditTarget({ order, item }) : undefined
                      }
                      onChooseOther={
                        item.status === 'UNAVAILABLE'
                          ? () => dispatch({ type: 'SET_SCREEN', payload: 'menu' })
                          : undefined
                      }
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>

      {editTarget && (
        <OrderItemEditSheet
          item={editTarget.item}
          allItems={editTarget.order.items}
          orderId={editTarget.order.id}
          orderVersion={editTarget.order.version}
          open
          lang={state.lang}
          onClose={() => setEditTarget(null)}
        />
      )}

      <div className="sticky bottom-0 bg-[var(--material-thin)]/80 backdrop-blur-2xl border-t border-[var(--separator)] shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
        <div className="mx-auto w-full max-w-lg px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] flex gap-3">
          <Button
            size="lg"
            variant="outline"
            className="flex-1 rounded-2xl h-14 text-[14px] sm:text-base font-bold bg-[var(--surface-grouped)] text-[var(--text)] border-transparent hover:bg-[var(--separator)]/50 shadow-sm"
            onClick={() => dispatch({ type: 'SET_SCREEN', payload: 'menu' })}
          >
            <Plus size={18} className="mr-1.5 text-[var(--text-secondary)]" strokeWidth={2.5} />
            {t.order_more}
          </Button>
          <Button
            size="lg"
            disabled={requestBill.isPending}
            className="flex-1 rounded-2xl h-14 text-[14px] sm:text-base font-bold bg-[var(--text)] text-[var(--bg)] hover:opacity-90 transition-all shadow-md active:scale-[0.98] border-0"
            onClick={() => {
              if (
                window.confirm(
                  state.lang === 'vi'
                    ? 'Bạn có chắc chắn muốn yêu cầu thanh toán không? Bàn sẽ được khóa để tính tiền.'
                    : 'Are you sure you want to request the bill? The table will be locked.',
                )
              ) {
                if (!sessionToken) return
                requestBill.mutate(sessionToken, {
                  onSuccess: () => {
                    toast.success(
                      state.lang === 'vi' ? 'Đã gửi yêu cầu thanh toán.' : 'Checkout request sent.',
                    )
                    dispatch({ type: 'SET_SCREEN', payload: 'invoice' })
                  },
                  onError: () => {
                    toast.error(
                      state.lang === 'vi'
                        ? 'Có lỗi xảy ra, vui lòng thử lại!'
                        : 'Error occurred, please try again!',
                    )
                  },
                })
              }
            }}
          >
            {requestBill.isPending ? (
              <Loader2 size={18} className="mr-1.5 animate-spin" />
            ) : (
              <Receipt size={18} className="mr-1.5" strokeWidth={2.5} />
            )}
            {state.lang === 'vi' ? 'Thanh toán' : 'Checkout'}
          </Button>
        </div>
      </div>
    </div>
  )
}

const OrderItemRow: FC<{
  item: OrderItemDTO
  lang: Lang
  imageUrl?: string
  onEdit?: () => void
  onChooseOther?: () => void
}> = ({ item, lang, imageUrl, onEdit, onChooseOther }) => {
  const t = DICT[lang]
  const labelKey = `status_${item.status.toLowerCase()}` as keyof typeof t
  const statusLabel = t[labelKey] ?? item.status
  const statusColor = STATUS_COLORS[item.status] ?? 'bg-tertiary/20 text-tertiary'
  const name = item.variant_name_snapshot
    ? `${item.name_snapshot} · ${item.variant_name_snapshot}`
    : item.name_snapshot

  const isUnavailable = item.status === 'UNAVAILABLE'

  const content = (
    <>
      <div
        className={`relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-[var(--surface-grouped)] ${isUnavailable ? 'opacity-50' : ''}`}
      >
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
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium text-primary truncate ${isUnavailable ? 'line-through opacity-50' : ''}`}
        >
          {name}
        </p>
        {isUnavailable && item.unavailable_reason && (
          <p className="text-xs text-system-red mt-0.5">{item.unavailable_reason}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {isUnavailable && onChooseOther && (
          <button
            type="button"
            className="flex items-center gap-1 rounded-full bg-[var(--system-red)]/10 text-system-red text-xs font-semibold px-2.5 py-1 transition-colors hover:bg-[var(--system-red)]/20 active:scale-95"
            onClick={(e) => {
              e.stopPropagation()
              onChooseOther()
            }}
          >
            <RefreshCw size={12} strokeWidth={2.5} />
            <span>{t.choose_other_dish}</span>
          </button>
        )}
        {onEdit && !isUnavailable && (
          <div className="flex size-7 items-center justify-center rounded-full bg-[var(--surface-grouped)] text-[var(--text-tertiary)] group-hover:bg-[var(--system-blue)]/10 group-hover:text-[var(--system-blue)] transition-colors">
            <Pencil size={13} strokeWidth={2.5} />
          </div>
        )}
        <Badge
          className={`rounded-full text-[11px] px-2.5 py-0.5 font-semibold border-0 ${statusColor}`}
        >
          {statusLabel}
        </Badge>
      </div>
    </>
  )

  if (isUnavailable) {
    return (
      <div className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0">
        <div className="flex items-center gap-3">{content}</div>
      </div>
    )
  }

  if (onEdit) {
    return (
      <button
        type="button"
        className="group flex items-center gap-3 py-2.5 first:pt-0 last:pb-0 w-full text-left cursor-pointer active:scale-[0.99] transition-transform"
        onClick={onEdit}
      >
        {content}
      </button>
    )
  }

  return <div className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">{content}</div>
}
