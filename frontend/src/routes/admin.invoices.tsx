/* eslint-disable react-refresh/only-export-components */
import { createFileRoute, redirect } from '@tanstack/react-router'

import { PaidInvoiceManagement } from '@/features/admin/invoices/paid-invoice-management'
import { hasStaffPermission, isStaffAuthenticated } from '@/lib/auth'

export const Route = createFileRoute('/admin/invoices')({
  beforeLoad: ({ location }) => {
    if (!isStaffAuthenticated()) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    if (!hasStaffPermission('billing.process')) throw redirect({ to: '/admin' })
  },
  component: PaidInvoiceManagement,
})
