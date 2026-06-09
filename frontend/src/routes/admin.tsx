/* eslint-disable react-refresh/only-export-components, react-doctor/only-export-components */
import { createFileRoute, redirect, Outlet, useLocation } from '@tanstack/react-router'
import { z } from 'zod'
import {
  Loader2,
} from 'lucide-react'

import { Suspense, lazy } from 'react'

import { AdminShell, ShellProvider } from '@/components/admin-shell'
import { isStaffAuthenticated, getStaffSession } from '@/lib/auth'
import { usePermissions } from '@/lib/permission-context'
import type { StaffView } from '@/components/admin-config'

const AdminDashboard = lazy(() => import('@/features/admin/components/admin-dashboard').then(m => ({ default: m.AdminDashboard })))
const CashierLayout = lazy(() => import('@/features/cashier/components/cashier-layout').then(m => ({ default: m.CashierLayout })))
const KdsLayout = lazy(() => import('@/features/kitchen/components/kds-layout').then(m => ({ default: m.KdsLayout })))
const WaiterLayout = lazy(() => import('@/features/waiter/components/waiter-layout').then(m => ({ default: m.WaiterLayout })))

const searchSchema = z.object({
  view: z.enum(['dashboard', 'cashier', 'waiter', 'kitchen']).optional(),
})

export const Route = createFileRoute('/admin')({
  validateSearch: (search) => searchSchema.parse(search),
  beforeLoad: ({ location }) => {
    if (!isStaffAuthenticated()) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }
  },
  pendingComponent: () => (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-[var(--bg)]">
      <div className="relative flex size-16 items-center justify-center rounded-[20px] bg-[var(--surface-grouped)] shadow-2xl">
        <Loader2 className="size-8 animate-spin text-[var(--system-purple)]" />
      </div>
      <p className="animate-pulse text-sm font-semibold tracking-wide text-[var(--text-secondary)]">
        Đang chuẩn bị giao diện...
      </p>
    </div>
  ),
})

export const RouteComponent = () => {
  const { view: requestedView } = Route.useSearch()
  const { permissions, loading } = usePermissions()

  const location = useLocation()
  
  const allowedViews = [
    permissions.has('identity.manage') && 'dashboard',
    permissions.has('billing.process') && 'cashier',
    permissions.has('dining.serve') && 'waiter',
    permissions.has('kitchen.operate') && 'kitchen',
  ].filter(Boolean) as Array<'dashboard' | 'cashier' | 'waiter' | 'kitchen'>

  const view =
    requestedView && allowedViews.includes(requestedView) ? requestedView : allowedViews[0]

  if (!view && loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-[var(--bg)]">
        <div className="relative flex size-16 items-center justify-center rounded-[20px] bg-[var(--surface-grouped)] shadow-2xl">
          <Loader2 className="size-8 animate-spin text-[var(--system-purple)]" />
        </div>
        <p className="animate-pulse text-sm font-semibold tracking-wide text-[var(--text-secondary)]">
          Đang tải không gian làm việc...
        </p>
      </div>
    )
  }
  const isExactAdmin = location.pathname === '/admin'

  // If we are exactly on /admin but have no view (and not loading), show error
  if (isExactAdmin && !view) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--bg)] text-sm text-[var(--system-red)]">
        Tài khoản chưa được cấp quyền sử dụng hệ thống.
      </div>
    )
  }

  const session = getStaffSession()

  // Determine active view for the sidebar. Operate views ride the `?view=`
  // param; manage surfaces are their own routes keyed by pathname.
  let currentActiveView: StaffView | undefined = view
  const manageRoutes: Record<string, StaffView> = {
    '/admin/table-qrs': 'table-qrs',
    '/admin/floor-plan': 'table-qrs',
    '/admin/catalog': 'catalog',
    '/admin/staff': 'staff',
    '/admin/reports': 'reports',
    '/admin/settings': 'settings',
  }
  if (manageRoutes[location.pathname]) currentActiveView = manageRoutes[location.pathname]

  return (
    <ShellProvider>
      <AdminShell role={session?.role ?? 'admin'} activeView={currentActiveView}>
        {isExactAdmin ? (
          <Suspense
            fallback={
              <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-[var(--bg)]">
                <div className="relative flex size-16 items-center justify-center rounded-[20px] bg-[var(--surface-grouped)] shadow-2xl">
                  <Loader2 className="size-8 animate-spin text-[var(--system-purple)]" />
                </div>
                <p className="animate-pulse text-sm font-semibold tracking-wide text-[var(--text-secondary)]">
                  Đang tải không gian làm việc...
                </p>
              </div>
            }
          >
            {view === 'cashier' && <CashierLayout />}
            {view === 'waiter' && <WaiterLayout />}
            {view === 'kitchen' && <KdsLayout />}
            {view === 'dashboard' && <AdminDashboard />}
          </Suspense>
        ) : (
          <Outlet />
        )}
      </AdminShell>
    </ShellProvider>
  )
}

Route.options.component = RouteComponent
