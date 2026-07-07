import { createFileRoute } from '@tanstack/react-router'
import { OrderPage } from '@/features/ordering/components/order-page'

export const Route = createFileRoute('/order')({
  validateSearch: (search: Record<string, unknown>) => ({
    t: typeof search.t === 'string' ? search.t : undefined,
  }),
  component: OrderPage,
})
