/* Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 · genre: modern-minimal
 * macrostructure: action-led bottom sheet · theme: Apple Glass (locked) · tone: professional
 * anchor: existing semantic blue · states: default/hover/focus/active/disabled/loading/error/success
 * contrast: pass (system tokens) · honest copy: pass · responsive actions: pass
 */
import { useState, type FC } from 'react'
import {
  CheckCircle2,
  CircleAlert,
  FileText,
  Loader2,
  LockKeyhole,
  ReceiptText,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'

type DialogPhase = 'idle' | 'loading' | 'error' | 'success'

interface GuestPayConfirmDialogProps {
  open: boolean
  tableName: string
  t: Record<string, string | ((...args: never[]) => string)>
  onOpenChange: (open: boolean) => void
  onConfirm: (wantsDigitalInvoice: boolean) => Promise<void>
}

export const GuestPayConfirmDialog: FC<GuestPayConfirmDialogProps> = ({
  open,
  tableName,
  t,
  onOpenChange,
  onConfirm,
}) => {
  const [wantsDigitalInvoice, setWantsDigitalInvoice] = useState(true)
  const [phase, setPhase] = useState<DialogPhase>('idle')

  const pending = phase === 'loading'

  const changeOpen = (nextOpen: boolean) => {
    if (pending) return
    if (!nextOpen) {
      setWantsDigitalInvoice(true)
      setPhase('idle')
    }
    onOpenChange(nextOpen)
  }

  const confirm = async () => {
    if (pending) return
    setPhase('loading')
    try {
      await onConfirm(wantsDigitalInvoice)
      setPhase('success')
    } catch {
      setPhase('error')
    }
  }

  return (
    <Sheet open={open} onOpenChange={changeOpen}>
      <SheetContent
        side="bottom"
        className="mx-auto w-full max-w-lg gap-0 rounded-t-[var(--radius-xl)] border-x border-t border-[var(--separator)] bg-[var(--material-thick)] px-0 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-none backdrop-blur-[30px] supports-backdrop-filter:backdrop-saturate-[1.8]"
        hideClose
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-[var(--separator)]" aria-hidden />

        <div className="px-5 pb-2 pt-5 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--system-blue)]/10 text-[var(--system-blue)]">
              <ReceiptText className="size-5" strokeWidth={2.2} aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <SheetTitle className="text-left text-[22px] font-bold leading-tight text-[var(--text)]">
                {String(t.request_bill_title || t.request_bill || 'Yêu cầu thanh toán')}
              </SheetTitle>
              <SheetDescription className="mt-1 text-left text-sm text-[var(--text-secondary)]">
                {String(t.table || 'Bàn')} {tableName}
              </SheetDescription>
            </div>
          </div>

          <div className="mt-5 flex gap-3 rounded-[var(--radius-lg)] bg-[var(--surface-grouped)] p-4">
            <LockKeyhole
              className="mt-1 size-5 shrink-0 text-[var(--text-secondary)]"
              strokeWidth={2}
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--text)]">
                {String(t.request_bill_lock_title || 'Dừng gọi thêm món')}
              </p>
              <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
                {String(
                  t.request_bill_lock_desc ||
                    'Sau khi gửi yêu cầu, bàn sẽ được khóa để thu ngân chuẩn bị hóa đơn.',
                )}
              </p>
            </div>
          </div>

          <label
            htmlFor="guest-digital-invoice"
            className="mt-3 flex min-h-16 cursor-pointer items-center gap-3 rounded-[var(--radius-lg)] px-3 py-3 outline-none transition-colors duration-[var(--dur-short)] hover:bg-[var(--surface-grouped)] focus-within:ring-2 focus-within:ring-[var(--system-blue)] focus-within:ring-offset-2"
          >
            <FileText
              className="size-5 shrink-0 text-[var(--text-secondary)]"
              strokeWidth={2}
              aria-hidden
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[var(--text)]">
                {String(t.digital_invoice_title || 'Nhận hóa đơn điện tử')}
              </span>
              <span className="mt-1 block text-sm leading-5 text-[var(--text-secondary)]">
                {String(
                  t.digital_invoice_desc || 'Xem và tải hóa đơn trên thiết bị sau khi thanh toán.',
                )}
              </span>
            </span>
            <Switch
              id="guest-digital-invoice"
              checked={wantsDigitalInvoice}
              disabled={pending}
              onCheckedChange={setWantsDigitalInvoice}
              aria-label={String(t.digital_invoice_title || 'Nhận hóa đơn điện tử')}
            />
          </label>

          <div className="min-h-11 py-2" aria-live="polite">
            {phase === 'error' ? (
              <p
                className="flex items-start gap-2 text-sm leading-5 text-[var(--system-red)]"
                role="alert"
              >
                <CircleAlert className="mt-1 size-4 shrink-0" aria-hidden />
                {String(
                  t.request_bill_error || 'Chưa gửi được yêu cầu. Kiểm tra kết nối và thử lại.',
                )}
              </p>
            ) : phase === 'success' ? (
              <p className="flex items-center gap-2 text-sm font-medium text-[var(--system-green)]">
                <CheckCircle2 className="size-4" aria-hidden />
                {String(t.request_bill_success || t.toast_bill || 'Đã gửi yêu cầu thanh toán')}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="secondary"
              className="h-12 min-w-0 rounded-[var(--radius-lg)] text-sm font-semibold"
              disabled={pending}
              onClick={() => changeOpen(false)}
            >
              {String(t.not_yet || t.back || 'Chưa thanh toán')}
            </Button>
            <Button
              type="button"
              className="h-12 min-w-0 rounded-[var(--radius-lg)] text-sm font-semibold"
              disabled={pending || phase === 'success'}
              onClick={() => void confirm()}
            >
              {pending ? (
                <>
                  <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
                  {String(t.requesting_bill || 'Đang gửi…')}
                </>
              ) : phase === 'success' ? (
                <>
                  <CheckCircle2 className="size-4" aria-hidden />
                  {String(t.sent || 'Đã gửi')}
                </>
              ) : (
                String(t.confirm_request_bill || 'Gửi yêu cầu')
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
