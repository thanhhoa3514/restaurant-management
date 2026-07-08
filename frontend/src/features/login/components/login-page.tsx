import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Lock, User, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { loginStaff } from '@/lib/auth'
import { BRAND } from '@/lib/brand'

export function LoginPage() {
  const { redirect } = useSearch({ from: '/login' })
  const navigate = useNavigate()

  const [state, setState] = React.useReducer((s: any, a: any) => ({ ...s, ...a }), {
    username: '',
    password: '',
    showPassword: false,
    loading: false,
    error: null as string | null,
  })

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
      setState({
        error: err instanceof Error ? err.message : 'Không thể đăng nhập',
        loading: false,
      })
    }
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-zinc-950 px-4 py-12 font-sans overflow-hidden">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800/20 via-zinc-950 to-zinc-950" />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-emerald-900/10 blur-[120px]" />

      <div className="relative w-full max-w-sm">
        {/* Brand header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">{BRAND.name.vi}</h1>
        </div>

        {/* Login card */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Error state */}
            {state.error && (
              <div className="flex items-center gap-3 rounded-xl border border-red-900/50 bg-red-950/30 p-4 text-xs font-semibold text-red-400">
                <AlertCircle size={16} className="shrink-0" />
                <p>{state.error}</p>
              </div>
            )}

            {/* Username */}
            <div className="space-y-1.5">
              <label
                className="text-xs font-semibold uppercase tracking-wider text-zinc-400"
                htmlFor="username"
              >
                Tài khoản
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                  <User size={17} />
                </span>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="Nhập tài khoản"
                  className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-800/50 pl-10 pr-3.5 text-sm font-medium text-zinc-100 placeholder-zinc-500 transition focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15 focus:bg-zinc-800 outline-none"
                  value={state.username}
                  onChange={(e) => setState({ username: e.target.value })}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label
                className="text-xs font-semibold uppercase tracking-wider text-zinc-400"
                htmlFor="password"
              >
                Mật khẩu
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">
                  <Lock size={17} />
                </span>
                <input
                  id="password"
                  type={state.showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-800/50 pl-10 pr-10 text-sm font-medium tracking-widest text-zinc-100 placeholder-zinc-500 transition focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15 focus:bg-zinc-800 outline-none"
                  value={state.password}
                  onChange={(e) => setState({ password: e.target.value })}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition cursor-pointer"
                  onClick={() => setState({ showPassword: !state.showPassword })}
                  tabIndex={-1}
                >
                  {state.showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={state.loading}
              className="group flex h-11 w-full items-center justify-center rounded-xl bg-emerald-600 text-white font-semibold text-sm shadow-lg shadow-emerald-900/30 transition active:scale-[0.98] disabled:opacity-50 cursor-pointer hover:bg-emerald-500"
            >
              {state.loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="animate-spin size-[17px]" />
                  <span>Đang kiểm tra...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span>Đăng nhập</span>
                  <ArrowRight
                    size={17}
                    className="transition-transform group-hover:translate-x-0.5 duration-200"
                  />
                </div>
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-zinc-700">
          {BRAND.name.vi} &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
