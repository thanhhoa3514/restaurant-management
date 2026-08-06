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
import { setGuestDeviceAccessToken } from '@/lib/realtime-auth'

export function OrderPage() {
  // Guest UI is light-only: ignore system/staff dark mode while on this route.
  useEffect(() => {
    const root = document.documentElement
    const wasDark = root.classList.contains('dark')
    root.classList.remove('dark')
    return () => {
      if (wasDark) root.classList.add('dark')
    }
  }, [])

  return (
    <OrderingProvider>
      <OrderFlow />
    </OrderingProvider>
  )
}

function OrderFlow() {
  const { state, dispatch } = useOrdering()
  const { t: qrToken } = useSearch({ from: '/order' })
  const { data: checkout } = useGuestPayment(state.session?.accessToken, true)

  const [persisted] = useState(() => loadSession())
  useEffect(() => {
    if (persisted && !state.session) {
      setGuestDeviceAccessToken(persisted.accessToken)
      dispatch({ type: 'SET_SESSION', payload: persisted })
      dispatch({ type: 'SET_SCREEN', payload: 'menu' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (state.session?.accessToken && state.session.status !== 'PENDING_VERIFICATION') {
      saveSession(state.session)
    }
  }, [state.session])

  useEffect(() => {
    const invoices = checkout?.invoices ?? []
    const allPaid = invoices.length > 0 && invoices.every((invoice) => invoice.status === 'PAID')
    if (allPaid) {
      if (state.wantsDigitalInvoice && state.screen !== 'invoice' && state.screen !== 'qr') {
        dispatch({ type: 'SET_SCREEN', payload: 'invoice' })
      }
      return
    }

    if (checkout?.session_status === 'CLOSED') {
      clearSession()
      setGuestDeviceAccessToken('')
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
