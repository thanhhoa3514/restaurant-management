import { useEffect, useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import { OrderingProvider, useOrdering } from '@/features/ordering/hooks/use-ordering'
import { loadSession, saveSession, clearSession } from '@/features/ordering/session-store'
import { QRLanding } from '@/features/ordering/components/qr-landing'
import { MenuScreen } from '@/features/ordering/components/menu-screen'
import { OrderStatusScreen } from '@/features/ordering/components/order-status-screen'
import { SessionSummary } from '@/features/ordering/components/session-summary'
import { GuestInvoiceScreen } from '@/features/ordering/components/guest-invoice-screen'
import { GuestPaymentScreen } from '@/features/ordering/components/guest-payment-screen'
import { useGuestPayment } from '@/features/ordering/queries/useGuestPayment'
import { setGuestRealtimeToken } from '@/lib/realtime-auth'

export function OrderPage() {
  return (
    <OrderingProvider>
      <OrderFlow />
    </OrderingProvider>
  )
}

function OrderFlow() {
  const { state, dispatch } = useOrdering()
  const { t: qrToken } = useSearch({ from: '/order' })
  // Realtime makes this immediate; polling is the fallback when a guest's
  // websocket drops, so payment/cashier cancellation still ends the UI.
  const { data: checkout } = useGuestPayment(state.session?.token, true)

  // Restore a persisted session from *localStorage* (not the URL) on mount, so a
  // refresh survives without ever putting the bearer token in a shareable link.
  // Read synchronously so the menu doesn't flash the QR landing first.
  const [persisted] = useState(() => loadSession())
  useEffect(() => {
    if (persisted && !state.session) {
      setGuestRealtimeToken(persisted.token)
      dispatch({ type: 'SET_SESSION', payload: persisted })
      dispatch({ type: 'SET_SCREEN', payload: 'menu' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist the live session to localStorage so a refresh can restore it. Never
  // persist a device still PENDING_VERIFICATION here: its token can't order yet,
  // and restore forces the menu screen. The narrower device-resume store keeps
  // that token instead, so qr-landing can prove ownership and resume waiting.
  useEffect(() => {
    if (state.session?.token && state.session.status !== 'PENDING_VERIFICATION') {
      saveSession(state.session)
    }
  }, [state.session])

  useEffect(() => {
    const invoices = checkout?.invoices ?? []
    const allPaid = invoices.length > 0 && invoices.every((invoice) => invoice.status === 'PAID')
    if (allPaid) {
      // Session is finished — drop the persisted token so a later refresh starts
      // clean instead of restoring a dead session. The in-memory session (and its
      // token, still needed for the invoice PDF) is untouched.
      clearSession()
      if (state.wantsDigitalInvoice && state.screen !== 'invoice' && state.screen !== 'qr') {
        dispatch({ type: 'SET_SCREEN', payload: 'invoice' })
      }
      return
    }

    if (checkout?.session_status === 'CLOSED') {
      clearSession()
      setGuestRealtimeToken('')
      if (state.session) dispatch({ type: 'END_SESSION' })
      return
    }

    if (checkout?.session_status === 'ACTIVE') {
      if (state.screen === 'payment') {
        dispatch({ type: 'SET_SCREEN', payload: 'order' })
      }
      return
    }

    if (
      checkout?.session_status === 'AWAITING_PAYMENT' &&
      state.screen !== 'payment' &&
      state.screen !== 'invoice'
    ) {
      dispatch({ type: 'SET_SCREEN', payload: 'payment' })
    }
  }, [checkout, dispatch, state.screen, state.session, state.wantsDigitalInvoice])

  // A persisted session is being restored — hold a spinner instead of flashing
  // the QR landing / table picker before the restore effect runs.
  if (persisted && !state.session) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--bg)]">
        <div className="size-8 animate-spin rounded-full border-4 border-[var(--separator)] border-t-[var(--system-blue)]" />
      </div>
    )
  }

  switch (state.screen) {
    case 'qr':
      return <QRLanding qrToken={qrToken} />
    case 'menu':
      return <MenuScreen />
    case 'order':
      return <OrderStatusScreen />
    case 'summary':
      return <SessionSummary />
    case 'payment':
      return <GuestPaymentScreen />
    case 'invoice':
      return <GuestInvoiceScreen />
    default:
      return <QRLanding qrToken={qrToken} />
  }
}
