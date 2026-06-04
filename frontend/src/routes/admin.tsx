import { useEffect, useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
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
import { StaffShell } from '@/components/staff-shell'
import { isStaffAuthenticated, getStaffSession } from '@/lib/auth'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/admin')({
  beforeLoad: ({ location }) => {
    if (!isStaffAuthenticated('admin')) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }
  },
})

export const RouteComponent = () => {
  const session = getStaffSession()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const fmtDate = now.toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const fmtTime = now.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  return (
    <StaffShell
      role="admin"
      title="Quản trị vận hành"
      subtitle={`${session?.name ?? 'Administrator'} · ${fmtDate}`}
      eyebrow="Admin Portal"
      headerCenter={
        <div className="flex items-center gap-3 rounded-full bg-[var(--surface-grouped)]/70 px-4 py-2 text-sm text-[var(--text-secondary)]">
          <span className="font-mono font-semibold tabular-nums text-[var(--text)]">{fmtTime}</span>
          <span className="h-4 w-px bg-[var(--separator)]" />
          <span className="font-semibold">Local mock adapter · không đổi API backend</span>
        </div>
      }
      contentClassName="bg-[var(--surface-grouped)]/45"
    >
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            title="Doanh thu hôm nay"
            value="12.450.000 ₫"
            sub="24 hóa đơn hoàn tất · +15%"
            icon={Banknote}
            tone="green"
          />
          <MetricCard
            title="Bàn đang hoạt động"
            value="18 / 24"
            sub="Tầng 1: 8 · Tầng 2: 6 · Garden: 4"
            icon={Table2}
            tone="blue"
          />
          <MetricCard
            title="Món chờ bếp"
            value="8 món"
            sub="Thời gian trả món TB 14 phút"
            icon={ChefHat}
            tone="orange"
          />
          <MetricCard
            title="Yêu cầu thanh toán"
            value="3 bàn"
            sub="POS đang chờ xác nhận"
            icon={Clock}
            tone="purple"
          />
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Card className="overflow-hidden bg-[var(--material-regular)] backdrop-blur-2xl">
            <CardHeader className="border-b border-[var(--separator)] pb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-[20px]">
                    <UserCheck className="size-5 text-[var(--system-purple)]" />
                    Ca trực nhân viên
                  </CardTitle>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    Dữ liệu demo nội bộ, không nhập auth/template giả.
                  </p>
                </div>
                <Badge variant="success" className="px-3 py-1.5">
                  4 đang hoạt động
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead className="bg-[var(--surface-grouped)]/60 text-[12px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                    <tr>
                      <th className="px-5 py-3 font-bold">Nhân viên</th>
                      <th className="px-5 py-3 font-bold">Mã số</th>
                      <th className="px-5 py-3 font-bold">Bộ phận</th>
                      <th className="px-5 py-3 text-center font-bold">Trạng thái</th>
                      <th className="px-5 py-3 text-right font-bold">Thời gian</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--separator)]">
                    <StaffRow
                      name="Nguyễn Quản Trị"
                      code="ADMIN001"
                      role="Admin"
                      tone="purple"
                      time="6h 45m"
                    />
                    <StaffRow
                      name="Trần Thu Ngân"
                      code="CASH001"
                      role="Cashier"
                      tone="green"
                      time="4h 12m"
                    />
                    <StaffRow
                      name="Lê Phục Vụ"
                      code="WAIT001"
                      role="Waiter"
                      tone="blue"
                      time="3h 28m"
                    />
                    <StaffRow
                      name="Phạm Đầu Bếp"
                      code="KITCH001"
                      role="Kitchen"
                      tone="orange"
                      time="5h 02m"
                    />
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[var(--material-regular)] backdrop-blur-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[20px]">
                <Settings className="size-5 text-[var(--system-purple)]" />
                Lệnh nhanh
              </CardTitle>
              <p className="text-sm text-[var(--text-secondary)]">
                Mẫu shadcn-admin đổi thành tác vụ nhà hàng.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <ActionButton
                label="Xem báo cáo doanh thu"
                desc="Xuất file tài chính ngày"
                icon={FileText}
              />
              <ActionButton
                label="Cấu hình sơ đồ bàn"
                desc="Chỉnh phân khu và sức chứa"
                icon={TrendingUp}
              />
              <ActionButton
                label="Quản lý danh mục món"
                desc="Đổi giá, ẩn/hiện món"
                icon={UtensilsCrossed}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </StaffShell>
  )
}

function MetricCard({
  title,
  value,
  sub,
  icon: Icon,
  tone,
}: {
  title: string
  value: string
  sub: string
  icon: LucideIcon
  tone: 'green' | 'blue' | 'orange' | 'purple'
}) {
  const toneClass = {
    green: 'text-[var(--system-green)] bg-[var(--system-green)]/10',
    blue: 'text-[var(--system-blue)] bg-[var(--system-blue)]/10',
    orange: 'text-[var(--system-orange)] bg-[var(--system-orange)]/10',
    purple: 'text-[var(--system-purple)] bg-[var(--system-purple)]/10',
  }[tone]

  return (
    <Card className="bg-[var(--material-regular)] backdrop-blur-2xl">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            {title}
          </span>
          <span
            className={cn('flex size-10 items-center justify-center rounded-[14px]', toneClass)}
          >
            <Icon className="size-5" />
          </span>
        </div>
        <div className="mt-4 text-[28px] font-semibold tracking-tight text-[var(--text)]">
          {value}
        </div>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">{sub}</p>
      </CardContent>
    </Card>
  )
}

function StaffRow({
  name,
  code,
  role,
  tone,
  time,
}: {
  name: string
  code: string
  role: string
  tone: 'green' | 'blue' | 'orange' | 'purple'
  time: string
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
          Đang trực
        </span>
      </td>
      <td className="px-5 py-4 text-right font-mono text-xs text-[var(--text-secondary)]">
        {time}
      </td>
    </tr>
  )
}

function ActionButton({
  label,
  desc,
  icon: Icon,
}: {
  label: string
  desc: string
  icon: LucideIcon
}) {
  return (
    <button className="group flex min-h-16 w-full cursor-pointer items-center justify-between rounded-[18px] bg-[var(--surface-grouped)]/70 p-3 text-left transition-colors duration-[220ms] hover:bg-[var(--system-purple)]/10 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--system-purple)]/20">
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

Route.options.component = RouteComponent
