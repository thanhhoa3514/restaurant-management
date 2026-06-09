/* eslint-disable react-refresh/only-export-components, react-doctor/only-export-components */
import { createFileRoute, redirect } from '@tanstack/react-router'

import CatalogManagement from '@/features/catalog/components/catalog-management'
import { hasStaffPermission, isStaffAuthenticated } from '@/lib/auth'

export const Route = createFileRoute('/admin/catalog')({
  beforeLoad: ({ location }) => {
    if (!isStaffAuthenticated()) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    if (!hasStaffPermission('catalog.manage')) throw redirect({ to: '/admin' })
  },
})

export const RouteComponent = () => <CatalogManagement />

Route.options.component = RouteComponent
