/* eslint-disable react-refresh/only-export-components, react-doctor/only-export-components */
import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { isStaffAuthenticated } from '@/lib/auth'
import { AdminViewRouter } from '@/features/admin/components/admin-view-router'

const searchSchema = z.object({
  view: z.enum(['dashboard', 'cashier', 'waiter', 'kitchen']).optional(),
})

export const Route = createFileRoute('/admin')({
  validateSearch: (search) => searchSchema.parse(search),
  beforeLoad: ({ location }) => {
    if (!isStaffAuthenticated()) {
      throw redirect({
        to: '/login',
        search: { redirect: location.href },
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

export const RouteComponent = AdminViewRouter

Route.options.component = RouteComponent
