/* eslint-disable react-refresh/only-export-components, react-doctor/only-export-components */
import { createFileRoute, redirect } from '@tanstack/react-router'
import { SessionHistoryManagement } from '@/features/admin/components/session-history-management'
import { hasStaffPermission, isStaffAuthenticated } from '@/lib/auth'

export const Route = createFileRoute('/admin/sessions')({
  beforeLoad: ({ location }) => {
    if (!isStaffAuthenticated()) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    if (!hasStaffPermission('dining.manage')) throw redirect({ to: '/admin' })
  },
  component: SessionHistoryManagement,
})
