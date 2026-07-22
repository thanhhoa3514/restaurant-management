/* eslint-disable react-refresh/only-export-components, react-doctor/only-export-components */
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Settings } from 'lucide-react'

import { ComingSoon } from '@/components/coming-soon'
import { shellStrings } from '@/i18n'
import { hasStaffPermission, isStaffAuthenticated } from '@/lib/auth'
import { useLang } from '@/hooks/use-lang'

export const Route = createFileRoute('/admin/settings')({
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
  return <ComingSoon title={s.navLabel.settings} subtitle={s.navDesc.settings} icon={Settings} />
}

Route.options.component = RouteComponent
