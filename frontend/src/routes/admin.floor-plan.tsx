import { createFileRoute, redirect } from '@tanstack/react-router'
import { useShellConfig } from '@/components/admin-shell'
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
  const { lang } = useLang()
  const t = makeAdminT(lang)

  useShellConfig({
    title: t('action_floor'),
    subtitle: t('action_floor_desc'),
    contentClassName: "bg-[var(--surface-grouped)]/45"
  })

  return (
    <>
      <div className="mx-auto max-w-7xl">
        <FloorBuilder />
      </div>
    </>
  )
}

Route.options.component = RouteComponent
