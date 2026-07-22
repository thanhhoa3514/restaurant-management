import { useMemo, useState, type FC } from 'react'
import { Search, ShoppingBag, Plus, ChevronRight, Grid2x2 } from 'lucide-react'
import { useOrdering } from '../hooks/use-ordering'
import { DICT } from '../data/i18n'
import { formatVND, totalItems } from '../helpers'
import type { ApiMenuItemSummary, Lang } from '../types'
import { useGuestCategories } from '../queries/useGuestCategories'
import { useGuestItems } from '../queries/useGuestItems'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { LanguageLoader } from '@/components/ui/language-loader'

import { ItemDetail } from './item-detail'
import { CartSheet } from './cart-sheet'
import { ServicesSheet } from './services-sheet'
import { cn } from '@/lib/utils'

export const MenuScreen: FC = () => {
  const { state, dispatch } = useOrdering()
  const t = DICT[state.lang]
  const sessionToken = state.session?.token
  const [activeCategory, setActiveCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [changingLang, setChangingLang] = useState<'vi' | 'en' | null>(null)
  const [servicesOpen, setServicesOpen] = useState(false)

  const { data: categoriesData } = useGuestCategories(sessionToken)

  const {
    data: itemsData,
    isLoading: isItemsLoading,
    isError: isItemsError,
    refetch: refetchItems,
  } = useGuestItems(sessionToken)

  const filtered = useMemo(
    () => {
      const items = itemsData ?? []
      return (
      items.filter((item) => {
        if (!item.is_available) return false
        if (activeCategory !== 'all' && item.category_id !== activeCategory) return false
        if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false
        return true
      })
      )
    },
    [itemsData, activeCategory, search],
  )

  const cartCount = totalItems(state.cart)

  return (
    <div className="flex min-h-dvh flex-col pb-28 bg-[var(--bg)] font-sans">
      {/* Sticky top: header + category bar pinned together (no magic offset) */}
      <div className="sticky top-0 z-[var(--z-sticky)]">
      {/* Premium Glass Header */}
      <header className="bg-[var(--material-thin)]/80 backdrop-blur-2xl border-b border-[var(--separator)] shadow-sm">
        <div className="px-4 pt-5 pb-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <img src="/zenith-logo-transparent.png" alt="Zenith Logo" className="h-8 w-auto object-contain" />
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-medium text-[var(--text-tertiary)]">{t.floor}</span>
                <span className="inline-block size-1 rounded-full bg-[var(--text-tertiary)] opacity-40" />
                <span className="inline-flex items-center rounded-full bg-[var(--system-purple)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--system-purple)]">
                  {t.table} {state.session?.table}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={state.lang === 'vi' ? 'Dịch vụ' : 'Services'}
                className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-grouped)] text-[var(--text)] transition-colors hover:bg-[var(--separator)]/50 active:scale-95 cursor-pointer"
                onClick={() => setServicesOpen(true)}
              >
                <Grid2x2 size={20} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                aria-label={t.view_cart}
                className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-grouped)] text-[var(--text)] transition-colors hover:bg-[var(--separator)]/50 active:scale-95 cursor-pointer"
                onClick={() => dispatch({ type: 'OPEN_CART' })}
              >
                <ShoppingBag size={20} strokeWidth={2.5} />
                {cartCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-[var(--system-red)] text-[9px] font-bold text-white ring-2 ring-[var(--bg)]">
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          <div className="relative group">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[var(--text-tertiary)] group-focus-within:text-[var(--system-blue)] transition-colors">
              <Search size={18} />
            </div>
            <input
              type="text"
              aria-label={t.search_placeholder}
              placeholder={t.search_placeholder}
              className="w-full h-11 pl-10 pr-4 rounded-2xl bg-[var(--surface-grouped)]/60 border border-[var(--separator)] text-sm font-medium text-[var(--text)] placeholder-[var(--text-tertiary)] outline-none transition-all focus:bg-[var(--surface-grouped)] focus:ring-2 focus:ring-[var(--system-blue)]/20 focus:border-[var(--system-blue)]/40"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </header>

      {/* Categories Horizontal Scroll */}
      <div className="bg-[var(--bg)]/90 backdrop-blur-md pt-3 pb-3 border-b border-[var(--separator)]/50">
        <div className="flex overflow-x-auto no-scrollbar px-4 gap-2 items-center">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={cn(
              "whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all duration-300 active:scale-95 border cursor-pointer",
              activeCategory === 'all'
                ? "bg-[var(--text)] text-[var(--bg)] border-transparent shadow-md"
                : "bg-transparent text-[var(--text-secondary)] border-[var(--separator)] hover:bg-[var(--surface-grouped)]"
            )}
          >
            {state.lang === 'vi' ? 'Tất cả' : 'All'}
          </button>
          {(categoriesData ?? []).map((cat) => (
            <button
              type="button"
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all duration-300 active:scale-95 border cursor-pointer",
                activeCategory === cat.id
                  ? "bg-[var(--text)] text-[var(--bg)] border-transparent shadow-md"
                  : "bg-transparent text-[var(--text-secondary)] border-[var(--separator)] hover:bg-[var(--surface-grouped)]"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>
      </div>

      {/* Menu Grid */}
      <main className="flex-1 px-4 py-6">
        {isItemsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="flex flex-row sm:flex-col overflow-hidden">
                <Skeleton className="size-28 sm:size-full sm:aspect-[4/3] rounded-none shrink-0" />
                <CardContent className="p-4 flex flex-col justify-center flex-1 gap-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-4 w-1/4 mt-auto" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : isItemsError ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <p className="text-sm font-medium text-[var(--text-secondary)]">
              {state.lang === 'vi' ? 'Lỗi kết nối. Không tải được thực đơn.' : 'Connection error. Could not load the menu.'}
            </p>
            <Button variant="secondary" onClick={() => refetchItems()} className="rounded-xl font-bold">
              {state.lang === 'vi' ? 'Thử lại' : 'Retry'}
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div className="size-20 rounded-full bg-[var(--surface-grouped)] flex items-center justify-center text-[var(--text-tertiary)]">
              <Search size={32} />
            </div>
            <p className="text-sm font-medium text-[var(--text-tertiary)]">{t.no_results}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                lang={state.lang}
                onSelect={() => setSelectedItemId(item.id)}
              />
            ))}
          </div>
        )}
      </main>



      {selectedItemId && (
        <ItemDetail
          itemId={selectedItemId}
          lang={state.lang}
          onClose={() => setSelectedItemId(null)}
        />
      )}

      <CartSheet
        open={state.cartOpen}
        lang={state.lang}
        onClose={() => dispatch({ type: 'CLOSE_CART' })}
      />

      <ServicesSheet
        open={servicesOpen}
        onClose={() => setServicesOpen(false)}
        lang={state.lang}
        dispatch={dispatch}
        setChangingLang={setChangingLang}
        sessionToken={sessionToken}
      />

      <LanguageLoader
        open={changingLang !== null}
        targetLang={changingLang || state.lang}
      />
    </div>
  )
}

interface MenuItemCardProps {
  item: ApiMenuItemSummary
  lang: Lang
  onSelect: () => void
}

const MenuItemCard: FC<MenuItemCardProps> = ({ item, lang, onSelect }) => {
  const price = item.has_variants && item.price_from_vnd != null ? item.price_from_vnd : item.base_price_vnd

  return (
    <Card 
      className="group overflow-hidden cursor-pointer hover:shadow-md transition-all active:scale-[0.98] bg-[var(--bg-elevated)] border-[var(--separator)] flex flex-row sm:flex-col" 
      onClick={onSelect}
    >
      <div className="relative w-[110px] sm:w-full shrink-0 aspect-square sm:aspect-[4/3] bg-[var(--surface-grouped)] overflow-hidden">
        {item.image_url ? (
          <>
            <img 
              src={item.image_url} 
              alt={item.name} 
              className="size-full object-cover transition-transform duration-500 group-hover:scale-105" 
              loading="lazy" 
            />
            <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </>
        ) : (
          <div className="size-full flex items-center justify-center text-[var(--text-tertiary)] bg-gradient-to-br from-[var(--surface-grouped)] to-[var(--separator)]/30" />
        )}
      </div>
      
      <CardContent className="p-3 sm:p-4 flex flex-col flex-1 justify-center sm:justify-start gap-1 sm:gap-2">
        <h3 className="text-[15px] font-bold text-[var(--text)] leading-snug line-clamp-2 transition-colors group-hover:text-[var(--system-blue)]">
          {item.name}
        </h3>
        {item.short_description && (
          <p className="text-[13px] text-[var(--text-secondary)] line-clamp-1 sm:line-clamp-2 mt-0.5">
            {item.short_description}
          </p>
        )}
        <div className="mt-auto pt-2 flex items-center justify-between">
          <span className="text-[14px] sm:text-[15px] font-extrabold text-[var(--text)]">
            {item.has_variants && item.price_from_vnd != null
              ? <span className="text-[11px] sm:text-[12px] font-bold text-[var(--text-tertiary)] uppercase mr-1">{lang === 'vi' ? 'Từ' : 'From'}</span>
              : null}
            {formatVND(price)}
          </span>
          <div className="flex size-7 sm:size-8 items-center justify-center rounded-full bg-[var(--surface-grouped)] text-[var(--text-secondary)] group-hover:bg-[var(--system-blue)] group-hover:text-[white] transition-colors">
            <Plus size={16} strokeWidth={2.5} />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

