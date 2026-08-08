import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Lock, User, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { BRAND } from '@/constants/brand'
import { useLogin } from '@/features/login/mutations/useLogin'

export function LoginPage() {
  const { redirect } = useSearch({ from: '/login' })
  const navigate = useNavigate()

  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)

  const loginMutation = useLogin()

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()

    if (!username.trim()) {
      loginMutation.error && loginMutation.reset()
      toast.error('Vui lòng nhập tài khoản!')
      return
    }
    if (!password) {
      loginMutation.error && loginMutation.reset()
      toast.error('Vui lòng nhập mật khẩu!')
      return
    }

    loginMutation.mutate(
      { username: username.trim(), password },
      {
        onSuccess: (session) => {
          toast.success(`Xin chào, ${session.name}!`)
          // Only honour same-origin relative paths; `//host` and `https://…`
          // would be an open-redirect vector since `redirect` comes from the URL.
          const safe = redirect && /^\/(?!\/)/.test(redirect) ? redirect : null
          if (safe) {
            window.location.href = safe
          } else {
            navigate({ to: '/admin' })
          }
        },
      },
    )
  }

  return (
    <div className="relative flex min-h-dvh items-center justify-center bg-gradient-to-br from-stone-50 via-white to-stone-100 px-4 py-12 font-sans overflow-hidden">
      {/* Subtle background texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'radial-gradient(circle at 25% 25%, #c084fc 0%, transparent 50%), radial-gradient(circle at 75% 75%, #f59e0b 0%, transparent 50%)',
        }}
      />
      <div className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-amber-100/40 blur-[120px]" />

      <div className="relative w-full max-w-sm">
        {/* Brand header */}
        <div className="mb-8 text-center">
          <img
            src="/zenith-logo-transparent.png"
            alt={BRAND.name.vi}
            className="mx-auto mb-4 h-16 w-auto object-contain"
          />
          <h1 className="text-xl font-bold tracking-tight text-stone-800">{BRAND.name.vi}</h1>
          <p className="mt-1 text-xs text-stone-400">{BRAND.tagline.en}</p>
        </div>

        {/* Login card */}
        <div className="rounded-2xl border border-stone-200 bg-white/80 p-6 shadow-lg shadow-stone-200/60 backdrop-blur-xl sm:p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Error state */}
            {loginMutation.isError && loginMutation.error && (
              <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-600">
                <AlertCircle size={16} className="shrink-0" />
                <p>{loginMutation.error.message}</p>
              </div>
            )}

            {/* Username */}
            <div className="space-y-1.5">
              <label
                className="text-xs font-semibold uppercase tracking-wider text-stone-500"
                htmlFor="username"
              >
                Tài khoản
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">
                  <User size={17} />
                </span>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  placeholder="Nhập tài khoản"
                  className="h-11 w-full rounded-xl border border-stone-200 bg-stone-50 pl-10 pr-3.5 text-sm font-medium text-stone-800 placeholder-stone-400 transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/15 focus:bg-white outline-none"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value)
                    loginMutation.error && loginMutation.reset()
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label
                className="text-xs font-semibold uppercase tracking-wider text-stone-500"
                htmlFor="password"
              >
                Mật khẩu
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">
                  <Lock size={17} />
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  className="h-11 w-full rounded-xl border border-stone-200 bg-stone-50 pl-10 pr-10 text-sm font-medium tracking-widest text-stone-800 placeholder-stone-400 transition focus:border-amber-400 focus:ring-2 focus:ring-amber-400/15 focus:bg-white outline-none"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    loginMutation.error && loginMutation.reset()
                  }}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition cursor-pointer"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="group flex h-11 w-full items-center justify-center rounded-xl bg-stone-800 text-white font-semibold text-sm shadow-lg shadow-stone-800/20 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer hover:bg-stone-700"
            >
              {loginMutation.isPending ? (
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
        <p className="mt-6 text-center text-xs text-stone-400">
          {BRAND.name.vi} &copy; {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
