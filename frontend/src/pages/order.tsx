import { useSearch } from '@tanstack/react-router'
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
  const { state } = useOrdering()
  const { t: qrToken } = useSearch({ from: '/order' })

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
