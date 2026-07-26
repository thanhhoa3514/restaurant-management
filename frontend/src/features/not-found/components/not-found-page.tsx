import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

export function NotFoundPage() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-zinc-950 px-4 font-sans overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-800/10 via-zinc-950 to-zinc-950" />

      <div className="relative text-center">
        <p className="text-[120px] font-black leading-none text-zinc-800 sm:text-[160px]">404</p>
        <h1 className="-mt-2 text-lg font-semibold text-zinc-300 sm:text-xl">
          Không tìm thấy trang
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Trang bạn đang tìm không tồn tại hoặc đã bị di chuyển.
        </p>

        <Link
          to="/login"
          className="mt-8 inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-2.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 hover:text-white cursor-pointer"
        >
          <ArrowLeft size={16} />
          Quay lại đăng nhập
        </Link>
      </div>
    </div>
  )
}
