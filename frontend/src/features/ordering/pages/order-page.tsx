import { useEffect } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { OrderingProvider, useOrdering } from '@/features/ordering/hooks/use-ordering'
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
  const navigate = useNavigate()
  const {
    t: qrToken,
    s: sessionTokenParam,
    table: tableParam,
    tableId: tableIdParam,
  } = useSearch({ from: '/order' })
  const { data: checkout } = useGuestPayment(state.session?.token)

  // Restore session from URL params on mount (page refresh / deep link)
  useEffect(() => {
    if (sessionTokenParam && !state.session) {
      setGuestRealtimeToken(sessionTokenParam)
      dispatch({
        type: 'SET_SESSION',
        payload: {
          token: sessionTokenParam,
          table: tableParam || '',
          startedAt: new Date(),
          sessionId: sessionTokenParam,
          tableId: tableIdParam,
        },
      })
      dispatch({ type: 'SET_SCREEN', payload: 'menu' })
    }
  }, [])

  // Sync session to URL so F5 / deep-link works
  useEffect(() => {
    if (state.session?.token && state.session.token !== sessionTokenParam) {
      navigate({
        to: '/order',
        search: {
          t: undefined,
          s: state.session.token,
          table: state.session.table,
          tableId: state.session.tableId,
        },
        replace: true,
      })
    }
  }, [state.session, navigate, sessionTokenParam])

  useEffect(() => {
    const invoices = checkout?.invoices ?? []
    const allPaid = invoices.length > 0 && invoices.every((invoice) => invoice.status === 'PAID')
    if (allPaid) {
      if (state.wantsDigitalInvoice && state.screen !== 'invoice' && state.screen !== 'qr') {
        dispatch({ type: 'SET_SCREEN', payload: 'invoice' })
      }
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
  }, [checkout, dispatch, state.screen, state.wantsDigitalInvoice])

  // If we have a session token in the URL but the session hasn't been restored yet,
  // we shouldn't render the QR landing page to avoid flashing the TablePicker.
  if (sessionTokenParam && !state.session) {
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
