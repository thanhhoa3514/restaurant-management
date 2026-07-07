import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import {
  Lock,
  User,
  Eye,
  EyeOff,
  AlertCircle,
  ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { loginStaff } from '@/lib/auth'
import { BRAND } from '@/lib/brand'

export function LoginPage() {
  const { redirect } = useSearch({ from: '/login' })
  const navigate = useNavigate()

  const [state, setState] = React.useReducer(
    (s: any, a: any) => ({ ...s, ...a }),
    {
      username: '',
      password: '',
      showPassword: false,
      loading: false,
      error: null as string | null,
    }
  )

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setState({ error: null })

    if (!state.username.trim()) {
      setState({ error: 'Vui lòng nhập tài khoản!' })
      return
    }
    if (!state.password) {
      setState({ error: 'Vui lòng nhập mật khẩu!' })
      return
    }

    setState({ loading: true })

    try {
      const session = await loginStaff(state.username, state.password)

      if (!session) {
        setState({ error: 'Tài khoản hoặc mật khẩu không chính xác!', loading: false })
        return
      }

      toast.success(`Xin chào, ${session.name}!`)

      if (redirect) {
        window.location.href = redirect
      } else {
        navigate({ to: '/admin' })
      }
    } catch (err) {
      setState({ error: err instanceof Error ? err.message : 'Không thể đăng nhập', loading: false })
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-white px-4 py-12 font-sans text-zinc-900">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand header */}
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-tight text-zinc-800">{BRAND.name.vi}</h1>
        </div>

        {/* Login card */}
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Error state */}
            {state.error && (
              <div className="flex items-center gap-3 rounded-2xl bg-red-50 border border-red-200 p-4 text-xs font-semibold text-red-600">
                <AlertCircle size={16} className="shrink-0" />
                <p>{state.error}</p>
              </div>
            )}

            {/* Username */}
            <div className="space-y-1.5">
              <label
                className="text-xs font-semibold uppercase tracking-wider text-zinc-500"
                htmlFor="username"
              >
                Tài khoản
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
                  <User size={18} />
                </span>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="Nhập tài khoản"
                  className="h-12 w-full rounded-2xl border border-zinc-300 bg-white pl-11 pr-4 text-sm font-medium text-zinc-900 placeholder-zinc-400 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  value={state.username}
                  onChange={(e) => setState({ username: e.target.value })}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label
                className="text-xs font-semibold uppercase tracking-wider text-zinc-500"
                htmlFor="password"
              >
                Mật khẩu
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400">
                  <Lock size={18} />
                </span>
                <input
                  id="password"
                  type={state.showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  className="h-12 w-full rounded-2xl border border-zinc-300 bg-white pl-11 pr-12 text-sm font-medium tracking-widest text-zinc-900 placeholder-zinc-400 transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                  value={state.password}
                  onChange={(e) => setState({ password: e.target.value })}
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition cursor-pointer"
                  onClick={() => setState({ showPassword: !state.showPassword })}
                  tabIndex={-1}
                >
                  {state.showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={state.loading}
              className="group flex h-12 w-full items-center justify-center rounded-2xl bg-emerald-600 text-white font-semibold text-sm shadow-sm transition active:scale-[0.98] disabled:opacity-50 cursor-pointer hover:bg-emerald-700"
            >
              {state.loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="animate-spin size-[18px]" />
                  <span>Đang kiểm tra...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span>Đăng nhập</span>
                  <ArrowRight
                    size={18}
                    className="transition-transform group-hover:translate-x-1 duration-200"
                  />
                </div>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
