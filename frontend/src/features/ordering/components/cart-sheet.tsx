import { useState, type FC } from 'react'
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useOrdering } from '../hooks/use-ordering'
import { DICT } from '../data/i18n'
import { formatVND, summarizeCartLine, cartTotal, totalItems } from '../helpers'
import { placeGuestOrder, type PlaceOrderInput } from '../api'
import { ApiError } from '@/lib/api'
import type { CartLine, Lang } from '../types'
import { Button } from '../../../components/ui/button'
import { Separator } from '../../../components/ui/separator'

interface CartSheetProps {
  open: boolean
  lang: Lang
  onClose: () => void
}

export const CartSheet: FC<CartSheetProps> = ({ open, lang, onClose }) => {
  const { state, dispatch } = useOrdering()
  const queryClient = useQueryClient()
  const t = DICT[lang]
  const [error, setError] = useState('')

  // Pre-submit estimate only — the server computes the authoritative total.
  const subtotal = cartTotal(state.cart)

  const handlePlaceOrder = async () => {
    const sessionToken = state.session?.token
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
      await placeGuestOrder(sessionToken, input)
      await queryClient.invalidateQueries({ queryKey: ['guest-orders', sessionToken] })
      dispatch({ type: 'ORDER_PLACED' })
      dispatch({ type: 'SET_SCREEN', payload: 'order' })
    } catch (err) {
      dispatch({ type: 'PLACE_FAILED' })
      setError(
        err instanceof ApiError
          ? err.message
          : lang === 'vi'
            ? 'Không thể gửi đơn. Vui lòng thử lại.'
            : 'Could not place the order. Please retry.',
      )
    }
  }

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
        <div
          className="fixed inset-0 bg-black/40 z-overlay animate-fade-in"
          onClick={onClose}
        />
      )}

      <div
        className={`fixed bottom-0 left-0 right-0 max-w-lg mx-auto z-overlay flex flex-col bg-background rounded-t-2xl max-h-[85dvh] transition-transform duration-300 ease-out ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
        data-visible={open || undefined}
      >
        <div className="flex items-center justify-center pt-3 pb-1">
          <div className="size-10 rounded-full bg-surface-grouped flex items-center justify-center">
            <div className="w-8 h-1 rounded-full bg-tertiary/40" />
          </div>
        </div>

        <div className="px-4 pb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-primary">{t.your_cart}</h2>
          <span className="text-sm text-tertiary">
            {lang === 'vi' ? `${totalItems(state.cart)} món` : `${totalItems(state.cart)} item${totalItems(state.cart) === 1 ? '' : 's'}`}
          </span>
        </div>

        <Separator />

        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
          {state.cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <ShoppingCart size={32} className="text-quaternary" />
              <p className="text-sm text-tertiary">{t.empty_cart}</p>
              <p className="text-xs text-quaternary">{t.empty_cart_hint}</p>
            </div>
          ) : (
            state.cart.map((line, i) => (
              <CartLineRow key={i} line={line} index={i} onRemove={handleRemove} onQtyChange={handleQtyChange} />
            ))
          )}
        </div>

        {state.cart.length > 0 && (
          <>
            <Separator />

            <div className="px-4 py-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-primary font-semibold">{t.subtotal}</span>
                <span className="text-lg font-semibold text-system-blue tabular-nums">
                  {formatVND(subtotal)}
                </span>
              </div>
              <p className="text-[11px] text-quaternary">
                {lang === 'vi'
                  ? 'Tạm tính, thuế và phí dịch vụ tính khi thanh toán.'
                  : 'Estimate. Tax and service charge are applied at checkout.'}
              </p>
            </div>

            {error && (
              <p className="px-4 pb-2 text-sm text-system-red">{error}</p>
            )}

            <div className="px-4 py-3">
              <Button
                className="w-full rounded-xl h-14 text-base font-semibold"
                size="lg"
                disabled={state.placing}
                onClick={handlePlaceOrder}
              >
                {state.placing ? t.placing_order : t.place_order}
              </Button>
            </div>
          </>
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
    <div className="flex gap-3 items-start py-2">
      <div className="size-14 rounded-xl bg-surface-grouped overflow-hidden shrink-0">
        {line.imageUrl && <img src={line.imageUrl} alt={line.nameSnapshot} className="size-full object-cover" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary truncate">{line.nameSnapshot}</p>
            {summary && (
              <p className="text-[11px] text-tertiary truncate mt-0.5">{summary}</p>
            )}
            {line.note && (
              <p className="text-[11px] text-quaternary italic truncate mt-0.5">{line.note}</p>
            )}
          </div>
          <button
            className="size-7 rounded-full bg-surface-grouped flex items-center justify-center shrink-0 active:scale-90 transition-transform"
            onClick={() => onRemove(index)}
          >
            <Trash2 size={14} className="text-tertiary" />
          </button>
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-2">
            <button
              className="size-7 rounded-full bg-surface-grouped flex items-center justify-center text-primary active:scale-90 transition-transform"
              onClick={() => onQtyChange(index, -1)}
            >
              <Minus size={12} />
            </button>
            <span className="text-sm font-semibold text-primary min-w-5 text-center tabular-nums">
              {line.quantity}
            </span>
            <button
              className="size-7 rounded-full bg-surface-grouped flex items-center justify-center text-primary active:scale-90 transition-transform"
              onClick={() => onQtyChange(index, 1)}
            >
              <Plus size={12} />
            </button>
          </div>
          <span className="text-sm font-semibold text-primary tabular-nums">
            {formatVND(line.estUnitPriceVnd * line.quantity)}
          </span>
        </div>
      </div>
    </div>
  )
}
