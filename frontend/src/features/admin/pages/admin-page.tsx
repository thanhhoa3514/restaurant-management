import { Suspense, lazy } from 'react'
import { Outlet, useLocation } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'

import { AdminShell, ShellProvider } from '@/components/admin-shell'
import { usePermissions } from '@/contexts/permission'
import { getStaffSession } from '@/lib/auth'
import type { StaffView } from '@/components/admin-config'
import { Route as adminRoute } from '@/routes/admin'

const AdminDashboard = lazy(() =>
  import('@/features/admin/components/admin-dashboard').then((m) => ({
    default: m.AdminDashboard,
  })),
)
const CashierLayout = lazy(() =>
  import('@/features/cashier/pages/cashier-page').then((m) => ({
    default: m.CashierLayout,
  })),
)
const KdsLayout = lazy(() =>
  import('@/features/kitchen/pages/kds-page').then((m) => ({
    default: m.KdsLayout,
  })),
)
const WaiterLayout = lazy(() =>
  import('@/features/waiter/pages/waiter-page').then((m) => ({
    default: m.WaiterLayout,
  })),
)

const MANAGE_ROUTES: Record<string, StaffView> = {
  '/admin/table-qrs': 'table-qrs',
  '/admin/sessions': 'sessions',
  '/admin/invoices': 'invoices',
  '/admin/floor-plan': 'table-qrs',
  '/admin/catalog': 'catalog',
  '/admin/staff': 'staff',
  '/admin/reports': 'reports',
  '/admin/settings': 'settings',
}

function LoadingFallback() {
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

export function AdminViewRouter() {
  const { view: requestedView } = adminRoute.useSearch()
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

  if (!view && loading) return <LoadingFallback />

  const isExactAdmin = location.pathname === '/admin'

  if (isExactAdmin && !view) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[var(--bg)] text-sm text-[var(--system-red)]">
        Tài khoản chưa được cấp quyền sử dụng hệ thống.
      </div>
    )
  }

  const session = getStaffSession()
  let currentActiveView: StaffView | undefined = view
  if (MANAGE_ROUTES[location.pathname]) currentActiveView = MANAGE_ROUTES[location.pathname]

  return (
    <ShellProvider>
      <AdminShell role={session?.role ?? 'admin'} activeView={currentActiveView}>
        {isExactAdmin ? (
          <Suspense fallback={<LoadingFallback />}>
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
