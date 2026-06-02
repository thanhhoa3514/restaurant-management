import { useState, useEffect } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { 
  Shield, 
  LogOut, 
  DollarSign, 
  Users, 
  Clock, 
  UtensilsCrossed, 
  RefreshCw, 
  ArrowUpRight,
  UserCheck,
  TrendingUp,
  FileText,
  Settings
} from 'lucide-react'
import { isStaffAuthenticated, getStaffSession, logoutStaff } from '@/lib/auth'

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
  const navigate = useNavigate()
  const session = getStaffSession()
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const handleLogout = () => {
    logoutStaff()
    navigate({ to: '/login' })
  }

  // Formatting helpers
  const fmtTime = (date: Date) => {
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-100 font-sans p-4 sm:p-6 lg:p-8">
      {/* Header section */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-800 pb-6 mb-8">
        <div className="flex items-center gap-3">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Shield size={26} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Quản trị Hệ thống</h1>
            <p className="text-xs font-semibold uppercase tracking-wider text-purple-400">
              Admin Portal &middot; {session?.name || 'Administrator'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:block text-right">
            <div className="font-mono text-lg font-bold text-zinc-200">{fmtTime(now)}</div>
            <div className="text-[10px] uppercase font-bold text-zinc-500">Giờ máy chủ</div>
          </div>
          <button
            onClick={handleLogout}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-zinc-900 border border-zinc-800 px-4 text-sm font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800 active:scale-95 transition-all cursor-pointer"
          >
            <LogOut size={16} />
            <span>Đăng xuất</span>
          </button>
        </div>
      </header>

      {/* Main Grid layout */}
      <main className="space-y-8 max-w-7xl mx-auto">
        {/* Metric Cards Row */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Doanh thu hôm nay"
            value="12.450.000 ₫"
            sub="24 đơn hoàn tất (+15%)"
            icon={DollarSign}
            color="text-emerald-400 bg-emerald-500/5 border-emerald-500/10"
          />
          <MetricCard
            title="Bàn đang hoạt động"
            value="18 / 24"
            sub="Phân khu: A: 8, B: 6, C: 4"
            icon={Users}
            color="text-blue-400 bg-blue-500/5 border-blue-500/10"
          />
          <MetricCard
            title="Công suất KDS (Bếp)"
            value="8 món ăn"
            sub="Thời gian trả món TB: 14m"
            icon={UtensilsCrossed}
            color="text-orange-400 bg-orange-500/5 border-orange-500/10"
          />
          <MetricCard
            title="Hóa đơn cần duyệt"
            value="3 bàn"
            sub="Yêu cầu thanh toán POS"
            icon={Clock}
            color="text-purple-400 bg-purple-500/5 border-purple-500/10"
          />
        </section>

        {/* Content sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active staff shift tracker */}
          <div className="lg:col-span-2 rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-6 backdrop-blur-md">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <UserCheck size={18} className="text-purple-400" />
                <h3 className="text-lg font-bold text-white">Ca trực nhân viên</h3>
              </div>
              <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
                4 Đang hoạt động
              </span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 font-semibold">
                    <th className="pb-3 pl-2">Nhân viên</th>
                    <th className="pb-3">Mã số</th>
                    <th className="pb-3">Bộ phận</th>
                    <th className="pb-3 text-center">Trạng thái</th>
                    <th className="pb-3 text-right pr-2">Thời gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  <StaffRow name="Nguyễn Quản Trị" code="ADMIN001" role="Admin" active={true} time="6h 45m" />
                  <StaffRow name="Trần Thu Ngân" code="CASH001" role="Cashier" active={true} time="4h 12m" />
                  <StaffRow name="Lê Phục Vụ" code="WAIT001" role="Waiter" active={true} time="3h 28m" />
                  <StaffRow name="Phạm Đầu Bếp" code="KITCH001" role="Kitchen" active={true} time="5h 02m" />
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick System controls */}
          <div className="rounded-3xl border border-zinc-800/80 bg-zinc-900/40 p-6 backdrop-blur-md flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-6">
                <Settings size={18} className="text-purple-400" />
                <h3 className="text-lg font-bold text-white">Lệnh điều khiển nhanh</h3>
              </div>

              <div className="space-y-3">
                <ActionButton 
                  label="Xem báo cáo doanh thu" 
                  desc="Xuất file báo cáo tài chính ngày"
                  icon={FileText} 
                />
                <ActionButton 
                  label="Cấu hình sơ đồ bàn ăn" 
                  desc="Chỉnh sửa phân khu A, B, C"
                  icon={TrendingUp} 
                />
                <ActionButton 
                  label="Quản lý danh mục món ăn" 
                  desc="Đổi giá, ẩn/hiện món hết hàng"
                  icon={UtensilsCrossed} 
                />
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-zinc-800/60">
              <button 
                onClick={() => window.location.reload()}
                className="flex w-full h-11 items-center justify-center gap-2 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-500 active:scale-95 transition-all shadow-lg shadow-purple-600/10 cursor-pointer"
              >
                <RefreshCw size={15} />
                <span>Đồng bộ Mock Database</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function MetricCard({ 
  title, 
  value, 
  sub, 
  icon: Icon, 
  color 
}: { 
  title: string
  value: string
  sub: string
  icon: typeof DollarSign
  color: string
}) {
  return (
    <div className={`relative overflow-hidden rounded-3xl border p-5 ${color}`}>
      <div className="flex justify-between items-start">
        <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">{title}</span>
        <Icon size={20} className="opacity-80" />
      </div>
      <div className="mt-4">
        <h3 className="text-2xl font-black text-white tracking-tight">{value}</h3>
        <p className="text-xs font-medium text-zinc-400 mt-1">{sub}</p>
      </div>
    </div>
  )
}

function StaffRow({ 
  name, 
  code, 
  role, 
  active, 
  time 
}: { 
  name: string
  code: string
  role: string
  active: boolean
  time: string
}) {
  return (
    <tr className="hover:bg-zinc-900/40 transition">
      <td className="py-3 pl-2 font-bold text-white">{name}</td>
      <td className="py-3 font-mono text-zinc-400 text-xs">{code}</td>
      <td className="py-3">
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
          role === 'Admin' ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' :
          role === 'Cashier' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
          role === 'Waiter' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
          'bg-orange-500/10 text-orange-400 border border-orange-500/20'
        }`}>
          {role}
        </span>
      </td>
      <td className="py-3 text-center">
        {active ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400">
            <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Đang trực</span>
          </span>
        ) : (
          <span className="text-xs font-semibold text-zinc-500">Ngoại tuyến</span>
        )}
      </td>
      <td className="py-3 text-right pr-2 font-mono text-zinc-400 text-xs">{time}</td>
    </tr>
  )
}

function ActionButton({ 
  label, 
  desc, 
  icon: Icon 
}: { 
  label: string
  desc: string
  icon: typeof FileText 
}) {
  return (
    <button className="group flex w-full items-center justify-between rounded-2xl border border-zinc-800/60 bg-zinc-900/20 p-3 text-left hover:border-zinc-700 hover:bg-zinc-800/40 transition-all cursor-pointer">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-zinc-800 text-zinc-400 group-hover:text-purple-400 group-hover:bg-purple-500/10 transition">
          <Icon size={16} />
        </div>
        <div>
          <div className="text-xs font-bold text-zinc-200 group-hover:text-white transition">{label}</div>
          <div className="text-[10px] text-zinc-500 mt-0.5">{desc}</div>
        </div>
      </div>
      <ArrowUpRight size={14} className="text-zinc-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
    </button>
  )
}

Route.options.component = RouteComponent
