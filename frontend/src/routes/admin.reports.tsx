/* eslint-disable react-refresh/only-export-components, react-doctor/only-export-components */
import { createFileRoute, redirect } from '@tanstack/react-router'
import { BarChart3 } from 'lucide-react'

import { ComingSoon } from '@/components/coming-soon'
import { shellStrings } from '@/components/shell-i18n'
import { hasStaffPermission, isStaffAuthenticated } from '@/lib/auth'
import { useLang } from '@/hooks/use-lang'

export const Route = createFileRoute('/admin/reports')({
  beforeLoad: ({ location }) => {
    if (!isStaffAuthenticated()) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    if (!hasStaffPermission('identity.manage')) throw redirect({ to: '/admin' })
  },
})

export const RouteComponent = () => {
  const { lang } = useLang()
  const s = shellStrings(lang)
  return <ComingSoon title={s.navLabel.reports} subtitle={s.navDesc.reports} icon={BarChart3} />
}

Route.options.component = RouteComponent
