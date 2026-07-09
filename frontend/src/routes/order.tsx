import { createFileRoute } from '@tanstack/react-router'
import { OrderPage } from '@/features/ordering/components/order-page'

export const Route = createFileRoute('/order')({
  validateSearch: (search: Record<string, unknown>) => ({
    t: typeof search.t === 'string' ? search.t : undefined,
    s: typeof search.s === 'string' ? search.s : undefined,
    table: typeof search.table === 'string' ? search.table : undefined,
    tableId: typeof search.tableId === 'string' ? search.tableId : undefined,
  }),
  component: OrderPage,
})
