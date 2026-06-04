import { useEffect, useMemo, useState, type FC } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useOrdering } from '../hooks/use-ordering'
import { DICT } from '../data/i18n'
import { formatVND } from '../helpers'
import { fetchMenuItem, type ApiOptionGroup } from '../api'
import type { CartLine, CartOption, Lang } from '../types'
import { Button } from '../../../components/ui/button'
import { Skeleton } from '../../../components/ui/skeleton'
import { Textarea } from '../../../components/ui/textarea'

interface ItemDetailProps {
  itemId: string
  lang: Lang
  onClose: () => void
}

// selections: groupId -> optionId (SINGLE) or optionId[] (MULTIPLE)
type Selections = Record<string, string | string[]>

function defaultSelections(groups: ApiOptionGroup[]): Selections {
  const sel: Selections = {}
  for (const g of groups) {
    if (g.selection_type === 'SINGLE') {
      const def = g.options.find((o) => o.is_default) ?? (g.is_required ? g.options[0] : undefined)
      sel[g.id] = def?.id ?? ''
    } else {
      sel[g.id] = g.options.filter((o) => o.is_default).map((o) => o.id)
    }
  }
  return sel
}

export const ItemDetail: FC<ItemDetailProps> = ({ itemId, lang, onClose }) => {
  const { state, dispatch } = useOrdering()
  const t = DICT[lang]
  const sessionToken = state.session?.token

  const detailQuery = useQuery({
    queryKey: ['guest-item', sessionToken, itemId],
    queryFn: () => fetchMenuItem(sessionToken!, itemId),
    enabled: !!sessionToken,
  })

  const item = detailQuery.data

  const [variantId, setVariantId] = useState<string>('')
  const [selections, setSelections] = useState<Selections>({})
  const [qty, setQty] = useState(1)
  const [notes, setNotes] = useState('')
  const [activeImage, setActiveImage] = useState('')

  // Initialise selections + defaults once the detail loads.
  useEffect(() => {
    if (!item) return
    const defVariant = item.variants.find((v) => v.is_default) ?? item.variants[0]
    setVariantId(defVariant?.id ?? '')
    setSelections(defaultSelections(item.option_groups))
    setActiveImage(item.image_url)
    setQty(1)
    setNotes('')
  }, [item])

  const estUnitPrice = useMemo(() => {
    if (!item) return 0
    const variant = item.variants.find((v) => v.id === variantId)
    let total = variant ? variant.price_vnd : item.base_price_vnd
    for (const g of item.option_groups) {
      const sel = selections[g.id]
      const ids = Array.isArray(sel) ? sel : sel ? [sel] : []
      for (const id of ids) {
        const opt = g.options.find((o) => o.id === id)
        if (opt) total += opt.price_delta_vnd
      }
    }
    return total
  }, [item, variantId, selections])

  const handleSelectOption = (group: ApiOptionGroup, optionId: string) => {
    setSelections((prev) => {
      if (group.selection_type === 'SINGLE') {
        return { ...prev, [group.id]: optionId }
      }
      const current = (prev[group.id] ?? []) as string[]
      if (current.includes(optionId)) {
        return { ...prev, [group.id]: current.filter((id) => id !== optionId) }
      }
      return { ...prev, [group.id]: [...current, optionId] }
    })
  }

  const handleAdd = () => {
    if (!item) return
    const variant = item.variants.find((v) => v.id === variantId)
    const options: CartOption[] = []
    for (const g of item.option_groups) {
      const sel = selections[g.id]
      const ids = Array.isArray(sel) ? sel : sel ? [sel] : []
      for (const id of ids) {
        const opt = g.options.find((o) => o.id === id)
        if (opt) {
          options.push({
            optionId: opt.id,
            groupId: g.id,
            nameSnapshot: opt.name,
            priceDeltaVnd: opt.price_delta_vnd,
            quantity: 1,
          })
        }
      }
    }
    const line: CartLine = {
      menuItemId: item.id,
      variantId: variant?.id,
      variantNameSnapshot: variant?.name,
      quantity: qty,
      note: notes,
      nameSnapshot: item.name,
      imageUrl: item.image_url,
      estUnitPriceVnd: estUnitPrice,
      options,
    }
    dispatch({ type: 'ADD_TO_CART', payload: line })
    onClose()
  }

  return (
    <div className="fixed inset-0 max-w-lg mx-auto md:left-1/2 md:-translate-x-1/2 z-overlay flex flex-col bg-background animate-in slide-in-from-bottom">
      {detailQuery.isLoading || !item ? (
        <div className="flex flex-col gap-4 p-4">
          <Skeleton className="aspect-[3/2] rounded-xl" />
          <Skeleton className="h-6 w-2/3 rounded" />
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Button variant="ghost" className="self-start" onClick={onClose}>
            {lang === 'vi' ? 'Đóng' : 'Close'}
          </Button>
        </div>
      ) : (
        <>
          <div className="relative aspect-[3/2] bg-surface-grouped shrink-0">
            {activeImage ? (
              <img src={activeImage} alt={item.name} className="size-full object-cover" />
            ) : (
              <div className="size-full bg-surface-grouped" />
            )}
            <button
              className="absolute top-4 left-4 size-9 rounded-full bg-background/60 backdrop-blur-md flex items-center justify-center text-primary active:scale-90 transition-transform cursor-pointer"
              onClick={onClose}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
            {item.images.length > 0 && (
              <div className="flex gap-2.5 overflow-x-auto py-1 no-scrollbar shrink-0">
                {item.images.map((imgUrl, idx) => {
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
                      <img src={imgUrl} alt={`${item.name}-${idx}`} className="size-full object-cover" />
                    </button>
                  )
                })}
              </div>
            )}

            <div>
              <h2 className="text-xl font-semibold text-primary">{item.name}</h2>
              {item.description && <p className="text-sm text-tertiary mt-1">{item.description}</p>}
              <p className="text-lg font-semibold text-system-blue mt-2">{formatVND(estUnitPrice)}</p>
            </div>

            {/* Variant selector (required single-select) */}
            {item.variants.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-primary">
                    {lang === 'vi' ? 'Lựa chọn' : 'Variant'}
                  </span>
                  <span className="text-[10px] text-system-red opacity-70">{t.required}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.variants.map((v) => {
                    const isSelected = variantId === v.id
                    return (
                      <button
                        key={v.id}
                        disabled={!v.is_available}
                        className={`rounded-full px-4 py-2 text-sm font-medium transition-all active:scale-95 cursor-pointer disabled:opacity-40 ${
                          isSelected ? 'bg-system-blue text-white shadow-sm' : 'bg-surface-grouped text-secondary active:bg-surface-grouped/70'
                        }`}
                        onClick={() => setVariantId(v.id)}
                      >
                        {v.name}
                        {v.unit ? ` (${v.unit})` : ''}
                        <span className="ml-1 text-[10px] opacity-70">{formatVND(v.price_vnd)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Option groups */}
            {item.option_groups.map((group) => (
              <div key={group.id}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-primary">{group.name}</span>
                  {group.is_required && (
                    <span className="text-[10px] text-system-red opacity-70">{t.required}</span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.options.map((opt) => {
                    const sel = selections[group.id]
                    const isSelected = Array.isArray(sel) ? sel.includes(opt.id) : sel === opt.id
                    return (
                      <button
                        key={opt.id}
                        disabled={!opt.is_available}
                        className={`rounded-full px-4 py-2 text-sm font-medium transition-all active:scale-95 cursor-pointer disabled:opacity-40 ${
                          isSelected ? 'bg-system-blue text-white shadow-sm' : 'bg-surface-grouped text-secondary active:bg-surface-grouped/70'
                        }`}
                        onClick={() => handleSelectOption(group, opt.id)}
                      >
                        {opt.name}
                        {opt.price_delta_vnd > 0 && (
                          <span className="ml-1 text-[10px] opacity-70">+{formatVND(opt.price_delta_vnd)}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* Quantity */}
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
                <span className="text-lg font-semibold text-primary min-w-8 text-center tabular-nums">{qty}</span>
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

            {/* Notes */}
            <div>
              <span className="text-sm font-medium text-primary mb-2 block">{t.notes_label}</span>
              <Textarea
                placeholder={t.notes_placeholder}
                className="rounded-xl resize-none h-20 text-sm"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>

          <div className="sticky bottom-0 px-4 py-3 bg-background/80 backdrop-blur-xl border-t border-separator shrink-0">
            <Button
              className="w-full rounded-xl h-14 text-base font-semibold cursor-pointer"
              size="lg"
              onClick={handleAdd}
            >
              {t.add_to_cart} &middot; {formatVND(estUnitPrice * qty)}
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
