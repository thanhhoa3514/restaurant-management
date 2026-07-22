import { useEffect } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { OrderingProvider, useOrdering } from '@/features/ordering/hooks/use-ordering'
import { QRLanding } from '@/features/ordering/components/qr-landing'
import { MenuScreen } from '@/features/ordering/components/menu-screen'
import { OrderStatusScreen } from '@/features/ordering/components/order-status-screen'
import { SessionSummary } from '@/features/ordering/components/session-summary'
import { GuestInvoiceScreen } from '@/features/ordering/components/guest-invoice-screen'

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
  const { t: qrToken, s: sessionTokenParam, table: tableParam, tableId: tableIdParam } = useSearch({ from: '/order' })

  // Restore session from URL params on mount (page refresh / deep link)
  useEffect(() => {
    if (sessionTokenParam && !state.session) {
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
    case 'invoice':
      return <GuestInvoiceScreen />
    default:
      return <QRLanding qrToken={qrToken} />
  }
}
