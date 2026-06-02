import { useState, useMemo, type FC } from 'react'
import { DICT } from '../data/i18n'
import { MENU } from '../data/menu'
import { priceForItem, defaultSelections } from '../helpers'
import type { MenuItem, CartLine, Lang } from '../types'
import { Button } from '../../../components/ui/button'
import { Badge } from '../../../components/ui/badge'
import { Card } from '../../../components/ui/card'
import { Textarea } from '../../../components/ui/textarea'

interface ItemDetailProps {
  item: MenuItem
  lang: Lang
  onAdd: (line: CartLine) => void
  onClose: () => void
  onSelectItem?: (item: MenuItem) => void
}

export const ItemDetail: FC<ItemDetailProps> = ({ item, lang, onAdd, onClose, onSelectItem }) => {
  const t = DICT[lang]
  const name = lang === 'vi' ? item.name.vi : item.name.en
  const desc = lang === 'vi' ? item.description.vi : item.description.en
  const [selections, setSelections] = useState(() => defaultSelections(item.option_groups))
  const [qty, setQty] = useState(1)
  const [notes, setNotes] = useState('')
  const [activeImage, setActiveImage] = useState(item.image)

  const unitPrice = priceForItem(item, selections)

  const handleSelectOption = (groupId: string, optionId: string, type: 'single' | 'multi') => {
    setSelections((prev) => {
      if (type === 'single') {
        return { ...prev, [groupId]: optionId }
      }
      const current = (prev[groupId] ?? []) as string[]
      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== optionId) }
      }
      return { ...prev, [groupId]: [...current, optionId] }
    })
  }

  const handleAdd = () => {
    onAdd({
      itemId: item.id,
      qty,
      selections,
      notes,
      unitPrice,
    })
    onClose()
  }

  // Smart Recommendation Logic:
  // If looking at a main dish, recommend drinks/desserts.
  // If looking at a drink/dessert, recommend popular main dishes.
  const recommendedItems = useMemo(() => {
    const isDrinkOrDessert = item.category === 'drink' || item.category === 'dessert'
    return MENU.filter((m) => {
      if (m.id === item.id || !m.is_available) return false
      const targetIsDrinkOrDessert = m.category === 'drink' || m.category === 'dessert'
      return isDrinkOrDessert ? !targetIsDrinkOrDessert : targetIsDrinkOrDessert
    }).slice(0, 3)
  }, [item])

  return (
    <div className="fixed inset-0 max-w-lg mx-auto md:left-1/2 md:-translate-x-1/2 z-overlay flex flex-col bg-background animate-in slide-in-from-bottom">
      {/* Main Product Image Container */}
      <div className="relative aspect-[3/2] bg-surface-grouped shrink-0">
        <img src={activeImage} alt={name} className="size-full object-cover" />
        <button
          className="absolute top-4 left-4 size-9 rounded-full bg-background/60 backdrop-blur-md flex items-center justify-center text-primary active:scale-90 transition-transform cursor-pointer"
          onClick={onClose}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        {item.is_bestseller && (
          <Badge className="absolute top-4 right-4 rounded-full bg-system-yellow/90 text-black text-xs font-semibold">
            Bestseller
          </Badge>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
        {/* Sub-Images Gallery Row */}
        {item.sub_images && item.sub_images.length > 0 && (
          <div className="flex gap-2.5 overflow-x-auto py-1 no-scrollbar shrink-0">
            {item.sub_images.map((imgUrl, idx) => {
              const isSelected = activeImage === imgUrl
              return (
                <button
                  key={idx}
                  type="button"
                  className={`relative size-16 shrink-0 rounded-xl overflow-hidden border-2 transition-all active:scale-95 cursor-pointer ${
                    isSelected ? 'border-[var(--system-blue)] scale-[1.04] shadow-sm' : 'border-transparent opacity-65 hover:opacity-90'
                  }`}
                  onClick={() => setActiveImage(imgUrl)}
                >
                  <img src={imgUrl} alt={`${name}-${idx}`} className="size-full object-cover" />
                </button>
              )
            })}
          </div>
        )}

        {/* Item Core Details */}
        <div>
          <h2 className="text-xl font-semibold text-primary">{name}</h2>
          <p className="text-sm text-tertiary mt-1">{desc}</p>
          <p className="text-lg font-semibold text-system-blue mt-2">
            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(unitPrice)}
          </p>
        </div>

        {/* Options Selection Groups */}
        {item.option_groups.map((group) => {
          const gName = lang === 'vi' ? group.name_vi : group.name_en
          return (
            <div key={group.id}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-primary">{gName}</span>
                {group.required && (
                  <span className="text-[10px] text-system-red opacity-70">{t.required}</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {group.options.map((opt) => {
                  const oName = lang === 'vi' ? opt.name_vi : opt.name_en
                  const selected = selections[group.id]
                  const isSelected = Array.isArray(selected)
                    ? selected.includes(opt.id)
                    : selected === opt.id

                  return (
                    <button
                      key={opt.id}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition-all active:scale-95 cursor-pointer ${
                        isSelected
                          ? 'bg-system-blue text-white shadow-sm'
                          : 'bg-surface-grouped text-secondary active:bg-surface-grouped/70'
                      }`}
                      onClick={() => handleSelectOption(group.id, opt.id, group.type)}
                    >
                      {oName}
                      {opt.price_modifier > 0 && (
                        <span className="ml-1 text-[10px] opacity-70">
                          +{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(opt.price_modifier)}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Quantity Selector */}
        <div>
          <span className="text-sm font-medium text-primary mb-2 block">{t.qty}</span>
          <div className="flex items-center gap-3">
            <button
              className="size-9 rounded-full bg-surface-grouped flex items-center justify-center text-primary font-medium active:scale-90 transition-transform disabled:opacity-30 cursor-pointer"
              disabled={qty <= 1}
              onClick={() => setQty((q) => Math.max(1, q - 1))}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14" />
              </svg>
            </button>
            <span className="text-lg font-semibold text-primary min-w-8 text-center tabular-nums">
              {qty}
            </span>
            <button
              className="size-9 rounded-full bg-surface-grouped flex items-center justify-center text-primary font-medium active:scale-90 transition-transform cursor-pointer"
              onClick={() => setQty((q) => q + 1)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        </div>

        {/* Kitchen Notes Input */}
        <div>
          <span className="text-sm font-medium text-primary mb-2 block">{t.notes_label}</span>
          <Textarea
            placeholder={t.notes_placeholder}
            className="rounded-xl resize-none h-20 text-sm"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Dynamic Up-selling/Recommended Items Carousel */}
        {recommendedItems.length > 0 && onSelectItem && (
          <div className="mt-2 mb-4 shrink-0">
            <span className="text-sm font-semibold text-primary mb-3 block">
              {lang === 'vi' ? 'Món uống & Tráng miệng ngon miệng kèm' : 'Perfect Food & Drink Pairings'}
            </span>
            <div className="flex gap-3 overflow-x-auto py-1 no-scrollbar shrink-0">
              {recommendedItems.map((recItem) => {
                const recName = lang === 'vi' ? recItem.name.vi : recItem.name.en
                return (
                  <Card
                    key={recItem.id}
                    className="flex shrink-0 w-64 items-center gap-3 p-2.5 border border-separator bg-elevated/40 active:scale-[0.98] transition-transform cursor-pointer hover:bg-elevated/80"
                    onClick={() => {
                      onSelectItem(recItem)
                      // Reset states for the newly selected item
                      setQty(1)
                      setNotes('')
                      setSelections(defaultSelections(recItem.option_groups))
                      setActiveImage(recItem.image)
                    }}
                  >
                    <div className="size-12 rounded-lg overflow-hidden bg-surface-grouped shrink-0">
                      <img src={recItem.image} alt={recName} className="size-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-semibold text-primary truncate block">{recName}</span>
                      <span className="text-xs font-medium text-system-blue mt-0.5 block">
                        {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(recItem.price)}
                      </span>
                    </div>
                    <span className="text-zinc-400 text-lg shrink-0 mr-1">›</span>
                  </Card>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="sticky bottom-0 px-4 py-3 bg-background/80 backdrop-blur-xl border-t border-separator shrink-0">
        <Button
          className="w-full rounded-xl h-14 text-base font-semibold cursor-pointer"
          size="lg"
          onClick={handleAdd}
        >
          {t.add_to_cart} &middot;{' '}
          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(unitPrice * qty)}
        </Button>
      </div>
    </div>
  )
}
