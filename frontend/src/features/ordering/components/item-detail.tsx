import { useEffect, useMemo, useState, type FC } from 'react'
import { ChevronLeft, Minus, Plus, X } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useOrdering } from '../hooks/use-ordering'
import { DICT } from '../data/i18n'
import { formatVND } from '../helpers'
import { fetchMenuItem, type ApiOptionGroup } from '../api'
import type { CartLine, CartOption, Lang } from '../types'
import { Button } from '../../../components/ui/button'
import { Skeleton } from '../../../components/ui/skeleton'
import { Textarea } from '../../../components/ui/textarea'
import { cn } from '../../../lib/utils'

interface ItemDetailProps {
  itemId: string
  lang: Lang
  onClose: () => void
}

type Selections = Record<string, string | string[]>

function defaultSelections(groups: ApiOptionGroup[]): Selections {
  const sel: Selections = {}
  for (const g of groups) {
    if (g.selection_type === 'SINGLE') {
      let def: typeof g.options[0] | undefined
      for (const o of g.options) {
        if (o.is_default) { def = o; break; }
      }
      sel[g.id] = def?.id ?? (g.is_required ? g.options[0]?.id : '') ?? ''
    } else {
      sel[g.id] = g.options.reduce<string[]>((acc, o) => {
        if (o.is_default) acc.push(o.id)
        return acc
      }, [])
    }
  }
  return sel
}

interface FormState {
  variantId: string;
  selections: Selections;
  qty: number;
  notes: string;
  activeImage: string;
}

export const ItemDetail: FC<ItemDetailProps> = ({ itemId, lang, onClose }) => {
  const { state, dispatch } = useOrdering()
  const t = DICT[lang]
  const sessionToken = state.session?.token

  const { data: item, isLoading: isItemLoading } = useQuery({
    queryKey: ['guest-item', sessionToken, itemId],
    queryFn: () => fetchMenuItem(sessionToken!, itemId),
    enabled: !!sessionToken,
  })

  const [form, setForm] = useState<FormState>({
    variantId: '',
    selections: {},
    qty: 1,
    notes: '',
    activeImage: ''
  })

  useEffect(() => {
    if (!item) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      const defVariant = item.variants.find((v) => v.is_default) ?? item.variants[0]
      setForm({
        variantId: defVariant?.id ?? '',
        selections: defaultSelections(item.option_groups),
        activeImage: item.image_url,
        qty: 1,
        notes: ''
      })
    })
    return () => {
      cancelled = true
    }
  }, [item])

  const estUnitPrice = useMemo(() => {
    if (!item) return 0
    const variant = item.variants.find((v) => v.id === form.variantId)
    let total = variant ? variant.price_vnd : item.base_price_vnd
    const optMap = new Map()
    for (const g of item.option_groups) {
      for (const o of g.options) optMap.set(o.id, o)
    }
    for (const g of item.option_groups) {
      const sel = form.selections[g.id]
      const ids = Array.isArray(sel) ? sel : sel ? [sel] : []
      for (const id of ids) {
        const opt = optMap.get(id)
        if (opt) total += opt.price_delta_vnd
      }
    }
    return total
  }, [item, form.variantId, form.selections])

  const handleSelectOption = (group: ApiOptionGroup, optionId: string) => {
    setForm((prev) => {
      let newSel: Selections;
      if (group.selection_type === 'SINGLE') {
        newSel = { ...prev.selections, [group.id]: optionId }
      } else {
        const current = (prev.selections[group.id] ?? []) as string[]
        if (current.includes(optionId)) {
          newSel = { ...prev.selections, [group.id]: current.filter((id) => id !== optionId) }
        } else {
          newSel = { ...prev.selections, [group.id]: [...current, optionId] }
        }
      }
      return { ...prev, selections: newSel }
    })
  }

  const handleAdd = () => {
    if (!item) return
    const variant = item.variants.find((v) => v.id === form.variantId)
    const options: CartOption[] = []
    const optMap = new Map()
    for (const g of item.option_groups) {
      for (const o of g.options) optMap.set(o.id, o)
    }
    for (const g of item.option_groups) {
      const sel = form.selections[g.id]
      const ids = Array.isArray(sel) ? sel : sel ? [sel] : []
      for (const id of ids) {
        const opt = optMap.get(id)
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
      id: crypto.randomUUID(),
      menuItemId: item.id,
      variantId: variant?.id,
      variantNameSnapshot: variant?.name,
      quantity: form.qty,
      note: form.notes,
      nameSnapshot: item.name,
      imageUrl: item.image_url,
      estUnitPriceVnd: estUnitPrice,
      options,
    }
    dispatch({ type: 'ADD_TO_CART', payload: line })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[var(--z-modal)] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div 
        className="absolute inset-0 z-0 cursor-pointer" 
        onClick={onClose} 
        aria-hidden="true" 
      />
      
      <div className="relative z-10 flex w-full max-w-lg flex-col bg-[var(--bg)] rounded-t-[32px] sm:rounded-[32px] h-[92dvh] sm:h-auto sm:max-h-[90vh] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-500">
        
        {isItemLoading || !item ? (
          <div className="flex flex-col gap-5 p-6 h-full">
            <Skeleton className="aspect-square sm:aspect-[4/3] rounded-2xl" />
            <Skeleton className="h-8 w-3/4 rounded-lg" />
            <Skeleton className="h-4 w-full rounded-md" />
            <Skeleton className="h-4 w-2/3 rounded-md" />
            <div className="mt-auto pt-4">
              <Skeleton className="h-14 w-full rounded-2xl" />
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col relative pb-4">
              
              {/* Header Image Section */}
              <div className="relative aspect-square sm:aspect-[4/3] bg-[var(--surface-grouped)] shrink-0">
                {form.activeImage ? (
                  <>
                    <img src={form.activeImage} alt={item.name} className="size-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg)] via-transparent to-transparent opacity-90" />
                  </>
                ) : (
                  <div className="size-full bg-gradient-to-br from-[var(--surface-grouped)] to-[var(--separator)]/30" />
                )}
                
                {/* Floating Navigation Controls */}
                <div className="absolute top-4 left-4 right-4 flex justify-between items-start">
                  <button
                    type="button"
                    className="size-11 rounded-full bg-black/30 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white active:scale-90 transition-transform cursor-pointer shadow-lg"
                    onClick={onClose}
                  >
                    <ChevronLeft size={24} strokeWidth={2.5} />
                  </button>
                  <button
                    type="button"
                    className="size-11 rounded-full bg-black/30 backdrop-blur-xl border border-white/10 flex items-center justify-center text-white active:scale-90 transition-transform cursor-pointer shadow-lg sm:hidden"
                    onClick={onClose}
                  >
                    <X size={20} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              <div className="px-5 -mt-12 relative z-10 flex flex-col gap-6">
                {/* Image Gallery Thumbnails */}
                {item.images.length > 1 && (
                  <div className="flex gap-3 overflow-x-auto py-2 no-scrollbar shrink-0">
                    {item.images.map((imgUrl, idx) => {
                      const isSelected = form.activeImage === imgUrl
                      return (
                        <button
                          key={imgUrl}
                          type="button"
                          className={cn(
                            "relative size-16 shrink-0 rounded-[18px] overflow-hidden transition-all active:scale-95 cursor-pointer border-2 shadow-sm",
                            isSelected 
                              ? "border-[var(--system-blue)] scale-[1.05] ring-2 ring-[var(--system-blue)]/20" 
                              : "border-transparent opacity-80 hover:opacity-100"
                          )}
                          onClick={() => setForm(prev => ({ ...prev, activeImage: imgUrl }))}
                        >
                          <img src={imgUrl} alt={`${item.name}-${idx}`} className="size-full object-cover" />
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Title and Price */}
                <div className="bg-[var(--material-thin)]/50 backdrop-blur-xl border border-[var(--separator)] rounded-[24px] p-5 shadow-sm mt-2">
                  <h2 className="text-2xl font-extrabold text-[var(--text)] tracking-tight leading-tight">{item.name}</h2>
                  {item.description && <p className="text-[14px] text-[var(--text-secondary)] mt-2 font-medium leading-relaxed">{item.description}</p>}
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-[13px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider">
                      {lang === 'vi' ? 'Đơn giá' : 'Unit Price'}
                    </span>
                    <p className="text-xl font-black text-[var(--system-blue)]">{formatVND(estUnitPrice)}</p>
                  </div>
                </div>

                {/* Variant selector */}
                {item.variants.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-bold text-[var(--text)] tracking-wide">
                        {lang === 'vi' ? 'Lựa chọn kích cỡ / loại' : 'Variant Selection'}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-[var(--system-red)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--system-red)]">
                        {t.required}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {item.variants.map((v) => {
                        const isSelected = form.variantId === v.id
                        return (
                          <button
                            key={v.id}
                            type="button"
                            disabled={!v.is_available}
                            className={cn(
                              "flex flex-col items-start justify-center rounded-[20px] p-4 transition-all duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-40 border-2",
                              isSelected 
                                ? "bg-[var(--system-blue)]/5 border-[var(--system-blue)] text-[var(--system-blue)]" 
                                : "bg-[var(--surface-grouped)] border-transparent text-[var(--text-secondary)] hover:bg-[var(--separator)]/50"
                            )}
                            onClick={() => setForm(prev => ({ ...prev, variantId: v.id }))}
                          >
                            <span className="font-bold text-[15px]">{v.name} {v.unit ? `(${v.unit})` : ''}</span>
                            <span className="text-xs font-semibold opacity-80 mt-1">{formatVND(v.price_vnd)}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Option groups */}
                {item.option_groups.map((group) => (
                  <div key={group.id} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-bold text-[var(--text)] tracking-wide">{group.name}</span>
                      {group.is_required && (
                        <span className="inline-flex items-center rounded-full bg-[var(--system-red)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--system-red)]">
                          {t.required}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      {group.options.map((opt) => {
                        const sel = form.selections[group.id]
                        const isSelected = Array.isArray(sel) ? sel.includes(opt.id) : sel === opt.id
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={!opt.is_available}
                            className={cn(
                              "flex items-center gap-2 rounded-full px-5 py-2.5 text-[14px] font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-40 border-2",
                              isSelected 
                                ? "bg-[var(--text)] border-[var(--text)] text-[var(--bg)] shadow-md" 
                                : "bg-transparent border-[var(--separator)] text-[var(--text-secondary)] hover:bg-[var(--surface-grouped)]"
                            )}
                            onClick={() => handleSelectOption(group, opt.id)}
                          >
                            <span>{opt.name}</span>
                            {opt.price_delta_vnd > 0 && (
                              <span className={cn(
                                "text-[11px] px-1.5 py-0.5 rounded-md",
                                isSelected ? "bg-[var(--bg)]/20" : "bg-[var(--surface-grouped)]"
                              )}>
                                +{formatVND(opt.price_delta_vnd)}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}

                {/* Quantity and Notes Panel */}
                <div className="bg-[var(--surface-grouped)]/50 rounded-[24px] p-5 space-y-5 border border-[var(--separator)]/50">
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] font-bold text-[var(--text)] tracking-wide">{t.qty}</span>
                    <div className="flex items-center gap-4 bg-[var(--bg)] rounded-full p-1 shadow-sm border border-[var(--separator)]/50">
                      <button
                        type="button"
                        className="size-10 rounded-full bg-transparent flex items-center justify-center text-[var(--text)] font-medium active:scale-90 transition-all disabled:opacity-30 cursor-pointer hover:bg-[var(--surface-grouped)]"
                        disabled={form.qty <= 1}
                        onClick={() => setForm(prev => ({ ...prev, qty: Math.max(1, prev.qty - 1) }))}
                      >
                        <Minus size={18} strokeWidth={2.5} />
                      </button>
                      <span className="text-[18px] font-black text-[var(--text)] min-w-[28px] text-center tabular-nums">{form.qty}</span>
                      <button
                        type="button"
                        className="size-10 rounded-full bg-transparent flex items-center justify-center text-[var(--text)] font-medium active:scale-90 transition-all cursor-pointer hover:bg-[var(--surface-grouped)]"
                        onClick={() => setForm(prev => ({ ...prev, qty: prev.qty + 1 }))}
                      >
                        <Plus size={18} strokeWidth={2.5} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="text-[13px] font-bold text-[var(--text-tertiary)] uppercase tracking-wider block">{t.notes_label}</span>
                    <Textarea
                      placeholder={t.notes_placeholder}
                      className="rounded-[16px] resize-none h-24 text-[14px] bg-[var(--bg)] border-[var(--separator)]/50 focus:bg-[var(--bg)] focus:ring-[var(--system-blue)]/20 transition-all font-medium placeholder:font-normal"
                      value={form.notes}
                      onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>
                </div>
                
                {/* Spacer to push content above fixed bottom bar */}
                <div className="h-4" />
              </div>
            </div>

            {/* Bottom Action Bar */}
            <div className="p-4 sm:p-5 bg-[var(--material-thin)]/80 backdrop-blur-2xl border-t border-[var(--separator)] shrink-0 z-20 shadow-[0_-10px_40px_rgba(0,0,0,0.08)]">
              <button
                className="group relative w-full flex h-14 sm:h-16 items-center justify-center gap-2 overflow-hidden rounded-[20px] sm:rounded-2xl bg-[var(--text)] px-8 shadow-xl transition-all active:scale-[0.98] cursor-pointer"
                onClick={handleAdd}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                <span className="font-bold text-[var(--bg)] text-[16px] sm:text-[18px] z-10">{t.add_to_cart}</span>
                <span className="font-medium text-[var(--bg)]/60 mx-1 z-10">&middot;</span>
                <span className="font-black text-[var(--bg)] text-[16px] sm:text-[18px] z-10">{formatVND(estUnitPrice * form.qty)}</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
