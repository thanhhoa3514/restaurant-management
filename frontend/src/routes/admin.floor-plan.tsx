import { createFileRoute, redirect } from '@tanstack/react-router'
import { StaffShell } from '@/components/staff-shell'
import { makeAdminT } from '@/features/admin/data/i18n'
import { hasStaffPermission, isStaffAuthenticated } from '@/lib/auth'
import { useLang } from '@/lib/use-lang'
import { FloorBuilder } from '@/features/admin/components/floor-builder'

export const Route = createFileRoute('/admin/floor-plan')({
  beforeLoad: ({ location }) => {
    if (!isStaffAuthenticated()) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
    if (!hasStaffPermission('identity.manage')) throw redirect({ to: '/admin' })
  },
})

export const RouteComponent = () => {
  const { lang, setLang } = useLang()
  const t = makeAdminT(lang)

  return (
    <StaffShell
      role="admin"
      activeView="dashboard"
      title={t('action_floor')}
      subtitle={t('action_floor_desc')}
      lang={lang}
      setLang={setLang}
      contentClassName="bg-[var(--surface-grouped)]/45"
    >
      <div className="mx-auto max-w-7xl">
        <FloorBuilder />
      </div>
    </StaffShell>
  )
}

Route.options.component = RouteComponent
