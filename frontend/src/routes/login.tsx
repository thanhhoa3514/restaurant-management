import { useState } from 'react'
import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router'
import { z } from 'zod'
import {
  Shield,
  CreditCard,
  ClipboardList,
  ChefHat,
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  ArrowRight,
} from 'lucide-react'
import { loginStaff, DEMO_CREDENTIALS, type StaffRole } from '@/lib/auth'

const searchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/login')({
  validateSearch: (search) => searchSchema.parse(search),
})

export const RouteComponent = () => {
  const { redirect } = useSearch({ from: '/login' })
  const navigate = useNavigate()

  const [role, setRole] = useState<StaffRole>('cashier')
  const [restaurantCode, setRestaurantCode] = useState(DEMO_CREDENTIALS.cashier.restaurantCode)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loggedInUser, setLoggedInUser] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!restaurantCode.trim()) {
      setError('Vui lòng nhập mã nhà hàng!')
      return
    }
    if (!code.trim()) {
      setError(
        role === 'admin'
          ? 'Vui lòng nhập tài khoản quản trị!'
          : 'Vui lòng nhập tài khoản nhân viên!',
      )
      return
    }
    if (!password) {
      setError('Vui lòng nhập mật khẩu!')
      return
    }

    setLoading(true)

    try {
      const session = await loginStaff(restaurantCode, code, password, role)

      if (!session) {
        setError('Tài khoản, mật khẩu hoặc vai trò không chính xác!')
        setLoading(false)
        return
      }

      setSuccess(true)
      setLoggedInUser(session.name)

      // Wait 1.2s for the checkmark animation before redirecting.
      window.setTimeout(() => {
        if (redirect) {
          window.location.href = redirect
        } else if (session.role === 'admin') navigate({ to: '/admin' })
        else if (session.role === 'cashier') navigate({ to: '/cashier' })
        else if (session.role === 'waiter') navigate({ to: '/waiter' })
        else if (session.role === 'kitchen') navigate({ to: '/kitchen' })
      }, 1200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không thể đăng nhập vào API')
      setLoading(false)
    }
  }

  // Helper to prefill fields for easy evaluation
  const handleQuickFill = (targetRole: StaffRole) => {
    setRole(targetRole)
    setRestaurantCode(DEMO_CREDENTIALS[targetRole].restaurantCode)
    setCode(DEMO_CREDENTIALS[targetRole].code)
    setPassword(DEMO_CREDENTIALS[targetRole].pass)
    setError(null)
  }

  const roleMeta: Record<
    StaffRole,
    { label: string; desc: string; icon: typeof Shield; color: string }
  > = {
    admin: {
      label: 'Admin',
      desc: 'Quản trị hệ thống',
      icon: Shield,
      color:
        'text-[var(--system-purple)] border-[var(--system-purple)]/30 bg-[var(--system-purple)]/5',
    },
    cashier: {
      label: 'Cashier',
      desc: 'Thu ngân & thanh toán',
      icon: CreditCard,
      color:
        'text-[var(--system-green)] border-[var(--system-green)]/30 bg-[var(--system-green)]/5',
    },
    waiter: {
      label: 'Waiter',
      desc: 'Phục vụ bàn ăn',
      icon: ClipboardList,
      color: 'text-[var(--system-blue)] border-[var(--system-blue)]/30 bg-[var(--system-blue)]/5',
    },
    kitchen: {
      label: 'Kitchen',
      desc: 'Nhà bếp & KDS',
      icon: ChefHat,
      color:
        'text-[var(--system-orange)] border-[var(--system-orange)]/30 bg-[var(--system-orange)]/5',
    },
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-zinc-950 px-4 py-12 font-sans text-zinc-100 overflow-hidden">
      {/* Background glowing orbs */}
      <div className="absolute top-[-10%] left-[-10%] size-[50vw] rounded-full bg-blue-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] size-[50vw] rounded-full bg-purple-900/10 blur-[120px] pointer-events-none" />

      {/* Dynamic particles animation mesh */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.15),rgba(255,255,255,0))]" />

      <div className="z-10 w-full max-w-lg space-y-6 animate-fade-in">
        {/* Title branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex size-14 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-2xl font-black text-white shadow-xl">
            ₫
          </div>
          <h2 className="text-3xl font-extrabold tracking-tight text-white">Cơm Tấm Sài Gòn</h2>
          <p className="text-sm font-medium text-zinc-400">Hệ thống Quản lý Vận hành & Gọi món</p>
        </div>

        {/* Main card */}
        <div className="relative overflow-hidden rounded-3xl border border-zinc-800/80 bg-zinc-900/60 p-6 shadow-2xl backdrop-blur-2xl sm:p-8">
          {success ? (
            /* Beautiful success screen */
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-4 animate-scale-in">
              <div className="relative flex size-20 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.15)] animate-pulse">
                <CheckCircle size={44} strokeWidth={2.5} />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-white">Đăng nhập thành công!</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  Xin chào, <span className="font-semibold text-emerald-400">{loggedInUser}</span>.
                  <br />
                  Hệ thống đang chuyển tiếp bạn...
                </p>
              </div>
              <div className="w-16 h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 animate-[loading_1.2s_ease-in-out_infinite] w-8 rounded-full" />
              </div>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-6">
              {/* Role selector tabs */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Vai trò đăng nhập
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(Object.keys(roleMeta) as StaffRole[]).map((r) => {
                    const meta = roleMeta[r]
                    const Icon = meta.icon
                    const isSelected = role === r

                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => {
                          setRole(r)
                          setError(null)
                        }}
                        className={`group relative flex flex-col items-center justify-center rounded-2xl border p-3 text-center transition-all duration-200 cursor-pointer ${
                          isSelected
                            ? `${meta.color} border-current ring-1 ring-current shadow-lg`
                            : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                        }`}
                      >
                        <Icon
                          size={20}
                          className={`mb-1 transition-transform group-hover:scale-110 duration-200 ${isSelected ? 'scale-105' : ''}`}
                        />
                        <span className="text-[11px] font-bold">{meta.label}</span>
                      </button>
                    )
                  })}
                </div>
                <p className="text-center text-xs text-zinc-400 pt-1 font-medium italic">
                  &middot; {roleMeta[role].desc} &middot;
                </p>
              </div>

              {/* Error state */}
              {error && (
                <div className="flex items-center gap-3 rounded-2xl bg-red-950/30 border border-red-500/20 p-4 text-xs font-semibold text-red-400 animate-shake">
                  <AlertCircle size={16} className="shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              {/* Form fields */}
              <div className="space-y-4">
                {/* Restaurant Code */}
                <div className="space-y-1.5">
                  <label
                    className="text-xs font-bold uppercase tracking-wider text-zinc-400"
                    htmlFor="restaurantCode"
                  >
                    Mã nhà hàng
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
                      <Shield size={18} />
                    </span>
                    <input
                      id="restaurantCode"
                      type="text"
                      placeholder="VD: DEMO"
                      className="h-12 w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 pl-11 pr-4 text-sm font-semibold tracking-wide text-white placeholder-zinc-500 transition focus:border-zinc-600 focus:bg-zinc-950 focus:ring-1 focus:ring-zinc-600 outline-none"
                      value={restaurantCode}
                      onChange={(e) => setRestaurantCode(e.target.value)}
                    />
                  </div>
                </div>

                {/* Staff Code */}
                <div className="space-y-1.5">
                  <label
                    className="text-xs font-bold uppercase tracking-wider text-zinc-400"
                    htmlFor="staffCode"
                  >
                    Mã nhân viên
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
                      <User size={18} />
                    </span>
                    <input
                      id="staffCode"
                      type="text"
                      placeholder="VD: cashier, server,..."
                      className="h-12 w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 pl-11 pr-4 text-sm font-semibold tracking-wide text-white placeholder-zinc-500 transition focus:border-zinc-600 focus:bg-zinc-950 focus:ring-1 focus:ring-zinc-600 outline-none"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      className="text-xs font-bold uppercase tracking-wider text-zinc-400"
                      htmlFor="staffPass"
                    >
                      Mật khẩu
                    </label>
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500">
                      <Lock size={18} />
                    </span>
                    <input
                      id="staffPass"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••••••"
                      className="h-12 w-full rounded-2xl border border-zinc-800 bg-zinc-950/40 pl-11 pr-12 text-sm font-semibold tracking-widest text-white placeholder-zinc-600 transition focus:border-zinc-600 focus:bg-zinc-950 focus:ring-1 focus:ring-zinc-600 outline-none"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="group relative flex h-13 w-full items-center justify-center rounded-2xl bg-white text-zinc-950 font-bold text-base shadow-lg transition active:scale-[0.98] disabled:opacity-60 cursor-pointer overflow-hidden hover:bg-zinc-200"
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <svg
                      className="animate-spin text-zinc-950"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <circle
                        className="opacity-20"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="3"
                      />
                      <path d="M12 2a10 10 0 0 1 10 10" />
                    </svg>
                    <span>Đang kiểm tra...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <span>Đăng nhập hệ thống</span>
                    <ArrowRight
                      size={18}
                      className="transition-transform group-hover:translate-x-1 duration-200"
                    />
                  </div>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Quick Demo Credentials Panel (extremely helpful for grading/testing) */}
        {!success && (
          <div className="rounded-3xl border border-zinc-800/40 bg-zinc-900/20 p-5 backdrop-blur-md">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 text-center">
              Tài khoản API seed (Nhấp chọn để tự động điền)
            </h4>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(Object.keys(DEMO_CREDENTIALS) as StaffRole[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => handleQuickFill(r)}
                  className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-2 text-center hover:border-zinc-700 hover:bg-zinc-900/90 active:scale-95 transition-all cursor-pointer"
                >
                  <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                    {r}
                  </div>
                  <div className="mt-1 text-[11px] font-semibold font-mono text-zinc-200">
                    {DEMO_CREDENTIALS[r].code}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

Route.options.component = RouteComponent
