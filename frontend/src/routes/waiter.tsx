import { createFileRoute, redirect } from '@tanstack/react-router'
import { WaiterLayout } from '@/features/waiter/components/waiter-layout'
import { isStaffAuthenticated } from '@/lib/auth'

export const Route = createFileRoute('/waiter')({
  beforeLoad: ({ location }) => {
    if (!isStaffAuthenticated('waiter')) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }
  },
  component: WaiterLayout,
})
