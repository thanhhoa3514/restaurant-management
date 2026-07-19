import { useCallback, useMemo, useState, type FC } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, Plus, Search, ShoppingCart, X, Minus, Trash2, User, Phone, ShoppingBag, UtensilsCrossed, ImageOff } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { listAdminMenuItems, listAdminCategories } from '@/features/catalog/api'
import type { AdminMenuItemSummaryDTO, AdminCategoryDTO } from '@/features/catalog/types'
import type { StaffTakeawayInput } from '@/features/cashier/api'
import { usePlaceTakeawayOrder } from '@/features/cashier/mutations/usePlaceTakeawayOrder'
import { fmtVND } from '@/features/cashier/helpers'

interface TakeawayPanelProps {
  lang: 'vi' | 'en'
  t: (key: string, ...args: Array<string | number>) => string
  compact?: boolean
}

interface CartLine {
  menu_item_id: string
  name: string
  quantity: number
  unit_price_vnd: number
  note: string
  options: { option_id: string; quantity: number }[]
}

export const TakeawayPanel: FC<TakeawayPanelProps> = ({ lang: _lang, t, compact }) => {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [categoryId, setCategoryId] = useState<string | undefined>(undefined)
  const [cart, setCart] = useState<CartLine[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const takeawayMutation = usePlaceTakeawayOrder()

  const { data: categories = [] } = useQuery({
    queryKey: ['catalog', 'categories'],
    queryFn: listAdminCategories,
  })

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['catalog', 'items', categoryId],
    queryFn: () => listAdminMenuItems(categoryId),
    enabled: open,
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return items.filter((it: AdminMenuItemSummaryDTO) => it.is_available)
    return items.filter(
      (it: AdminMenuItemSummaryDTO) => it.name.toLowerCase().includes(q) && it.is_available,
    )
  }, [items, search])

  const addToCart = useCallback(
    (item: AdminMenuItemSummaryDTO) => {
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
    },
    [],
  )

  const updateQty = useCallback((id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.menu_item_id === id ? { ...l, quantity: Math.max(0, l.quantity + delta) } : l))
        .filter((l) => l.quantity > 0),
    )
  }, [])

  const totalItems = useMemo(() => cart.reduce((s, l) => s + l.quantity, 0), [cart])
  const totalVND = useMemo(
    () => cart.reduce((s, l) => s + l.unit_price_vnd * l.quantity, 0),
    [cart],
  )

  const reset = useCallback(() => {
    setCart([])
    setCustomerName('')
    setCustomerPhone('')
    setSearch('')
    setCategoryId(undefined)
  }, [])

  const handleSubmit = useCallback(() => {
    if (cart.length === 0) return
    if (!customerName.trim()) {
      toast.error(t('takeaway_name_required'))
      return
    }

    const input: StaffTakeawayInput = {
      items: cart.map((l) => ({
        menu_item_id: l.menu_item_id,
        quantity: l.quantity,
        note: l.note,
        options: l.options,
      })),
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
    }
    takeawayMutation.mutate(input, {
      onSuccess: (result) => {
        toast.success(
          `${t('takeaway_order_placed')} #${result.order_number} — ${fmtVND(result.total_vnd)}`,
        )
        reset()
        setOpen(false)
      },
      onError: (err) => {
        const msg = err instanceof Error ? err.message : 'Lỗi khi tạo đơn mang về'
        toast.error(msg)
      },
    })
  }, [cart, customerName, customerPhone, t, reset, takeawayMutation])

  return (
    <>
      <Button
        className={compact
          ? 'rounded-xl gap-1.5 font-semibold h-9 px-3 text-xs shadow-sm transition-all hover:shadow-md bg-[var(--system-orange)] hover:bg-[var(--system-orange)]/90 text-white shrink-0'
          : 'w-full rounded-2xl gap-2 font-semibold h-12 shadow-sm transition-all hover:shadow-md bg-[var(--system-orange)] hover:bg-[var(--system-orange)]/90 text-white'}
        onClick={() => setOpen(true)}
      >
        <ShoppingCart className={compact ? 'size-4' : 'size-5'} />
        {t('takeaway_order')}
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset() }}>
        <DialogContent showCloseButton={false} className="max-h-[95dvh] w-[95vw] sm:max-w-[95vw] md:max-w-5xl lg:max-w-6xl xl:max-w-7xl gap-0 overflow-hidden rounded-3xl p-0 shadow-2xl border border-[var(--separator)] bg-[var(--background)]">
          <DialogTitle className="sr-only">{t('takeaway_order')}</DialogTitle>
          <div className="flex h-[90dvh] flex-col md:flex-row">
            
            {/* LEFT PANEL: Menu Selection */}
            <div className="flex flex-1 flex-col bg-[var(--background)]">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[var(--separator)] px-6 py-5 bg-[var(--background)] z-10 sticky top-0">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400">
                    <UtensilsCrossed className="size-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-[var(--foreground)]">{t('takeaway_order')}</h2>
                    <p className="text-sm text-[var(--text-tertiary)]">Chọn món nhanh chóng và tiện lợi</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full flex md:hidden" onClick={() => setOpen(false)}>
                  <X className="size-5" />
                </Button>
              </div>

              {/* Filters & Search */}
              <div className="px-6 py-4 space-y-4 z-10 bg-[var(--background)] border-b border-[var(--separator)]/50">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[var(--text-tertiary)]" />
                  <Input
                    placeholder={t('takeaway_search')}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-12 rounded-2xl pl-12 bg-[var(--surface-grouped)] border-[var(--separator)] text-base focus-visible:ring-[var(--system-orange)] focus-visible:border-[var(--system-orange)] shadow-sm"
                  />
                </div>
                
                <div className="flex flex-wrap gap-2 max-h-[88px] overflow-y-auto pr-2 pb-1 scrollbar-hide">
                  <Badge
                    variant={!categoryId ? 'default' : 'secondary'}
                    className={`cursor-pointer rounded-full px-5 py-2 text-sm font-medium transition-all ${
                      !categoryId 
                        ? 'bg-[var(--system-orange)] hover:bg-[var(--system-orange)]/90 text-white shadow-sm border-transparent' 
                        : 'bg-[var(--surface-grouped)] hover:bg-[var(--separator)] text-[var(--foreground)] border-[var(--separator)] hover:border-[var(--system-orange)]/50'
                    }`}
                    onClick={() => setCategoryId(undefined)}
                  >
                    {t('takeaway_all')}
                  </Badge>
                  {categories.map((cat: AdminCategoryDTO) => (
                    <Badge
                      key={cat.id}
                      variant={categoryId === cat.id ? 'default' : 'secondary'}
                      className={`cursor-pointer rounded-full px-5 py-2 text-sm font-medium transition-all ${
                        categoryId === cat.id
                          ? 'bg-[var(--system-orange)] hover:bg-[var(--system-orange)]/90 text-white shadow-sm border-transparent' 
                          : 'bg-[var(--surface-grouped)] hover:bg-[var(--separator)] text-[var(--foreground)] border-[var(--separator)] hover:border-[var(--system-orange)]/50'
                      }`}
                      onClick={() => setCategoryId(cat.id)}
                    >
                      {cat.name}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Product Grid */}
              <div className="flex-1 overflow-y-auto p-6 bg-[var(--surface-grouped)]">
                {itemsLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <Loader2 className="size-10 animate-spin text-[var(--system-orange)]" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
                    {filtered.map((item: AdminMenuItemSummaryDTO) => (
                      <Card
                        key={item.id}
                        className="group relative flex cursor-pointer flex-col overflow-hidden rounded-[20px] border border-[var(--separator)] bg-[var(--background)] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-[var(--system-orange)]/40"
                        onClick={() => addToCart(item)}
                      >
                        <div className="aspect-[4/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                          {item.image_url ? (
                            <img 
                              src={item.image_url} 
                              alt={item.name} 
                              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-slate-300 dark:text-slate-700">
                              <ImageOff className="size-10 opacity-50" />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-1 flex-col p-4">
                          <div className="mb-2 line-clamp-2 text-sm font-bold leading-tight text-[var(--foreground)]">
                            {item.name}
                          </div>
                          <div className="mt-auto pt-1 text-base font-bold text-[var(--system-orange)]">
                            {item.has_variants && item.price_from_vnd != null
                              ? `${fmtVND(item.price_from_vnd)}+`
                              : fmtVND(item.base_price_vnd)}
                          </div>
                        </div>
                        
                        {/* Overlay add button on hover */}
                        <div className="absolute bottom-3 right-3 flex size-9 scale-90 items-center justify-center rounded-full bg-[var(--system-orange)] text-white opacity-0 shadow-md transition-all duration-300 group-hover:scale-100 group-hover:opacity-100">
                          <Plus className="size-5" />
                        </div>
                      </Card>
                    ))}
                    {filtered.length === 0 && (
                      <div className="col-span-full flex flex-col items-center justify-center py-20 text-[var(--text-tertiary)]">
                        <div className="mb-4 rounded-full bg-[var(--separator)]/30 p-6">
                          <ShoppingBag className="size-12 opacity-40" />
                        </div>
                        <p className="text-xl font-medium text-[var(--foreground)]">{t('takeaway_no_items')}</p>
                        <p className="text-sm mt-2">Hãy thử tìm kiếm bằng một từ khóa khác</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT PANEL: Cart & Customer */}
            <div className="flex w-full flex-col border-l border-[var(--separator)] bg-[var(--background)] md:w-[420px] shrink-0">
              
              {/* Close Button Desktop */}
              <div className="hidden md:flex justify-end p-4 pb-0">
                <Button variant="ghost" size="icon" className="rounded-full hover:bg-[var(--separator)] text-[var(--text-tertiary)]" onClick={() => { setOpen(false); reset() }}>
                  <X className="size-5" />
                </Button>
              </div>

              {/* Customer Info Section */}
              <div className="p-6 pb-5">
                <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-[var(--foreground)]">
                  <div className="flex size-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                    <User className="size-4" />
                  </div>
                  Thông tin khách hàng
                </h3>
                <div className="space-y-3">
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
                    <Input
                      placeholder={t('takeaway_customer_name')}
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="h-12 rounded-xl pl-11 border-[var(--separator)] bg-[var(--surface-grouped)] focus-visible:ring-blue-500 font-medium"
                    />
                  </div>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-[var(--text-tertiary)]" />
                    <Input
                      placeholder={t('takeaway_customer_phone')}
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="h-12 rounded-xl pl-11 border-[var(--separator)] bg-[var(--surface-grouped)] focus-visible:ring-blue-500 font-medium"
                    />
                  </div>
                </div>
              </div>

              <Separator className="bg-[var(--separator)]/50" />

              {/* Cart Items Section */}
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="flex items-center justify-between p-6 pb-3">
                  <h3 className="flex items-center gap-2 text-lg font-bold text-[var(--foreground)]">
                    <div className="flex size-8 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400">
                      <ShoppingCart className="size-4" />
                    </div>
                    {t('takeaway_cart')}
                  </h3>
                  <Badge variant="secondary" className="rounded-full bg-[var(--system-orange)]/10 text-[var(--system-orange)] px-3 py-1 font-bold">
                    {totalItems} món
                  </Badge>
                </div>
                
                <div className="flex-1 overflow-y-auto px-6 pb-6">
                  {cart.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center text-[var(--text-tertiary)]">
                      <ShoppingCart className="mb-4 size-14 opacity-20" />
                      <p className="text-base font-medium text-[var(--foreground)]">Giỏ hàng trống</p>
                      <p className="text-sm text-center mt-1">Hãy chọn các món hấp dẫn từ thực đơn bên trái</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {cart.map((line) => (
                        <div
                          key={line.menu_item_id}
                          className="flex flex-col gap-3 rounded-2xl border border-[var(--separator)] bg-[var(--surface-grouped)] p-4 shadow-sm transition-all hover:border-[var(--system-orange)]/30"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="font-bold text-[var(--foreground)] text-sm leading-snug">
                                {line.name}
                              </div>
                              <div className="mt-1 font-medium text-[var(--system-orange)] text-sm">
                                {fmtVND(line.unit_price_vnd)}
                              </div>
                            </div>
                            <div className="font-bold text-[var(--foreground)] text-base">
                              {fmtVND(line.unit_price_vnd * line.quantity)}
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between mt-1">
                            <button
                              className="text-sm font-medium text-red-500 hover:text-red-600 flex items-center gap-1 px-2 py-1 -ml-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                              onClick={() => updateQty(line.menu_item_id, -line.quantity)}
                            >
                              <Trash2 className="size-4" /> Xóa
                            </button>
                            
                            <div className="flex items-center rounded-full border border-[var(--separator)] bg-[var(--background)] shadow-sm">
                              <button
                                className="flex size-9 items-center justify-center rounded-l-full text-[var(--foreground)] transition-colors hover:bg-[var(--separator)]"
                                onClick={() => updateQty(line.menu_item_id, -1)}
                              >
                                {line.quantity === 1 ? <Trash2 className="size-4 text-red-500" /> : <Minus className="size-4" />}
                              </button>
                              <span className="w-10 text-center text-sm font-bold tabular-nums text-[var(--foreground)]">
                                {line.quantity}
                              </span>
                              <button
                                className="flex size-9 items-center justify-center rounded-r-full text-[var(--foreground)] transition-colors hover:bg-[var(--separator)]"
                                onClick={() => updateQty(line.menu_item_id, 1)}
                              >
                                <Plus className="size-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Checkout Footer */}
              <div className="border-t border-[var(--separator)] bg-[var(--surface-grouped)] p-6 pt-5 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
                <div className="mb-5 flex items-center justify-between">
                  <span className="text-base font-medium text-[var(--text-tertiary)]">
                    {t('takeaway_total')}
                  </span>
                  <span className="text-3xl font-black text-[var(--system-orange)] tabular-nums tracking-tight">
                    {fmtVND(totalVND)}
                  </span>
                </div>
                
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="h-[56px] flex-[0.8] rounded-2xl border-[var(--separator)] font-bold text-base bg-[var(--background)] hover:bg-[var(--separator)] hover:text-[var(--foreground)] transition-colors"
                    onClick={() => { setOpen(false); reset() }}
                  >
                    Hủy
                  </Button>
                  <Button
                    className="h-[56px] flex-[2] rounded-2xl bg-[var(--system-orange)] text-lg font-bold text-white shadow-[0_8px_16px_-6px_rgba(var(--system-orange-rgb),0.4)] hover:bg-[var(--system-orange)]/90 hover:shadow-[0_12px_20px_-8px_rgba(var(--system-orange-rgb),0.5)] hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                    disabled={cart.length === 0 || !customerName.trim() || takeawayMutation.isPending}
                    onClick={handleSubmit}
                  >
                    {takeawayMutation.isPending ? (
                      <Loader2 className="size-6 animate-spin" />
                    ) : (
                      <>
                        <ShoppingCart className="mr-2 size-5" />
                        {t('takeaway_place_order')}
                      </>
                    )}
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
