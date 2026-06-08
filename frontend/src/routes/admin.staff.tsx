import { createFileRoute, redirect } from '@tanstack/react-router'
import { UsersRound } from 'lucide-react'

import { ComingSoon } from '@/components/coming-soon'
import { shellStrings } from '@/components/shell-i18n'
import { hasStaffPermission, isStaffAuthenticated } from '@/lib/auth'
import { useLang } from '@/lib/use-lang'

export const Route = createFileRoute('/admin/staff')({
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
  return <ComingSoon title={s.navLabel.staff} subtitle={s.navDesc.staff} icon={UsersRound} />
}

Route.options.component = RouteComponent
