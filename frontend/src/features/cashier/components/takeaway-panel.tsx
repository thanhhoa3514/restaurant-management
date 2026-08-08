import { useCallback, useEffect, useMemo, useState, type FC } from 'react'
import {
  Loader2,
  Plus,
  Search,
  ShoppingCart,
  X,
  Minus,
  Trash2,
  ShoppingBag,
  ImageOff,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useAllMenuItemsQuery, useCategoriesQuery } from '@/features/catalog/queries'
import type { AdminMenuItemSummaryDTO, AdminCategoryDTO } from '@/features/catalog/types'
import type { StaffTakeawayInput } from '@/features/cashier/api'
import { useAddSessionTakeawayItems } from '@/features/cashier/mutations/useAddSessionTakeawayItems'
import { usePlaceTakeawayOrder } from '@/features/cashier/mutations/usePlaceTakeawayOrder'
import { fmtVND } from '@/features/cashier/helpers'
import { LIST_CARD } from '@/features/cashier/components/panel-styles'
import { errorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'

interface TakeawayPanelProps {
  lang: 'vi' | 'en'
  t: (key: string, ...args: Array<string | number>) => string
  compact?: boolean
  sessionId?: string
  tableLabel?: string
  /* trigger-button overrides — cashier drops the orange fill to sit in its neutral toolbar */
  className?: string
}

interface CartLine {
  menu_item_id: string
  name: string
  quantity: number
  unit_price_vnd: number
  note: string
  options: { option_id: string; quantity: number }[]
}

const SECTION_LABEL = 'text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]'

export const TakeawayPanel: FC<TakeawayPanelProps> = ({
  t,
  compact,
  className,
  sessionId,
  tableLabel,
}) => {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined)
  const [cart, setCart] = useState<CartLine[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const takeawayMutation = usePlaceTakeawayOrder()
  const sessionTakeawayMutation = useAddSessionTakeawayItems()
  const isSessionTakeaway = Boolean(sessionId)
  const isPending = isSessionTakeaway
    ? sessionTakeawayMutation.isPending
    : takeawayMutation.isPending
  const panelTitle = isSessionTakeaway
    ? t('takeaway_for_table', tableLabel ?? '')
    : t('takeaway_order')

  const { data: categories = [], error: categoriesError } = useCategoriesQuery()
  const {
    data: items = [],
    isLoading: itemsLoading,
    error: itemsError,
  } = useAllMenuItemsQuery(categoryId, { enabled: open })

  useEffect(() => {
    const loadError = categoriesError ?? itemsError
    if (!open || !loadError) return
    toast.error(errorMessage(loadError, t('toast_takeaway_menu_failed')), {
      id: 'takeaway-menu-load-error',
    })
  }, [categoriesError, itemsError, open, t])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items.filter((it: AdminMenuItemSummaryDTO) => it.is_available)
    return items.filter(
      (it: AdminMenuItemSummaryDTO) => it.name.toLowerCase().includes(q) && it.is_available,
    )
  }, [items, search])

  const addToCart = useCallback((item: AdminMenuItemSummaryDTO) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.menu_item_id === item.id)
      if (existing) {
        return prev.map((l) =>
          l.menu_item_id === item.id ? { ...l, quantity: l.quantity + 1 } : l,
        )
      }
      return [
        ...prev,
        {
          menu_item_id: item.id,
          name: item.name,
          quantity: 1,
          unit_price_vnd: item.base_price_vnd,
          note: '',
          options: [],
        },
      ]
    })
  }, [])

  const updateQty = useCallback((id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) =>
          l.menu_item_id === id ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l,
        )
        .filter((l) => l.quantity > 0),
    )
  }, [])

  const totalItems = useMemo(() => cart.reduce((s, l) => s + l.quantity, 0), [cart])
  const totalVND = useMemo(
    () => cart.reduce((s, l) => s + l.unit_price_vnd * l.quantity, 0),
    [cart],
  )
  /* lets a menu tile show what is already in the cart instead of a hover-only affordance */
  const cartQty = useMemo(() => new Map(cart.map((l) => [l.menu_item_id, l.quantity])), [cart])

  const reset = useCallback(() => {
    setCart([])
    setCustomerName('')
    setCustomerPhone('')
    setSearch('')
    setCategoryId(undefined)
  }, [])

  const close = useCallback(() => {
    setOpen(false)
    reset()
  }, [reset])

  const handleSubmit = useCallback(() => {
    if (cart.length === 0) return
    if (!isSessionTakeaway && !customerName.trim()) {
      toast.error(t('takeaway_name_required'))
      return
    }

    const items = cart.map((line) => ({
      menu_item_id: line.menu_item_id,
      quantity: line.quantity,
      note: line.note,
      options: line.options,
    }))
    const handleSuccess = (result: { order_number: string; total_vnd: number }) => {
      toast.success(
        isSessionTakeaway
          ? `${t('takeaway_added_to_table')} — ${fmtVND(result.total_vnd)}`
          : `${t('takeaway_order_placed')} #${result.order_number} — ${fmtVND(result.total_vnd)}`,
      )
      reset()
      setOpen(false)
    }
    const handleError = (err: unknown) => {
      toast.error(errorMessage(err, t('toast_takeaway_failed')), {
        id: 'takeaway-create-error',
      })
    }

    if (sessionId) {
      sessionTakeawayMutation.mutate(
        { sessionId, input: { items } },
        { onSuccess: handleSuccess, onError: handleError },
      )
      return
    }

    const input: StaffTakeawayInput = {
      items,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
    }
    takeawayMutation.mutate(input, {
      onSuccess: handleSuccess,
      onError: handleError,
    })
  }, [
    cart,
    customerName,
    customerPhone,
    isSessionTakeaway,
    reset,
    sessionId,
    sessionTakeawayMutation,
    t,
    takeawayMutation,
  ])

  return (
    <>
      <Button
        className={cn(
          compact
            ? 'rounded-xl gap-1.5 font-semibold h-9 px-3 text-xs shadow-sm transition-all hover:shadow-md bg-[var(--system-orange)] hover:bg-[var(--system-orange)]/90 text-white shrink-0'
            : 'w-full rounded-2xl gap-2 font-semibold h-12 shadow-sm transition-all hover:shadow-md bg-[var(--system-orange)] hover:bg-[var(--system-orange)]/90 text-white',
          className,
        )}
        onClick={() => setOpen(true)}
      >
        <ShoppingCart className={compact ? 'size-4' : 'size-5'} />
        {isSessionTakeaway ? t('takeaway_add_to_table') : t('takeaway_order')}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (v) setOpen(true)
          else close()
        }}
      >
        <DialogContent
          showCloseButton={false}
          className="max-h-[95dvh] w-[95vw] sm:max-w-[95vw] md:max-w-5xl lg:max-w-6xl xl:max-w-7xl gap-0 overflow-hidden rounded-3xl p-0 shadow-2xl border border-[var(--separator)] bg-[var(--background)]"
        >
          <DialogTitle className="sr-only">{panelTitle}</DialogTitle>
          <div className="flex h-[90dvh] flex-col md:flex-row">
            {/* LEFT PANEL: menu */}
            <div className="flex min-h-0 flex-1 flex-col bg-[var(--background)]">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--separator)] px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <ShoppingBag className="size-5 text-[var(--text-secondary)]" />
                  <h2 className="text-lg font-semibold tracking-tight text-[var(--text)]">
                    {panelTitle}
                  </h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('takeaway_cancel')}
                  className="rounded-full text-[var(--text-tertiary)] md:hidden"
                  onClick={close}
                >
                  <X className="size-5" />
                </Button>
              </div>

              <div className="space-y-3 border-b border-[var(--separator)] px-5 py-4">
                <div className="relative max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
                  <Input
                    placeholder={t('takeaway_search')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 pr-9"
                  />
                  {search ? (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('takeaway_search_clear')}
                      className="absolute right-1 top-1/2 size-8 -translate-y-1/2 rounded-full text-[var(--text-tertiary)]"
                      onClick={() => setSearch('')}
                    >
                      <X className="size-4" />
                    </Button>
                  ) : null}
                </div>

                {/* real buttons, not click-handling badges — these are keyboard-reachable filters */}
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  <CategoryChip
                    active={!categoryId}
                    label={t('takeaway_all')}
                    onClick={() => setCategoryId(undefined)}
                  />
                  {categories.map((cat: AdminCategoryDTO) => (
                    <CategoryChip
                      key={cat.id}
                      active={categoryId === cat.id}
                      label={cat.name}
                      onClick={() => setCategoryId(cat.id)}
                    />
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto bg-[var(--surface-grouped)] p-5">
                {itemsLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="size-8 animate-spin text-[var(--text-tertiary)]" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 text-[var(--text-tertiary)]">
                    <Search className="size-8" />
                    <p className="text-base font-medium text-[var(--text)]">
                      {t('takeaway_no_items')}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
                    {filtered.map((item: AdminMenuItemSummaryDTO) => (
                      <MenuTile
                        key={item.id}
                        item={item}
                        qty={cartQty.get(item.id) ?? 0}
                        onAdd={() => addToCart(item)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT PANEL: cart + customer */}
            <div className="flex min-h-0 w-full shrink-0 flex-col border-t border-[var(--separator)] bg-[var(--background)] md:w-[380px] md:border-l md:border-t-0">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--separator)] px-5 py-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-[var(--text)]">
                    {t('takeaway_cart')}
                  </h3>
                  {totalItems > 0 ? (
                    <Badge variant="secondary" className="tabular-nums">
                      {totalItems} {t('takeaway_items')}
                    </Badge>
                  ) : null}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('takeaway_cancel')}
                  className="hidden rounded-full text-[var(--text-tertiary)] md:inline-flex"
                  onClick={close}
                >
                  <X className="size-5" />
                </Button>
              </div>

              {isSessionTakeaway ? (
                <div className="border-b border-[var(--separator)] px-5 py-4">
                  <div className={SECTION_LABEL}>{t('takeaway_bill_link')}</div>
                  <p className="mt-1 text-sm leading-5 text-[var(--text-secondary)]">
                    {t('takeaway_bill_link_hint')}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 border-b border-[var(--separator)] px-5 py-4">
                  <div className={SECTION_LABEL}>{t('takeaway_customer_info')}</div>
                  <Input
                    placeholder={t('takeaway_customer_name')}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                  <Input
                    placeholder={t('takeaway_customer_phone')}
                    inputMode="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                  />
                </div>
              )}

              <div className="flex-1 overflow-y-auto px-5 py-4">
                {cart.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-[var(--text-tertiary)]">
                    <ShoppingCart className="size-8" />
                    <p className="text-base font-medium text-[var(--text)]">
                      {t('takeaway_cart_empty')}
                    </p>
                    <p className="text-sm">{t('takeaway_cart_empty_hint')}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cart.map((line) => (
                      <div
                        key={line.menu_item_id}
                        className={`rounded-[var(--radius-xl)] border border-[var(--separator)] p-3 ${LIST_CARD}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-[var(--text)]">
                              {line.name}
                            </div>
                            <div className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                              {fmtVND(line.unit_price_vnd)}
                            </div>
                          </div>
                          <div className="shrink-0 text-sm font-bold tabular-nums text-[var(--text)]">
                            {fmtVND(line.unit_price_vnd * line.quantity)}
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="-ml-2 px-2 text-[var(--system-red)] hover:bg-[var(--system-red)]/10"
                            onClick={() => updateQty(line.menu_item_id, -line.quantity)}
                          >
                            <Trash2 />
                            {t('takeaway_remove')}
                          </Button>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="secondary"
                              size="icon-sm"
                              aria-label="-1"
                              onClick={() => updateQty(line.menu_item_id, -1)}
                            >
                              <Minus />
                            </Button>
                            <span className="w-8 text-center text-sm font-bold tabular-nums text-[var(--text)]">
                              {line.quantity}
                            </span>
                            <Button
                              variant="secondary"
                              size="icon-sm"
                              aria-label="+1"
                              onClick={() => updateQty(line.menu_item_id, 1)}
                            >
                              <Plus />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-[var(--separator)] bg-[var(--surface-grouped)] px-5 py-4">
                <div className="mb-3 flex items-baseline justify-between">
                  <span className={SECTION_LABEL}>{t('takeaway_total')}</span>
                  <span className="text-2xl font-bold tabular-nums tracking-tight text-[var(--text)]">
                    {fmtVND(totalVND)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="h-11 flex-1 rounded-[12px]"
                    onClick={close}
                  >
                    {t('takeaway_cancel')}
                  </Button>
                  <Button
                    className="h-11 flex-[2] rounded-[12px] bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled={
                      cart.length === 0 || (!isSessionTakeaway && !customerName.trim()) || isPending
                    }
                    onClick={handleSubmit}
                  >
                    {isPending ? <Loader2 className="animate-spin" /> : <ShoppingCart />}
                    {isSessionTakeaway ? t('takeaway_place_for_table') : t('takeaway_place_order')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function CategoryChip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <Button
      size="sm"
      variant={active ? 'default' : 'secondary'}
      aria-pressed={active}
      className={cn(
        'shrink-0 rounded-full font-medium',
        active
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : 'border border-[var(--separator)]',
      )}
      onClick={onClick}
    >
      {label}
    </Button>
  )
}

function MenuTile({
  item,
  qty,
  onAdd,
}: {
  item: AdminMenuItemSummaryDTO
  qty: number
  onAdd: () => void
}) {
  return (
    <button
      type="button"
      onClick={onAdd}
      className={cn(
        'group relative flex cursor-pointer flex-col overflow-hidden rounded-[var(--radius-xl)] border text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--system-blue)]',
        LIST_CARD,
        qty > 0
          ? 'border-[var(--text-secondary)] ring-2 ring-[var(--text)]/20'
          : 'border-[var(--separator)] hover:ring-1 hover:ring-[var(--text)]/15',
      )}
    >
      <div className="aspect-[4/3] w-full overflow-hidden bg-[var(--surface-grouped)]">
        {item.image_url ? (
          <img src={item.image_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[var(--text-tertiary)]">
            <ImageOff className="size-8" />
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <div className="line-clamp-2 text-sm font-semibold leading-snug text-[var(--text)]">
          {item.name}
        </div>
        <div className="mt-auto pt-2 text-sm font-bold tabular-nums text-[var(--text)]">
          {item.has_variants && item.price_from_vnd != null
            ? `${fmtVND(item.price_from_vnd)}+`
            : fmtVND(item.base_price_vnd)}
        </div>
      </div>
      {qty > 0 ? (
        <Badge className="absolute right-2 top-2 min-w-6 justify-center px-1.5 tabular-nums">
          {qty}
        </Badge>
      ) : null}
    </button>
  )
}
