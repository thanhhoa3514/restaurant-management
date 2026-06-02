import { createFileRoute, redirect } from '@tanstack/react-router'
import { CashierLayout } from '@/features/cashier/components/cashier-layout'
import { isStaffAuthenticated } from '@/lib/auth'

export const Route = createFileRoute('/cashier')({
  beforeLoad: ({ location }) => {
    if (!isStaffAuthenticated('cashier')) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }
  },
  component: CashierLayout,
})
