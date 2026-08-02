/* Hallmark · pre-emit critique: P5 H5 E4 S5 R4 V4 */
/* Hallmark · component: destructive confirmation dialog · genre: modern-minimal · theme: Apple Glass
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (46–50)
 */
import { AlertTriangle, CircleCheck, Loader2, Trash2, UtensilsCrossed } from 'lucide-react'

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

import type { Lang } from '../types'

export type DeleteOrderItemDialogStatus = 'idle' | 'loading' | 'error' | 'success'
export type DeleteOrderItemDialogPreviewState =
  | 'default'
  | 'hover'
  | 'focus'
  | 'active'
  | 'disabled'
  | 'loading'
  | 'error'
  | 'success'

interface DeleteOrderItemDialogProps {
  open: boolean
  lang: Lang
  itemName: string
  quantity: number
  status?: DeleteOrderItemDialogStatus
  errorMessage?: string
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

interface DeleteOrderItemDialogPanelProps {
  lang: Lang
  itemName: string
  quantity: number
  status?: DeleteOrderItemDialogStatus
  errorMessage?: string
  previewState?: DeleteOrderItemDialogPreviewState
  onCancel: () => void
  onConfirm: () => void
}

const COPY = {
  vi: {
    title: 'Xoá món cuối cùng?',
    description: 'Đây là món duy nhất còn lại trong đơn hàng.',
    quantity: (value: number) => `Số lượng ${value}`,
    consequenceTitle: 'Đơn hàng sẽ bị huỷ',
    consequence: 'Khi xoá món này, toàn bộ đơn hàng hiện tại sẽ bị huỷ và không thể khôi phục.',
    cancel: 'Giữ món',
    confirm: 'Xoá và huỷ đơn',
    loading: 'Đang huỷ đơn…',
    success: 'Đã huỷ đơn hàng.',
  },
  en: {
    title: 'Remove the last item?',
    description: 'This is the only remaining item in the order.',
    quantity: (value: number) => `Quantity ${value}`,
    consequenceTitle: 'The order will be cancelled',
    consequence: 'Removing this item will cancel the current order and cannot be undone.',
    cancel: 'Keep item',
    confirm: 'Remove and cancel order',
    loading: 'Cancelling order…',
    success: 'Order cancelled.',
  },
} as const

export function DeleteOrderItemDialog({
  open,
  lang,
  itemName,
  quantity,
  status = 'idle',
  errorMessage,
  onOpenChange,
  onConfirm,
}: DeleteOrderItemDialogProps) {
  const loading = status === 'loading'

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!loading) onOpenChange(nextOpen)
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-[24px] border border-[var(--separator)] bg-[var(--bg-elevated)] p-0 shadow-2xl ring-0 sm:max-w-[440px]"
        showCloseButton={false}
      >
        <DeleteOrderItemDialogPanel
          lang={lang}
          itemName={itemName}
          quantity={quantity}
          status={status}
          errorMessage={errorMessage}
          onCancel={() => onOpenChange(false)}
          onConfirm={onConfirm}
        />
      </DialogContent>
    </Dialog>
  )
}

export function DeleteOrderItemDialogPanel({
  lang,
  itemName,
  quantity,
  status = 'idle',
  errorMessage,
  previewState,
  onCancel,
  onConfirm,
}: DeleteOrderItemDialogPanelProps) {
  const copy = COPY[lang]
  const visualStatus = previewState === 'loading' ? 'loading' : previewState || status
  const loading = visualStatus === 'loading'
  const disabled = previewState === 'disabled' || loading || visualStatus === 'success'

  return (
    <div className="min-w-0" data-state={visualStatus}>
      <div className="flex min-w-0 gap-4 px-5 pb-4 pt-5 sm:px-6 sm:pt-6">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-[var(--system-red)]/10 text-[var(--system-red)] ring-1 ring-[var(--system-red)]/15">
          <Trash2 aria-hidden="true" className="size-5" strokeWidth={2.25} />
        </div>

        <div className="min-w-0 flex-1 pt-0.5">
          {previewState ? (
            <h2 className="[overflow-wrap:anywhere] text-[20px] leading-tight font-bold tracking-[-0.025em] text-[var(--text)]">
              {copy.title}
            </h2>
          ) : (
            <DialogTitle className="[overflow-wrap:anywhere] text-[20px] leading-tight font-bold tracking-[-0.025em] text-[var(--text)]">
              {copy.title}
            </DialogTitle>
          )}
          {previewState ? (
            <p className="mt-2 text-[15px] leading-6 text-[var(--text-secondary)]">
              {copy.description}
            </p>
          ) : (
            <DialogDescription className="mt-2 text-[15px] leading-6 text-[var(--text-secondary)]">
              {copy.description}
            </DialogDescription>
          )}
        </div>
      </div>

      <div className="mx-5 flex min-w-0 items-center gap-3 border-y border-[var(--separator)] py-4 sm:mx-6">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--surface-grouped)] text-[var(--text-secondary)]">
          <UtensilsCrossed aria-hidden="true" className="size-[18px]" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] leading-5 font-semibold text-[var(--text)]">
            {itemName}
          </p>
          <p className="mt-0.5 text-[14px] leading-5 text-[var(--text-secondary)] tabular-nums">
            {copy.quantity(quantity)}
          </p>
        </div>
      </div>

      <div className="px-5 py-4 sm:px-6">
        <div className="flex gap-3 rounded-[14px] bg-[var(--system-red)]/8 px-4 py-3 text-[var(--text)] ring-1 ring-[var(--system-red)]/15">
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-[18px] shrink-0 text-[var(--system-red)]"
          />
          <div className="min-w-0">
            <p className="text-[14px] leading-5 font-semibold">{copy.consequenceTitle}</p>
            <p className="mt-0.5 text-[14px] leading-5 text-[var(--text-secondary)]">
              {copy.consequence}
            </p>
          </div>
        </div>

        {visualStatus === 'error' && (
          <p
            className="mt-3 flex items-start gap-2 text-[14px] leading-5 font-medium text-[var(--text)]"
            role="alert"
          >
            <AlertTriangle
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-[var(--system-red)]"
            />
            <span>{errorMessage}</span>
          </p>
        )}

        {visualStatus === 'success' && (
          <p
            className="mt-3 flex items-center gap-2 text-[14px] leading-5 font-medium text-[var(--text)]"
            aria-live="polite"
          >
            <CircleCheck
              aria-hidden="true"
              className="size-4 shrink-0 text-[var(--system-green)]"
            />
            <span>{copy.success}</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-2 border-t border-[var(--separator)] bg-[var(--surface-grouped)]/55 px-5 py-4 sm:grid-cols-2 sm:px-6">
        <button
          type="button"
          autoFocus={!previewState}
          disabled={disabled}
          className="order-2 inline-flex h-12 w-full cursor-pointer items-center justify-center whitespace-nowrap rounded-[14px] bg-[var(--bg-elevated)] px-4 text-[15px] font-semibold text-[var(--text)] ring-1 ring-[var(--separator)] transition-[background-color,transform,opacity] duration-[var(--dur-micro)] ease-[var(--ease-out)] hover:bg-[var(--surface-grouped)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--system-blue)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 sm:order-1"
          onClick={onCancel}
        >
          {copy.cancel}
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-busy={loading}
          className={cn(
            'order-1 inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[14px] bg-[var(--system-red)] px-4 text-[15px] font-semibold text-[var(--text)] transition-[background-color,transform,opacity] duration-[var(--dur-micro)] ease-[var(--ease-out)] hover:bg-[var(--system-red)]/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--system-blue)] active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50 dark:text-[var(--bg)] sm:order-2',
            previewState === 'hover' && 'bg-[var(--system-red)]/85',
            previewState === 'focus' && 'outline-2 outline-offset-2 outline-[var(--system-blue)]',
            previewState === 'active' && 'translate-y-px',
          )}
          onClick={onConfirm}
        >
          {loading ? (
            <>
              <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              {copy.loading}
            </>
          ) : (
            copy.confirm
          )}
        </button>
      </div>
    </div>
  )
}
