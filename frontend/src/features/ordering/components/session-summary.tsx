import { type FC, useMemo, useState } from 'react'
import { useOrdering } from '../hooks/use-ordering'
import { DICT } from '../data/i18n'
import { getMenuItem } from '../data/menu'
import { formatVND, formatTime, summarizeOptions } from '../helpers'
import { Button } from '../../../components/ui/button'
import { Badge } from '../../../components/ui/badge'
import { GuestPayConfirmDialog } from './guest-pay-confirm-dialog'

export const SessionSummary: FC = () => {
  const { state, dispatch } = useOrdering()
  const t = DICT[state.lang]

  const { total, vat, grandTotal } = useMemo(() => {
    const subtotal = state.orders.reduce(
      (sum, order) =>
        sum + order.items.reduce((s, item) => s + item.unitPrice * item.qty, 0),
      0,
    )
    return {
      total: subtotal,
      vat: subtotal * 0.1,
      grandTotal: subtotal * 1.1,
    }
  }, [state.orders])

  const [payConfirmOpen, setPayConfirmOpen] = useState(false)
  const [simulatingPayment, setSimulatingPayment] = useState(false)

  const handleOrderMore = () => {
    dispatch({ type: 'SET_SCREEN', payload: 'menu' })
  }

  const handleCallWaiter = () => {
    dispatch({ type: 'SET_SCREEN', payload: 'qr' })
  }

  const handlePay = () => {
    setPayConfirmOpen(true)
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-sticky bg-background/80 backdrop-blur-xl border-b border-separator px-4 pt-4 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-primary">{t.session_summary}</h1>
            {state.session && (
              <p className="text-xs text-tertiary mt-0.5">
                {t.table} {state.session.table} &middot;{' '}
                {t.session_started} {formatTime(state.session.startedAt)}
              </p>
            )}
          </div>
          <Badge variant="secondary" className="rounded-full text-xs font-medium">
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
              {order.items.map((item, ii) => {
                const menuItem = getMenuItem(item.itemId)
                if (!menuItem) return null
                const name = state.lang === 'vi' ? menuItem.name.vi : menuItem.name.en
                const summary = summarizeOptions(item.itemId, item.selections, state.lang)
                return (
                  <div key={ii} className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-primary truncate">{name}</p>
                      {summary && (
                        <p className="text-[11px] text-tertiary truncate">{summary}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-3">
                      <span className="text-xs text-tertiary tabular-nums">x{item.qty}</span>
                      <span className="text-sm font-medium text-primary tabular-nums">
                        {formatVND(item.unitPrice * item.qty)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}

        {state.orders.length > 0 && (
          <div className="rounded-xl bg-elevated p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-tertiary">{t.subtotal}</span>
              <span className="text-primary font-medium tabular-nums">
                {formatVND(total)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-tertiary">{t.vat}</span>
              <span className="text-primary font-medium tabular-nums">
                {formatVND(vat)}
              </span>
            </div>
            <div className="border-t border-separator pt-2 flex items-center justify-between">
              <span className="text-primary font-semibold">{t.total}</span>
              <span className="text-lg font-semibold text-system-blue tabular-nums">
                {formatVND(grandTotal)}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 px-4 py-3 bg-background/80 backdrop-blur-xl border-t border-separator flex flex-col gap-2">
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="flex-1 rounded-xl h-14 text-sm font-medium"
            onClick={handleCallWaiter}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1.5">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
            </svg>
            {t.call_waiter}
          </Button>
          <Button
            className="flex-1 rounded-xl h-14 text-base font-semibold"
            onClick={handlePay}
          >
            {t.pay_now}
          </Button>
        </div>
        <Button
          variant="ghost"
          className="w-full rounded-xl h-12 text-sm font-medium text-system-blue"
          onClick={handleOrderMore}
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
          if (wantsDigitalInvoice) {
            setSimulatingPayment(true)
            setTimeout(() => {
              setSimulatingPayment(false)
              dispatch({ type: 'SET_SCREEN', payload: 'invoice' })
            }, 3000)
          } else {
            // Normal paper receipt flow, go back to landing
            dispatch({ type: 'SET_SCREEN', payload: 'qr' })
          }
        }}
      />

      {simulatingPayment && (
        <div className="fixed inset-0 z-[600] flex flex-col items-center justify-center bg-black/60 backdrop-blur-xl text-center text-white animate-in fade-in duration-300">
          <div className="flex flex-col items-center gap-4">
            <svg className="h-10 w-10 animate-spin text-system-blue" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
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
