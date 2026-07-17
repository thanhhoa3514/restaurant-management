import { Link } from '@tanstack/react-router'
import { Shield, Smartphone, ArrowRight } from 'lucide-react'
import { BRAND } from '@/constants/brand'

export function LandingPage() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center bg-zinc-950 px-4 py-12 text-zinc-100 overflow-hidden font-sans">
      <div className="absolute top-[-10%] left-[-10%] size-[50vw] rounded-full bg-blue-900/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] size-[50vw] rounded-full bg-purple-900/10 blur-[120px] pointer-events-none" />

      <div className="z-10 w-full max-w-md space-y-8 text-center animate-fade-in">
        <div className="space-y-3">
          <div className="inline-flex size-16 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 text-3xl font-black text-white shadow-2xl">
            ₫
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            {BRAND.name.vi}
          </h1>
          <p className="text-sm font-medium text-zinc-400">
            Hệ thống Quản lý Vận hành & Phục vụ nhà hàng
          </p>
        </div>

        <div className="space-y-4 pt-4">
          <Link
            to="/order"
            search={{ t: undefined, s: undefined, table: undefined, tableId: undefined }}
            className="flex items-center justify-between rounded-3xl border border-blue-500/20 bg-blue-500/5 p-5 text-left transition active:scale-[0.98] hover:bg-blue-500/10 cursor-pointer shadow-lg"
          >
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400">
                <Smartphone size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Khách hàng gọi món</h3>
                <p className="text-xs text-zinc-400 mt-0.5">Quét mã QR tại bàn để tự phục vụ</p>
              </div>
            </div>
            <ArrowRight size={18} className="text-blue-400" />
          </Link>

          <Link
            to="/login"
            className="flex items-center justify-between rounded-3xl border border-purple-500/20 bg-purple-500/5 p-5 text-left transition active:scale-[0.98] hover:bg-purple-500/10 cursor-pointer shadow-lg"
          >
            <div className="flex items-center gap-4">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-400">
                <Shield size={24} />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Cổng Nhân viên & Admin</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Thu ngân, Phục vụ, Nhà bếp, Quản trị viên
                </p>
              </div>
            </div>
            <ArrowRight size={18} className="text-purple-400" />
          </Link>
        </div>
      </div>
    </div>
  )
}
