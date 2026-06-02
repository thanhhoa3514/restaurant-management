import { createFileRoute, redirect } from '@tanstack/react-router'
import { KdsLayout } from '@/features/kitchen/components/kds-layout'
import { isStaffAuthenticated } from '@/lib/auth'

export const Route = createFileRoute('/kitchen')({
  beforeLoad: ({ location }) => {
    if (!isStaffAuthenticated('kitchen')) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }
  },
  component: KdsLayout,
})
