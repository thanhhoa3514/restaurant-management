import { useState, type FC } from 'react'
import { ChevronLeft, Minus, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { useOrdering } from '../hooks/use-ordering'
import { useGuestComboDetail } from '../queries/useGuestCombos'
import { formatVND } from '../helpers'
import type { ApiComboSummary, CartLine, Lang } from '../types'
import { Skeleton } from '@/components/ui/skeleton'

interface ComboDetailProps {
  combo: ApiComboSummary
  lang: Lang
  onClose: () => void
}

export const ComboDetail: FC<ComboDetailProps> = ({ combo, lang, onClose }) => {
  const { state, dispatch } = useOrdering()
  const token = state.session?.accessToken
  const { data, isLoading } = useGuestComboDetail(token, combo.id)
  const [quantity, setQuantity] = useState(1)

  const addToCart = () => {
    const line: CartLine = {
      id: crypto.randomUUID(),
      comboId: combo.id,
      quantity,
      note: '',
      nameSnapshot: combo.name,
      imageUrl: combo.image_url,
      estUnitPriceVnd: combo.combo_price_vnd,
      options: [],
    }
    dispatch({ type: 'ADD_TO_CART', payload: line })
    toast.success(lang === 'vi' ? 'Đã thêm combo vào giỏ' : 'Combo added to cart')
    onClose()
  }

  return (
    <div className="combo-detail">
      <header className="combo-detail__header">
        <button type="button" onClick={onClose} className="combo-detail__back">
          <ChevronLeft size={22} /> {lang === 'vi' ? 'Quay lại' : 'Back'}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label={lang === 'vi' ? 'Đóng' : 'Close'}
          className="combo-detail__close"
        >
          <X size={20} />
        </button>
      </header>
      <main className="combo-detail__main">
        <div className="combo-detail__hero">
          {combo.image_url && (
            <img src={combo.image_url} alt={combo.name} className="size-full object-cover" />
          )}
        </div>
        <p className="combo-detail__kicker">{combo.code}</p>
        <h1 className="combo-detail__title">{combo.name}</h1>
        {combo.description && <p className="combo-detail__description">{combo.description}</p>}
        <div className="combo-detail__price-line">
          <div>
            <p className="combo-detail__price-label">
              {lang === 'vi' ? 'Giá combo' : 'Combo price'}
            </p>
            <p className="combo-detail__price">{formatVND(combo.combo_price_vnd)}</p>
          </div>
          {combo.savings_vnd > 0 && (
            <span className="combo-detail__savings">
              {lang === 'vi' ? 'Tiết kiệm ' : 'Save '}
              {formatVND(combo.savings_vnd)}
            </span>
          )}
        </div>
        <section className="combo-detail__components">
          <h2 className="combo-detail__section-title">
            {lang === 'vi' ? 'Các món trong set' : 'Inside the set'}
          </h2>
          <div className="combo-detail__component-list">
            {isLoading && <Skeleton className="my-4 h-6 w-2/3" />}
            {(data?.components ?? []).map((item) => (
              <div
                key={`${item.menu_item_id}-${item.variant_id ?? ''}`}
                className="combo-detail__component"
              >
                <div className="combo-detail__component-image">
                  {item.image_url && (
                    <img src={item.image_url} alt="" className="size-full object-cover" />
                  )}
                </div>
                <span className="combo-detail__component-name">
                  {item.name}
                  {item.variant_name && <small>{item.variant_name}</small>}
                </span>
                <span className="combo-detail__component-quantity">×{item.quantity}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
      <footer className="combo-detail__footer">
        <div className="combo-detail__quantity">
          <button
            type="button"
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            className="combo-detail__quantity-button"
          >
            <Minus size={16} />
          </button>
          <span className="combo-detail__quantity-value">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((value) => value + 1)}
            className="combo-detail__quantity-button"
          >
            <Plus size={16} />
          </button>
        </div>
        <button type="button" onClick={addToCart} className="combo-detail__submit">
          {lang === 'vi' ? 'Thêm vào giỏ' : 'Add to cart'} ·{' '}
          {formatVND(combo.combo_price_vnd * quantity)}
        </button>
      </footer>
    </div>
  )
}
