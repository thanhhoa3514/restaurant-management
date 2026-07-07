/* eslint-disable react-refresh/only-export-components, react-doctor/only-export-components */
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useShellConfig } from '@/components/admin-shell'
import { TableQRManager } from '@/features/admin/components/table-qr-manager'
import { makeAdminT } from '@/features/admin/data/i18n'
import { hasStaffPermission, isStaffAuthenticated } from '@/lib/auth'
import { useLang } from '@/lib/use-lang'

export const Route = createFileRoute('/admin/table-qrs')({
  beforeLoad: ({ location }) => {
    if (!isStaffAuthenticated()) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    if (!hasStaffPermission('dining.manage')) throw redirect({ to: '/admin' })
  },
})

export const RouteComponent = () => {
  const { lang } = useLang()
  const t = makeAdminT(lang)

  useShellConfig({
    title: t('qr_title'),
    subtitle: t('qr_subtitle'),
    contentClassName: 'bg-[var(--surface-grouped)]/45',
  })

  return <TableQRManager />
}

Route.options.component = RouteComponent
