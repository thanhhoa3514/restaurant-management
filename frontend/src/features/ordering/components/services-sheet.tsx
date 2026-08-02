import { type FC } from 'react'
import { Bell, FileText, Globe, X, Check, Droplet, Utensils, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { Lang } from '../types'
import { cn } from '@/lib/utils'
import { useCallWaiter } from '../mutations/useCallWaiter'
interface ServicesSheetProps {
  open: boolean
  onClose: () => void
  lang: Lang
  dispatch: any
  setChangingLang: (lang: Lang | null) => void
  sessionToken?: string
}

export const ServicesSheet: FC<ServicesSheetProps> = ({
  open,
  onClose,
  lang,
  dispatch,
  setChangingLang,
  sessionToken,
}) => {
  const callWaiter = useCallWaiter()

  if (!open) return null

  // reason gửi lên luôn là tiếng Việt vì màn hình nhân viên là tiếng Việt; label chỉ để hiện toast cho khách.
  const handleCallStaff = (reason: string, label: string) => {
    if (!sessionToken) return
    callWaiter.mutate(
      { sessionToken, reason },
      {
        onSuccess: () => {
          toast.success(lang === 'vi' ? `Đã gửi yêu cầu: ${label}` : `Request sent: ${label}`, {
            icon: <Check className="text-[var(--system-green)]" />,
          })
          onClose()
        },
        onError: () => {
          toast.error(
            lang === 'vi'
              ? 'Có lỗi xảy ra, vui lòng thử lại!'
              : 'Error occurred, please try again!',
          )
        },
      },
    )
  }

  const handleChangeLang = () => {
    const target = lang === 'vi' ? 'en' : 'vi'
    setChangingLang(target)
    setTimeout(() => {
      dispatch({ type: 'SET_LANG', payload: target })
      setChangingLang(null)
    }, 750)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex flex-col justify-end">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
        onClick={onClose}
      />

      {/* Sheet Content */}
      <div className="relative z-10 bg-[var(--bg)] rounded-t-[32px] overflow-hidden animate-in slide-in-from-bottom-full duration-300 shadow-[0_-10px_40px_rgba(0,0,0,0.1)]">
        <div className="p-5 pb-8 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[var(--text)] tracking-tight">
              {lang === 'vi' ? 'Dịch vụ' : 'Services'}
            </h2>
            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-full bg-[var(--surface-grouped)] text-[var(--text-secondary)] hover:text-[var(--text)] transition-colors active:scale-95"
              onClick={onClose}
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* View Order History */}
            <button
              type="button"
              className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-[var(--surface-grouped)] p-5 transition-all active:scale-95 border border-[var(--separator)]/50 cursor-pointer"
              onClick={() => {
                onClose()
                dispatch({ type: 'SET_SCREEN', payload: 'order' })
              }}
            >
              <div className="flex size-12 items-center justify-center rounded-full bg-[var(--system-blue)]/10 text-[var(--system-blue)]">
                <FileText size={24} strokeWidth={2} />
              </div>
              <span className="text-[13px] font-bold text-[var(--text)] text-center">
                {lang === 'vi' ? 'Đơn hàng & Thanh toán' : 'Orders & Checkout'}
              </span>
            </button>

            {/* Change Language */}
            <button
              type="button"
              className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-[var(--surface-grouped)] p-5 transition-all active:scale-95 border border-[var(--separator)]/50 cursor-pointer"
              onClick={handleChangeLang}
            >
              <div className="flex size-12 items-center justify-center rounded-full bg-[var(--system-purple)]/10 text-[var(--system-purple)]">
                <Globe size={24} strokeWidth={2} />
              </div>
              <span className="text-[13px] font-bold text-[var(--text)] text-center">
                {lang === 'vi' ? 'English' : 'Tiếng Việt'}
              </span>
            </button>
          </div>

          <div>
            <h3 className="text-[14px] font-bold text-[var(--text-secondary)] mb-3 px-1 uppercase tracking-wider">
              {lang === 'vi' ? 'Gọi nhân viên' : 'Call Staff'}
            </h3>
            <div className="flex flex-col gap-2">
              <ServiceOption
                icon={<Droplet size={18} />}
                label={lang === 'vi' ? 'Xin thêm nước' : 'More water'}
                onClick={() =>
                  handleCallStaff('Thêm nước', lang === 'vi' ? 'Thêm nước' : 'More water')
                }
                disabled={callWaiter.isPending}
              />
              <ServiceOption
                icon={<Utensils size={18} />}
                label={lang === 'vi' ? 'Thêm chén/đũa' : 'More utensils'}
                onClick={() =>
                  handleCallStaff(
                    'Thêm chén/đũa',
                    lang === 'vi' ? 'Thêm chén/đũa' : 'More utensils',
                  )
                }
                disabled={callWaiter.isPending}
              />
              <ServiceOption
                icon={<Bell size={18} />}
                label={lang === 'vi' ? 'Gọi thanh toán / Hỗ trợ' : 'Checkout / Support'}
                onClick={() =>
                  handleCallStaff('Cần hỗ trợ', lang === 'vi' ? 'Cần hỗ trợ' : 'Need support')
                }
                highlight
                disabled={callWaiter.isPending}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ServiceOption({
  icon,
  label,
  onClick,
  highlight,
  disabled,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  highlight?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'flex items-center gap-3 w-full p-4 rounded-xl transition-all active:scale-[0.98] border',
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        highlight
          ? 'bg-[var(--system-blue)]/5 border-[var(--system-blue)]/20 text-[var(--system-blue)] font-bold'
          : 'bg-[var(--surface-grouped)] border-transparent text-[var(--text)] hover:bg-[var(--separator)]/50 font-semibold',
      )}
      onClick={onClick}
    >
      <div
        className={cn(
          'flex size-8 items-center justify-center rounded-full',
          highlight ? 'bg-[var(--system-blue)]/10' : 'bg-[var(--bg)]',
        )}
      >
        {disabled ? <Loader2 size={18} className="animate-spin" /> : icon}
      </div>
      <span className="text-[15px]">{label}</span>
    </button>
  )
}
