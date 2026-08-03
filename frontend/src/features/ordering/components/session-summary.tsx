import { type FC, useState } from 'react'
import { ChevronLeft, Phone, ShoppingBag } from 'lucide-react'
import { toast } from 'sonner'
import { useOrdering } from '../hooks/use-ordering'
import { DICT } from '@/i18n'
import { formatVND, formatTime } from '../helpers'
import { callWaiter, requestBill } from '../api'
import { useGuestOrders } from '../queries/useGuestOrders'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { GuestPayConfirmDialog } from './guest-pay-confirm-dialog'

export const SessionSummary: FC = () => {
  const { state, dispatch } = useOrdering()
  const t = DICT[state.lang]
  const deviceAccessToken = state.session?.accessToken

  const { data: ordersData, isLoading: isOrdersLoading } = useGuestOrders(deviceAccessToken)

  const orders = ordersData?.orders ?? []
  const sessionTotal = ordersData?.session_total_vnd ?? 0

  const [payConfirmOpen, setPayConfirmOpen] = useState(false)

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--surface-grouped)]">
      <header className="sticky top-0 z-[var(--z-sticky)] bg-[var(--material-thin)]/80 backdrop-blur-2xl border-b border-[var(--separator)] shadow-sm px-4 pt-5 pb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={t.back}
              onClick={() => dispatch({ type: 'SET_SCREEN', payload: 'menu' })}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surface-grouped)] text-[var(--text)] transition-colors hover:bg-[var(--separator)]/50 active:scale-95 shrink-0"
            >
              <ChevronLeft size={20} strokeWidth={2.5} />
            </button>
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-[var(--text)] tracking-tight">
                {t.session_summary}
              </h1>
              {state.session && (
                <p className="text-xs font-medium text-[var(--text-tertiary)] mt-0.5">
                  {t.table} {state.session.table} &middot; {t.session_started}{' '}
                  {formatTime(state.session.startedAt)}
                </p>
              )}
            </div>
          </div>
          <Badge className="rounded-full bg-[var(--surface-grouped)] text-[var(--text-secondary)] border-0 text-xs font-bold px-3 py-1 shrink-0">
            {orders.length} {t.orders_history.toLowerCase()}
          </Badge>
        </div>
      </header>

      <div className="flex-1 px-4 py-4 flex flex-col gap-4">
        {isOrdersLoading ? (
          <>
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-20 rounded-2xl" />
          </>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <ShoppingBag size={32} className="text-[var(--text-tertiary)]/50" />
            <p className="text-sm text-[var(--text-tertiary)]">{t.empty_cart}</p>
          </div>
        ) : (
          <>
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-2xl bg-[var(--material-regular)] border border-[var(--separator)] p-4 flex flex-col gap-3 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--text-tertiary)]">
                    {t.submitted_at} {formatTime(new Date(order.submitted_at))}
                  </span>
                </div>
                {order.items.map((item) => {
                  const name = item.variant_name_snapshot
                    ? `${item.name_snapshot} · ${item.variant_name_snapshot}`
                    : item.name_snapshot
                  return (
                    <div key={item.order_item_id} className="flex items-center justify-between">
                      <p className="text-sm text-[var(--text)] font-medium truncate min-w-0 flex-1">
                        {name}
                      </p>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className="text-xs text-[var(--text-tertiary)] tabular-nums">
                          x{item.quantity}
                        </span>
                        <span className="text-sm font-semibold text-[var(--text)] tabular-nums">
                          {formatVND(item.total_amount_vnd)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}

            <div className="rounded-2xl bg-[var(--material-regular)] border border-[var(--separator)] p-4 flex items-center justify-between shadow-sm">
              <span className="text-[var(--text)] font-semibold">{t.total}</span>
              <span className="text-lg font-bold text-[var(--system-orange)] tabular-nums">
                {formatVND(sessionTotal)}
              </span>
            </div>
          </>
        )}
      </div>

      <div className="sticky bottom-0 px-4 py-4 bg-[var(--material-thin)]/80 backdrop-blur-2xl border-t border-[var(--separator)] flex flex-col gap-3 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1 rounded-xl h-14 text-sm font-medium"
            onClick={async () => {
              if (!deviceAccessToken) return
              try {
                await callWaiter(deviceAccessToken)
                toast.success(t.toast_waiter)
                dispatch({ type: 'SET_SCREEN', payload: 'qr' })
              } catch {
                toast.error(t.toast_error || 'Yêu cầu thất bại, vui lòng thử lại')
              }
            }}
          >
            <Phone size={18} className="mr-1.5" />
            {t.call_waiter}
          </Button>
          <Button
            className="flex-1 rounded-xl h-14 text-base font-semibold"
            disabled={orders.length === 0}
            onClick={() => setPayConfirmOpen(true)}
          >
            {t.pay_now}
          </Button>
        </div>
        <Button
          variant="ghost"
          className="w-full rounded-xl h-12 text-sm font-medium text-system-blue"
          onClick={() => dispatch({ type: 'SET_SCREEN', payload: 'menu' })}
        >
          {t.order_more}
        </Button>
      </div>
      <GuestPayConfirmDialog
        open={payConfirmOpen}
        tableName={state.session?.table ? `${state.session.table}` : ''}
        t={t}
        onOpenChange={setPayConfirmOpen}
        onConfirm={async (wantsDigitalInvoice) => {
          if (!deviceAccessToken) throw new Error('missing device access token')
          await requestBill(deviceAccessToken)
          toast.success(t.toast_bill)
          dispatch({ type: 'SET_DIGITAL_INVOICE', payload: wantsDigitalInvoice })
          dispatch({ type: 'SET_SCREEN', payload: 'payment' })
        }}
      />
    </div>
  )
}
