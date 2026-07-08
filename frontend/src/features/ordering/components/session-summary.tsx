import { type FC, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Phone, ShoppingBag } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useOrdering } from '../hooks/use-ordering'
import { DICT } from '../data/i18n'
import { formatVND, formatTime } from '../helpers'
import { fetchGuestOrders } from '../api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { GuestPayConfirmDialog } from './guest-pay-confirm-dialog'

export const SessionSummary: FC = () => {
  const { state, dispatch } = useOrdering()
  const t = DICT[state.lang]
  const sessionToken = state.session?.token

  const { data: ordersData, isLoading: isOrdersLoading } = useQuery({
    queryKey: ['guest-orders', sessionToken],
    queryFn: () => fetchGuestOrders(sessionToken!),
    enabled: !!sessionToken,
  })

  const orders = ordersData?.orders ?? []
  const sessionTotal = ordersData?.session_total_vnd ?? 0

  const [payConfirmOpen, setPayConfirmOpen] = useState(false)
  const [simulatingPayment, setSimulatingPayment] = useState(false)

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-[var(--z-sticky)] bg-[var(--material-thin)]/80 backdrop-blur-2xl border-b border-[var(--separator)] shadow-sm px-4 pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-[var(--text)] tracking-tight flex items-center gap-2">
              {t.session_summary}
            </h1>
            {state.session && (
              <p className="text-xs font-medium text-[var(--text-tertiary)] mt-1">
                {t.table} {state.session.table} &middot;{' '}
                {t.session_started} {formatTime(state.session.startedAt)}
              </p>
            )}
          </div>
          <Badge className="rounded-full bg-[var(--surface-grouped)] text-[var(--text-secondary)] border-0 text-xs font-bold px-3 py-1">
            {orders.length} {t.orders_history.toLowerCase()}
          </Badge>
        </div>
      </header>

      <div className="flex-1 px-4 py-4 flex flex-col gap-4">
        {isOrdersLoading ? (
          <>
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-20 rounded-xl" />
          </>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <ShoppingBag size={32} className="text-quaternary" />
            <p className="text-sm text-tertiary">{t.empty_cart}</p>
          </div>
        ) : (
          <>
            {orders.map((order) => (
              <div key={order.id} className="rounded-xl bg-elevated p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-tertiary">
                    {t.submitted_at} {formatTime(new Date(order.submitted_at))}
                  </span>
                  <span className="text-xs text-tertiary">#{order.order_number}</span>
                </div>
                {order.items.map((item) => {
                  const name = item.variant_name_snapshot
                    ? `${item.name_snapshot} · ${item.variant_name_snapshot}`
                    : item.name_snapshot
                  return (
                    <div key={item.order_item_id} className="flex items-center justify-between">
                      <p className="text-sm text-primary truncate min-w-0 flex-1">{name}</p>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className="text-xs text-tertiary tabular-nums">x{item.quantity}</span>
                        <span className="text-sm font-medium text-primary tabular-nums">
                          {formatVND(item.total_amount_vnd)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}

            <div className="rounded-xl bg-elevated p-4 flex items-center justify-between">
              <span className="text-primary font-semibold">{t.total}</span>
              <span className="text-lg font-semibold text-system-blue tabular-nums">
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
            onClick={() => {
              toast.success(t.toast_waiter)
              dispatch({ type: 'SET_SCREEN', payload: 'qr' })
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
        onConfirm={(wantsDigitalInvoice) => {
          toast.success(t.toast_bill)
          if (wantsDigitalInvoice) {
            setSimulatingPayment(true)
            setTimeout(() => {
              setSimulatingPayment(false)
              dispatch({ type: 'SET_SCREEN', payload: 'invoice' })
            }, 3000)
          } else {
            dispatch({ type: 'SET_SCREEN', payload: 'qr' })
          }
        }}
      />

      {simulatingPayment && (
        <div className="fixed inset-0 z-[600] flex flex-col items-center justify-center bg-black/60 backdrop-blur-xl text-center text-white animate-in fade-in duration-300">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="animate-spin h-10 w-10 text-system-blue" />
            <div className="font-bold text-lg">{state.lang === 'vi' ? 'Đang xử lý thanh toán...' : 'Processing payment...'}</div>
            <p className="text-sm text-zinc-300 max-w-xs px-6 leading-relaxed">
              {state.lang === 'vi'
                ? 'Hóa đơn điện tử đang được tạo và gửi trực tiếp đến thiết bị của bạn'
                : 'E-invoice is being generated and pushed to your device'}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
