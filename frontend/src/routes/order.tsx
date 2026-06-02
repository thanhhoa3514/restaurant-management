import { createFileRoute } from '@tanstack/react-router'
import { OrderingProvider, useOrdering } from '../features/ordering/hooks/use-ordering'
import { QRLanding } from '../features/ordering/components/qr-landing'
import { MenuScreen } from '../features/ordering/components/menu-screen'
import { OrderStatusScreen } from '../features/ordering/components/order-status-screen'
import { SessionSummary } from '../features/ordering/components/session-summary'
import { GuestInvoiceScreen } from '../features/ordering/components/guest-invoice-screen'

export const Route = createFileRoute('/order')({
  component: OrderRoute,
})

function OrderRoute() {
  return (
    <OrderingProvider>
      <OrderFlow />
    </OrderingProvider>
  )
}

function OrderFlow() {
  const { state } = useOrdering()

  switch (state.screen) {
    case 'qr':
      return <QRLanding />
    case 'menu':
      return <MenuScreen />
    case 'order':
      return <OrderStatusScreen />
    case 'summary':
      return <SessionSummary />
    case 'invoice':
      return <GuestInvoiceScreen />
    default:
      return <QRLanding />
  }
}
