import { createFileRoute, redirect } from '@tanstack/react-router'
import { isStaffAuthenticated } from '@/lib/auth'

export const Route = createFileRoute('/kitchen')({
  beforeLoad: () => {
    if (!isStaffAuthenticated()) {
      throw redirect({
        to: '/login',
      })
    }
    throw redirect({ to: '/admin', search: { view: 'kitchen' } })
  },
})
