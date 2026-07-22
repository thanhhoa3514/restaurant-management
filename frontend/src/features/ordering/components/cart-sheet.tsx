import { useState, type FC, useCallback } from 'react'
import { Minus, Plus, ShoppingBag, Trash2, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { useOrdering } from '../hooks/use-ordering'
import { DICT } from '@/i18n'
import { formatVND, summarizeCartLine, cartTotal, totalItems } from '../helpers'
import { usePlaceGuestOrder } from '../mutations/usePlaceGuestOrder'
import { ApiError } from '@/lib/api'
import type { CartLine, Lang, PlaceOrderInput } from '../types'

import { cn } from '@/lib/utils'

interface CartSheetProps {
  open: boolean
  lang: Lang
  onClose: () => void
}

export const CartSheet: FC<CartSheetProps> = ({ open, lang, onClose }) => {
  const { state, dispatch } = useOrdering()
  const t = DICT[lang]
  const [error, setError] = useState('')
  const sessionToken = state.session?.token
  const placeOrderMutation = usePlaceGuestOrder(sessionToken)

  const subtotal = cartTotal(state.cart)
  const cartCount = totalItems(state.cart)

  const handlePlaceOrder = useCallback(async () => {
    if (state.cart.length === 0 || !sessionToken) return
    setError('')
    dispatch({ type: 'PLACE_ORDER' })

    const input: PlaceOrderInput = {
      note: '',
      items: state.cart.map((line) => ({
        menu_item_id: line.menuItemId,
        variant_id: line.variantId,
        quantity: line.quantity,
        note: line.note,
        options: line.options.map((o) => ({ option_id: o.optionId, quantity: o.quantity })),
      })),
    }

    try {
      await placeOrderMutation.mutateAsync(input)
      toast.success(t.toast_order_placed)
      dispatch({ type: 'ORDER_PLACED' })
      dispatch({ type: 'SET_SCREEN', payload: 'order' })
    } catch (err) {
      dispatch({ type: 'PLACE_FAILED' })
      let msg =
        lang === 'vi'
          ? 'Không thể gửi đơn. Vui lòng thử lại.'
          : 'Could not place the order. Please retry.'
      if (err instanceof ApiError) {
        if (err.message === 'session is not accepting orders') {
          msg =
            lang === 'vi'
              ? 'Bàn này đã yêu cầu thanh toán hoặc đã đóng, không thể đặt thêm món.'
              : 'This table has requested the bill or is closed.'
        } else {
          msg = err.message
        }
      }
      setError(msg)
    }
  }, [state.cart, sessionToken, dispatch, placeOrderMutation, t, lang])

  const handleRemove = (index: number) => {
    dispatch({ type: 'REMOVE_CART_LINE', payload: index })
  }

  const handleQtyChange = (index: number, delta: number) => {
    const line = state.cart[index]
    if (!line) return
    const newQty = line.quantity + delta
    if (newQty <= 0) {
      handleRemove(index)
      return
    }
    dispatch({
      type: 'UPDATE_CART_LINE',
      payload: { index, line: { ...line, quantity: newQty } },
    })
  }

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label={lang === 'vi' ? 'Đóng giỏ hàng' : 'Close cart'}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[var(--z-modal)] animate-in fade-in duration-300 w-full border-0 cursor-default"
          onClick={onClose}
        />
      )}

      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 max-w-lg mx-auto z-[var(--z-modal)] flex flex-col bg-[var(--bg)] rounded-t-[32px] sm:rounded-[32px] sm:bottom-6 sm:max-h-[85vh] h-[90dvh] sm:h-auto shadow-2xl transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden border border-[var(--separator)]/30',
          open ? 'translate-y-0 opacity-100' : 'translate-y-full sm:translate-y-[120%] opacity-0',
        )}
      >
        <div className="flex items-center justify-center pt-4 pb-2 bg-[var(--material-thin)]/80 backdrop-blur-xl shrink-0 z-10 border-b border-[var(--separator)]/30 relative">
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 rounded-full bg-[var(--text-tertiary)]/30" />
          <div className="mt-4 px-6 w-full flex items-center justify-between pb-2">
            <h2 className="text-[22px] font-extrabold text-[var(--text)] tracking-tight flex items-center gap-2">
              {t.your_cart}
            </h2>
            <div className="bg-[var(--system-blue)]/10 text-[var(--system-blue)] px-3 py-1 rounded-full text-sm font-bold">
              {lang === 'vi'
                ? `${cartCount} món`
                : `${cartCount} item${cartCount === 1 ? '' : 's'}`}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4 bg-gradient-to-b from-[var(--surface-grouped)]/30 to-[var(--bg)]">
          {state.cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full min-h-[40vh] gap-4">
              <div className="size-24 rounded-full bg-[var(--surface-grouped)] flex items-center justify-center text-[var(--text-tertiary)]/60">
                <ShoppingBag size={48} strokeWidth={1.5} />
              </div>
              <p className="text-[16px] font-semibold text-[var(--text-secondary)]">
                {t.empty_cart}
              </p>
              <p className="text-[14px] text-[var(--text-tertiary)] max-w-[200px] text-center">
                {t.empty_cart_hint}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {state.cart.map((line, i) => (
                <CartLineRow
                  key={line.id ?? `${line.menuItemId}-${i}`}
                  line={line}
                  index={i}
                  onRemove={handleRemove}
                  onQtyChange={handleQtyChange}
                />
              ))}
            </div>
          )}
        </div>

        {state.cart.length > 0 && (
          <div className="bg-[var(--material-thin)]/90 backdrop-blur-2xl border-t border-[var(--separator)] shrink-0 z-20 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.08)]">
            <div className="px-6 py-4 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[15px] font-bold text-[var(--text-secondary)]">
                  {t.subtotal}
                </span>
                <span className="text-[22px] font-black text-[var(--system-blue)] tabular-nums tracking-tight">
                  {formatVND(subtotal)}
                </span>
              </div>
              <p className="text-[12px] font-medium text-[var(--text-tertiary)]">
                {lang === 'vi'
                  ? 'Tạm tính. Thuế và phí dịch vụ tính khi thanh toán.'
                  : 'Estimate. Tax and service charge applied at checkout.'}
              </p>
            </div>

            {error && (
              <div className="px-6 pb-2">
                <div className="bg-[var(--system-red)]/10 text-[var(--system-red)] px-4 py-3 rounded-[16px] text-[13px] font-semibold border border-[var(--system-red)]/20">
                  {error}
                </div>
              </div>
            )}

            <div className="px-6 pb-6 pt-2">
              <button
                type="button"
                disabled={state.placing}
                className="group relative w-full flex h-[60px] items-center justify-center gap-2 overflow-hidden rounded-[20px] bg-[var(--text)] px-8 shadow-xl transition-all active:scale-[0.98] cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                onClick={handlePlaceOrder}
              >
                {!state.placing && (
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                )}
                <span className="font-bold text-[var(--bg)] text-[18px] z-10 flex items-center gap-2">
                  {state.placing ? (
                    t.placing_order
                  ) : (
                    <>
                      {t.place_order}
                      <ChevronRight
                        size={20}
                        className="group-hover:translate-x-1 transition-transform"
                      />
                    </>
                  )}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}

interface CartLineRowProps {
  line: CartLine
  index: number
  onRemove: (index: number) => void
  onQtyChange: (index: number, delta: number) => void
}

const CartLineRow: FC<CartLineRowProps> = ({ line, index, onRemove, onQtyChange }) => {
  const summary = summarizeCartLine(line)

  return (
    <div className="flex gap-4 items-center bg-[var(--bg)] p-4 rounded-[24px] shadow-sm border border-[var(--separator)]/30 group relative">
      <div className="relative size-20 rounded-[18px] bg-[var(--surface-grouped)] overflow-hidden shrink-0 shadow-inner">
        {line.imageUrl ? (
          <img src={line.imageUrl} alt={line.nameSnapshot} className="size-full object-cover" />
        ) : (
          <div className="size-full bg-gradient-to-br from-[var(--surface-grouped)] to-[var(--separator)]/30" />
        )}
      </div>

      <div className="flex-1 min-w-0 py-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 pr-6">
            <h3 className="text-[16px] font-bold text-[var(--text)] leading-tight truncate">
              {line.nameSnapshot}
            </h3>
            {summary && (
              <p className="text-[13px] font-medium text-[var(--text-secondary)] truncate mt-1">
                {summary}
              </p>
            )}
            {line.note && (
              <p className="text-[12px] font-semibold text-[var(--system-orange)] truncate mt-1 bg-[var(--system-orange)]/10 px-2 py-0.5 rounded-md inline-block">
                {line.note}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-end justify-between mt-3">
          <span className="text-[15px] font-black text-[var(--text)] tabular-nums">
            {formatVND(line.estUnitPriceVnd * line.quantity)}
          </span>

          <div className="flex items-center gap-3 bg-[var(--surface-grouped)] rounded-full p-1 shadow-inner border border-[var(--separator)]/20">
            <button
              type="button"
              className="size-8 rounded-full bg-[var(--bg)] flex items-center justify-center text-[var(--text)] shadow-sm active:scale-90 transition-transform cursor-pointer disabled:opacity-50"
              onClick={() => onQtyChange(index, -1)}
            >
              <Minus size={14} strokeWidth={2.5} />
            </button>
            <span className="text-[15px] font-bold text-[var(--text)] min-w-[24px] text-center tabular-nums">
              {line.quantity}
            </span>
            <button
              type="button"
              className="size-8 rounded-full bg-[var(--bg)] flex items-center justify-center text-[var(--text)] shadow-sm active:scale-90 transition-transform cursor-pointer"
              onClick={() => onQtyChange(index, 1)}
            >
              <Plus size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      {/* Delete button positioned absolute on top right */}
      <button
        type="button"
        className="absolute top-3 right-3 size-8 rounded-full bg-[var(--system-red)]/10 flex items-center justify-center text-[var(--system-red)] active:scale-90 transition-transform cursor-pointer hover:bg-[var(--system-red)] hover:text-white"
        onClick={() => onRemove(index)}
      >
        <Trash2 size={14} strokeWidth={2.5} />
      </button>
    </div>
  )
}
