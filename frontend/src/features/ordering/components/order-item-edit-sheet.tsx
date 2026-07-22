import { useState, type FC } from 'react'
import { Minus, Plus, Trash2, UtensilsCrossed } from 'lucide-react'
import { toast } from 'sonner'
import { useOrdering } from '../hooks/use-ordering'
import { DICT } from '@/i18n'
import { formatVND } from '../helpers'
import { useEditGuestOrder } from '../mutations/useEditGuestOrder'
import { useCancelGuestOrder } from '../mutations/useCancelGuestOrder'
import { ApiError, errorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { Lang, OrderItemDTO, EditOrderInput, EditOrderLineInput } from '../types'

interface OrderItemEditSheetProps {
  item: OrderItemDTO
  allItems: OrderItemDTO[]
  orderId: string
  orderVersion: number
  open: boolean
  lang: Lang
  onClose: () => void
}

export const OrderItemEditSheet: FC<OrderItemEditSheetProps> = ({
  item,
  allItems,
  orderId,
  orderVersion,
  open,
  lang,
  onClose,
}) => {
  const { state } = useOrdering()
  const t = DICT[lang]
  const sessionToken = state.session?.token
  const editMutation = useEditGuestOrder(sessionToken)
  const cancelMutation = useCancelGuestOrder(sessionToken)
  const [qty, setQty] = useState(item.quantity)
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const pendableItems = allItems.filter((i) => i.status === 'PENDING')
  const isLastPendable = pendableItems.length <= 1

  if (!open) return null

  const name = item.variant_name_snapshot
    ? `${item.name_snapshot} · ${item.variant_name_snapshot}`
    : item.name_snapshot

  function toEditLine(i: OrderItemDTO): EditOrderLineInput {
    return {
      order_item_id: i.order_item_id,
      quantity: i.quantity,
      note: '',
      options: i.options.map((o) => ({ option_id: o.option_id, quantity: o.quantity })),
    }
  }

  const handleSave = async () => {
    if (!sessionToken) return
    if (qty === 0) {
      handleDelete()
      return
    }
    setSaving(true)
    const lines: EditOrderLineInput[] = pendableItems.map((i) =>
      i.order_item_id === item.order_item_id
        ? {
            order_item_id: i.order_item_id,
            quantity: qty,
            note,
            options: i.options.map((o) => ({ option_id: o.option_id, quantity: o.quantity })),
          }
        : toEditLine(i),
    )
    const input: EditOrderInput = { version: orderVersion, items: lines }
    try {
      await editMutation.mutateAsync({ orderId, input })
      toast.success(t.toast_order_edited)
      onClose()
    } catch (err) {
      let msg = lang === 'vi' ? 'Không thể lưu thay đổi.' : 'Could not save changes.'
      if (err instanceof ApiError) {
        if (err.message?.includes('conflict') || err.message?.includes('modified')) {
          msg = t.order_modified_reload
        } else {
          msg = err.message
        }
      }
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!sessionToken) return
    if (isLastPendable) {
      const confirmed = window.confirm(t.delete_last_item_confirm)
      if (!confirmed) return
      setSaving(true)
      try {
        await cancelMutation.mutateAsync(orderId)
        toast.success(t.toast_item_removed)
        onClose()
      } catch (err) {
        toast.error(
          errorMessage(err, lang === 'vi' ? 'Không thể xoá đơn.' : 'Could not delete order.'),
        )
      } finally {
        setSaving(false)
      }
      return
    }
    setSaving(true)
    const lines: EditOrderLineInput[] = pendableItems
      .filter((i) => i.order_item_id !== item.order_item_id)
      .map(toEditLine)
    const input: EditOrderInput = { version: orderVersion, items: lines }
    try {
      await editMutation.mutateAsync({ orderId, input })
      toast.success(t.toast_item_removed)
      onClose()
    } catch (err) {
      let msg = lang === 'vi' ? 'Không thể xoá món.' : 'Could not remove item.'
      if (err instanceof ApiError) {
        if (err.message?.includes('conflict') || err.message?.includes('modified')) {
          msg = t.order_modified_reload
        } else {
          msg = err.message
        }
      }
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const optionsSummary =
    item.options.length > 0
      ? item.options.map((o) => `${o.name_snapshot} x${o.quantity}`).join(', ')
      : null

  return (
    <>
      <button
        type="button"
        aria-label={lang === 'vi' ? 'Đóng' : 'Close'}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[var(--z-modal)] animate-in fade-in duration-300 w-full border-0 cursor-default"
        onClick={onClose}
      />

      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 max-w-lg mx-auto z-[var(--z-modal)] flex flex-col bg-[var(--bg)] rounded-t-[32px] sm:rounded-[32px] sm:bottom-6 sm:max-h-[70vh] h-auto shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden border border-[var(--separator)]/30',
          open ? 'translate-y-0 opacity-100' : 'translate-y-full sm:translate-y-[120%] opacity-0',
        )}
      >
        <div className="flex items-center justify-center pt-4 pb-2 bg-[var(--material-thin)]/80 backdrop-blur-xl shrink-0 z-10 border-b border-[var(--separator)]/30 relative">
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 rounded-full bg-[var(--text-tertiary)]/30" />
          <div className="mt-4 px-6 w-full flex items-center justify-between pb-2">
            <h2 className="text-[20px] font-extrabold text-[var(--text)] tracking-tight">
              {t.edit_item}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="size-8 rounded-full bg-[var(--surface-grouped)] flex items-center justify-center text-[var(--text-tertiary)] active:scale-90 transition-transform cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5 bg-gradient-to-b from-[var(--surface-grouped)]/30 to-[var(--bg)]">
          <div className="flex gap-4 items-center">
            <div className="relative size-20 rounded-[18px] bg-[var(--surface-grouped)] overflow-hidden shrink-0 shadow-inner">
              <div className="size-full bg-gradient-to-br from-[var(--surface-grouped)] to-[var(--separator)]/30 flex items-center justify-center text-[var(--text-tertiary)]/40">
                <UtensilsCrossed size={24} strokeWidth={1.5} />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-[17px] font-bold text-[var(--text)] leading-tight">{name}</h3>
              <p className="text-[15px] font-black text-[var(--text)] mt-1 tabular-nums">
                {formatVND(item.unit_price_vnd)}
              </p>
            </div>
          </div>

          {optionsSummary && (
            <div className="bg-[var(--surface-grouped)] rounded-[16px] p-4">
              <p className="text-[13px] font-bold text-[var(--text-secondary)] mb-2 uppercase tracking-wide">
                {lang === 'vi' ? 'Tuỳ chọn' : 'Options'}
              </p>
              <p className="text-[14px] font-medium text-[var(--text)]">{optionsSummary}</p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-[13px] font-bold text-[var(--text-secondary)] uppercase tracking-wide">
              {lang === 'vi' ? 'Ghi chú' : 'Note'}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={lang === 'vi' ? 'Ghi chú cho bếp...' : 'Note for the kitchen...'}
              rows={2}
              className="w-full rounded-[16px] bg-[var(--surface-grouped)] border border-[var(--separator)]/30 px-4 py-3 text-[14px] font-medium text-[var(--text)] placeholder-[var(--text-tertiary)] resize-none outline-none transition-all focus:ring-2 focus:ring-[var(--system-blue)]/20 focus:border-[var(--system-blue)]/40"
            />
          </div>

          <div className="flex items-center justify-between bg-[var(--surface-grouped)] rounded-[16px] p-4">
            <span className="text-[15px] font-bold text-[var(--text-secondary)]">
              {lang === 'vi' ? 'Số lượng' : 'Quantity'}
            </span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                disabled={qty <= 0 || saving}
                className="size-10 rounded-full bg-[var(--bg)] flex items-center justify-center text-[var(--text)] shadow-sm active:scale-90 transition-transform cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border border-[var(--separator)]/20"
                onClick={() => setQty(Math.max(0, qty - 1))}
              >
                <Minus size={16} strokeWidth={2.5} />
              </button>
              <span className="text-[20px] font-bold text-[var(--text)] min-w-[32px] text-center tabular-nums">
                {qty}
              </span>
              <button
                type="button"
                disabled={saving}
                className="size-10 rounded-full bg-[var(--bg)] flex items-center justify-center text-[var(--text)] shadow-sm active:scale-90 transition-transform cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed border border-[var(--separator)]/20"
                onClick={() => setQty(qty + 1)}
              >
                <Plus size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {qty === 0 && (
            <div className="bg-[var(--system-red)]/10 text-[var(--system-red)] px-4 py-3 rounded-[16px] text-[13px] font-semibold text-center border border-[var(--system-red)]/20">
              {lang === 'vi'
                ? 'Món này sẽ bị xoá khi lưu.'
                : 'This item will be removed on save.'}
            </div>
          )}
        </div>

        <div className="bg-[var(--material-thin)]/90 backdrop-blur-2xl border-t border-[var(--separator)] shrink-0 z-20 pb-safe">
          <div className="px-6 py-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-bold text-[var(--text-secondary)]">
                {lang === 'vi' ? 'Tổng món' : 'Item total'}
              </span>
              <span className="text-[20px] font-black text-[var(--text)] tabular-nums">
                {formatVND(item.unit_price_vnd * qty)}
              </span>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                disabled={saving}
                className="flex-1 flex h-[52px] items-center justify-center gap-2 rounded-[16px] bg-[var(--system-red)]/10 text-[var(--system-red)] font-bold text-[15px] transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
                onClick={handleDelete}
              >
                <Trash2 size={18} strokeWidth={2.5} />
                {t.delete_item}
              </button>
              <button
                type="button"
                disabled={saving || (qty === item.quantity && note === '')}
                className="flex-[2] flex h-[52px] items-center justify-center rounded-[16px] bg-[var(--text)] text-[var(--bg)] font-bold text-[15px] shadow-lg transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
                onClick={handleSave}
              >
                {saving
                  ? lang === 'vi'
                    ? 'Đang lưu...'
                    : 'Saving...'
                  : t.save}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
