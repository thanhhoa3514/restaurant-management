/* eslint-disable react-refresh/only-export-components, react-doctor/only-export-components */
import { createFileRoute, redirect } from '@tanstack/react-router'

import { StaffManagement } from '@/features/admin/components/staff-management'
import { hasStaffPermission, isStaffAuthenticated } from '@/lib/auth'

export const Route = createFileRoute('/admin/staff')({
  beforeLoad: ({ location }) => {
    if (!isStaffAuthenticated()) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    if (!hasStaffPermission('identity.manage')) throw redirect({ to: '/admin' })
  },
})

export const RouteComponent = () => {
  return <StaffManagement />
}

Route.options.component = RouteComponent
