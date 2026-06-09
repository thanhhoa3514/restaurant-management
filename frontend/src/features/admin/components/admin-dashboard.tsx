import { useQuery } from '@tanstack/react-query'
import React, { useEffect, useState, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowUpRight,
  Banknote,
  ChefHat,
  Clock,
  FileText,
  Settings,
  Table2,
  TrendingUp,
  UserCheck,
  UtensilsCrossed,
  type LucideIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ShellHeaderCenter, useShellConfig } from '@/components/admin-shell'
import { makeAdminT } from '@/features/admin/data/i18n'
import { getStaffSession } from '@/lib/auth'
import { useLang } from '@/lib/use-lang'
import { cn } from '@/lib/utils'
import { fetchAdminDashboard } from '@/features/admin/api'

export const AdminDashboard = () => {
  const session = getStaffSession()
  const { lang } = useLang()
  const t = makeAdminT(lang)
  // Tính ngày hiện tại 1 lần lúc mount
  const now = useMemo(() => new Date(), [])

  const { data: dashboard, isLoading, isError } = useQuery({
    queryKey: ['adminDashboard'],
    queryFn: fetchAdminDashboard,
    refetchInterval: 30000,
    staleTime: 60 * 1000, // Caching 60s để tránh load lại liên tục khi đổi tab
  })

  const locale = lang === 'vi' ? 'vi-VN' : 'en-US'
  const fmtDate = now.toLocaleDateString(locale, {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const navigate = useNavigate()

  useShellConfig({
    title: t('dashboard_title'),
    subtitle: `${session?.name ?? 'Administrator'} · ${fmtDate}`,
    contentClassName: "bg-[var(--surface-grouped)]/45"
  })

  return (
    <>
      <ShellHeaderCenter>
        <LiveClock locale={locale} />
      </ShellHeaderCenter>
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title={t('metric_revenue')}
            value={dashboard?.revenue.value ?? '---'}
            sub={dashboard?.revenue.sub ?? '---'}
            icon={Banknote}
            tone="green"
            loading={isLoading}
          />
          <MetricCard
            title={t('metric_tables')}
            value={dashboard?.tables.value ?? '---'}
            sub={dashboard?.tables.sub ?? '---'}
            icon={Table2}
            tone="blue"
            loading={isLoading}
          />
          <MetricCard
            title={t('metric_kitchen')}
            value={dashboard?.kitchen.value ?? '---'}
            sub={dashboard?.kitchen.sub ?? '---'}
            icon={ChefHat}
            tone="orange"
            loading={isLoading}
          />
          <MetricCard
            title={t('metric_payments')}
            value={dashboard?.payments.value ?? '---'}
            sub={dashboard?.payments.sub ?? '---'}
            icon={Clock}
            tone="purple"
            loading={isLoading}
          />
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="overflow-hidden bg-[var(--material-regular)] backdrop-blur-2xl">
            <CardHeader className="border-b border-[var(--separator)] pb-4">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-[20px]">
                  <UserCheck className="size-5 text-[var(--system-purple)]" />
                  {t('staff_on_shift')}
                </CardTitle>
                <Badge variant="success" className="px-3 py-1.5 cursor-pointer">
                  {t('active_count', dashboard?.staffs.length ?? 0)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-[var(--surface-grouped)]/60 text-[12px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                    <tr>
                      <th className="px-5 py-3 font-bold">{t('col_staff')}</th>
                      <th className="px-5 py-3 font-bold">{t('col_code')}</th>
                      <th className="px-5 py-3 font-bold">{t('col_dept')}</th>
                      <th className="px-5 py-3 text-center font-bold">{t('col_status')}</th>
                      <th className="px-5 py-3 text-right font-bold">{t('col_time')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--separator)]">
                    {isLoading ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-[var(--text-secondary)]">
                          <div className="flex items-center justify-center gap-2">
                            <div className="size-4 animate-spin rounded-full border-2 border-[var(--system-purple)] border-t-transparent" />
                            Đang tải dữ liệu...
                          </div>
                        </td>
                      </tr>
                    ) : isError ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-[var(--system-red)]">
                          Không thể tải dữ liệu. Vui lòng thử lại sau.
                        </td>
                      </tr>
                    ) : dashboard?.staffs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-[var(--text-secondary)]">
                          Không có nhân viên nào đang trực
                        </td>
                      </tr>
                    ) : (
                      dashboard?.staffs.map((staff) => (
                        <StaffRow
                          key={staff.code}
                          name={staff.name}
                          code={staff.code}
                          role={staff.role}
                          tone={staff.tone}
                          time={staff.time}
                          onDuty={t('on_duty')}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[var(--material-regular)] backdrop-blur-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[20px]">
                <Settings className="size-5 text-[var(--system-purple)]" />
                {t('quick_actions')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ActionButton label={t('action_report')} desc={t('action_report_desc')} icon={FileText} onClick={() => navigate({ to: '/admin/reports' })} />
              <ActionButton label={t('action_floor')} desc={t('action_floor_desc')} icon={TrendingUp} onClick={() => navigate({ to: '/admin/floor-plan' })} />
              <ActionButton label={t('action_menu')} desc={t('action_menu_desc')} icon={UtensilsCrossed} onClick={() => navigate({ to: '/admin/catalog' })} />
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

const MetricCard = React.memo(function MetricCard({
  title,
  value,
  sub,
  icon: Icon,
  tone,
  loading,
}: {
  title: string
  value: string
  sub: string
  icon: LucideIcon
  tone: 'green' | 'blue' | 'orange' | 'purple'
  loading?: boolean
}) {
  const toneClass = {
    green: 'text-[var(--system-green)] bg-[var(--system-green)]/10',
    blue: 'text-[var(--system-blue)] bg-[var(--system-blue)]/10',
    orange: 'text-[var(--system-orange)] bg-[var(--system-orange)]/10',
    purple: 'text-[var(--system-purple)] bg-[var(--system-purple)]/10',
  }[tone]

  return (
    <Card className="bg-[var(--material-regular)] backdrop-blur-2xl cursor-pointer hover:bg-[var(--surface-grouped)]/50 transition-colors duration-[220ms]">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            {title}
          </span>
          <div className={cn('flex size-10 items-center justify-center rounded-[14px] bg-[var(--surface-grouped)]', toneClass)}>
            <Icon className="size-5" />
          </div>
        </div>
        <div className="mt-4">
          {loading ? (
            <div className="h-8 w-24 animate-pulse rounded bg-[var(--text)]/10" />
          ) : (
            <div className="text-[28px] font-semibold tracking-tight text-[var(--text)]">{value}</div>
          )}
          {loading ? (
            <div className="mt-1 h-4 w-16 animate-pulse rounded bg-[var(--text)]/10" />
          ) : (
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{sub}</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
})

const StaffRow = React.memo(function StaffRow({
  name,
  code,
  role,
  tone,
  time,
  onDuty,
}: {
  name: string
  code: string
  role: string
  tone: 'green' | 'blue' | 'orange' | 'purple'
  time: string
  onDuty: string
}) {
  return (
    <tr className="transition-colors duration-[220ms] hover:bg-[var(--surface-grouped)]/50">
      <td className="px-5 py-4 font-semibold text-[var(--text)]">{name}</td>
      <td className="px-5 py-4 font-mono text-xs text-[var(--text-secondary)]">{code}</td>
      <td className="px-5 py-4">
        <Badge
          className={cn(
            'border-0',
            tone === 'purple' && 'bg-[var(--system-purple)]/10 text-[var(--system-purple)]',
            tone === 'green' && 'bg-[var(--system-green)]/10 text-[var(--system-green)]',
            tone === 'blue' && 'bg-[var(--system-blue)]/10 text-[var(--system-blue)]',
            tone === 'orange' && 'bg-[var(--system-orange)]/10 text-[var(--system-orange)]',
          )}
        >
          {role}
        </Badge>
      </td>
      <td className="px-5 py-4 text-center">
        <span className="inline-flex items-center gap-2 text-xs font-bold text-[var(--system-green)]">
          <span className="size-2 rounded-full bg-[var(--system-green)]" />
          {onDuty}
        </span>
      </td>
      <td className="px-5 py-4 text-right font-mono text-xs text-[var(--text-secondary)]">
        {time}
      </td>
    </tr>
  )
})

function LiveClock({ locale }: { locale: string }) {
  const [time, setTime] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const fmtTime = time.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <div className="flex items-center gap-3 rounded-full bg-[var(--surface-grouped)]/70 px-4 py-2 text-sm text-[var(--text-secondary)]">
      <span className="font-mono font-semibold tabular-nums text-[var(--text)]">{fmtTime}</span>
    </div>
  )
}

function ActionButton({
  label,
  desc,
  icon: Icon,
  onClick,
}: {
  label: string
  desc: string
  icon: LucideIcon
  onClick?: () => void
}) {
  return (
    <button type="button" onClick={onClick} className="group flex min-h-16 w-full cursor-pointer items-center justify-between rounded-[18px] bg-[var(--surface-grouped)]/70 p-3 text-left transition-colors duration-[220ms] hover:bg-[var(--system-purple)]/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--system-purple)]/20">
      <span className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-[14px] bg-[var(--bg-elevated)] text-[var(--text-secondary)] group-hover:text-[var(--system-purple)]">
          <Icon className="size-5" />
        </span>
        <span>
          <span className="block text-sm font-semibold text-[var(--text)]">{label}</span>
          <span className="block text-xs text-[var(--text-secondary)]">{desc}</span>
        </span>
      </span>
      <ArrowUpRight className="size-4 text-[var(--text-tertiary)]" />
    </button>
  )
}
