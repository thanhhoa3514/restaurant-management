import { useMemo, useState, type FC } from 'react'
import { Search, ShoppingBag, Plus, Sparkles, ChevronRight } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useOrdering } from '../hooks/use-ordering'
import { DICT } from '../data/i18n'
import { formatVND, totalItems } from '../helpers'
import { fetchCategories, fetchMenuItems, type ApiMenuItemSummary } from '../api'
import type { Lang } from '../types'
import { Button } from '../../../components/ui/button'
import { Skeleton } from '../../../components/ui/skeleton'
import { LanguageLoader } from '../../../components/ui/language-loader'
import { ThemeToggle } from '../../../components/ui/theme-toggle'
import { LanguageSwitcher } from '../../../components/ui/language-switcher'
import { ItemDetail } from './item-detail'
import { CartSheet } from './cart-sheet'
import { cn } from '../../../lib/utils'

export const MenuScreen: FC = () => {
  const { state, dispatch } = useOrdering()
  const t = DICT[state.lang]
  const sessionToken = state.session?.token
  const [activeCategory, setActiveCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [changingLang, setChangingLang] = useState<'vi' | 'en' | null>(null)

  const { data: categoriesData } = useQuery({
    queryKey: ['guest-categories', sessionToken],
    queryFn: () => fetchCategories(sessionToken!),
    enabled: !!sessionToken,
  })

  const {
    data: itemsData,
    isLoading: isItemsLoading,
    isError: isItemsError,
    refetch: refetchItems,
  } = useQuery({
    queryKey: ['guest-items', sessionToken],
    queryFn: () => fetchMenuItems(sessionToken!),
    enabled: !!sessionToken,
  })

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
      {/* Premium Glass Header */}
      <header className="sticky top-0 z-[var(--z-sticky)] bg-[var(--material-thin)]/80 backdrop-blur-2xl border-b border-[var(--separator)] shadow-sm">
        <div className="px-4 pt-5 pb-4 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h1 className="text-xl font-bold text-[var(--text)] tracking-tight flex items-center gap-2">
                {t.restaurant}
                <Sparkles className="size-4 text-amber-400" />
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs font-medium text-[var(--text-tertiary)]">{t.floor}</span>
                <span className="inline-block size-1 rounded-full bg-[var(--text-tertiary)] opacity-40" />
                <span className="inline-flex items-center rounded-full bg-[var(--system-purple)]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--system-purple)]">
                  {t.table} {state.session?.table}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <LanguageSwitcher
                currentLang={state.lang}
                onLangChange={(target) => {
                  setChangingLang(target)
                  setTimeout(() => {
                    dispatch({ type: 'SET_LANG', payload: target })
                    setChangingLang(null)
                  }, 750)
                }}
              />
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
      <div className="sticky top-[125px] z-20 bg-[var(--bg)]/90 backdrop-blur-md pt-3 pb-3 border-b border-[var(--separator)]/50">
        <div className="flex overflow-x-auto no-scrollbar px-4 gap-2 items-center">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={cn(
              "whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all duration-300 active:scale-95 border",
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
                "whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all duration-300 active:scale-95 border",
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

      {/* Menu Grid */}
      <main className="flex-1 px-4 py-6">
        {isItemsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-2">
                <Skeleton className="aspect-square rounded-3xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : isItemsError ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="size-16 rounded-full bg-[var(--system-red)]/10 flex items-center justify-center text-[var(--system-red)]">
              <Sparkles size={24} />
            </div>
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-6">
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

      {/* Floating Cart Button */}
      {cartCount > 0 && (
        <div className="fixed bottom-6 left-0 right-0 z-[var(--z-floating)] px-4 pointer-events-none flex justify-center animate-in slide-in-from-bottom-10 fade-in duration-500">
          <button
            type="button"
            className="group pointer-events-auto relative flex h-14 w-full max-w-sm items-center justify-between overflow-hidden rounded-full bg-[var(--text)] px-6 shadow-[0_8px_30px_rgba(0,0,0,0.12)] transition-all active:scale-[0.98] cursor-pointer"
            onClick={() => dispatch({ type: 'OPEN_CART' })}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
            <div className="flex items-center gap-3 relative z-10">
              <div className="relative">
                <ShoppingBag size={22} className="text-[var(--bg)]" />
                <span className="absolute -top-1 -right-2 flex size-4 items-center justify-center rounded-full bg-[var(--system-red)] text-[9px] font-bold text-white ring-2 ring-[var(--text)]">
                  {cartCount}
                </span>
              </div>
              <span className="font-semibold text-[var(--bg)] text-[15px]">
                {t.view_cart}
              </span>
            </div>
            <div className="flex items-center text-[var(--bg)]/80 relative z-10">
              <ChevronRight size={20} className="transition-transform group-hover:translate-x-1" />
            </div>
          </button>
        </div>
      )}

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
    <button
      type="button"
      className="group flex flex-col gap-3 cursor-pointer text-left w-full"
      onClick={onSelect}
    >
      <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-[var(--surface-grouped)] transition-all duration-300 shadow-sm group-hover:shadow-lg group-hover:-translate-y-1">
        {item.image_url ? (
          <>
            <img 
              src={item.image_url} 
              alt={item.name} 
              className="size-full object-cover transition-transform duration-700 group-hover:scale-110" 
              loading="lazy" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </>
        ) : (
          <div className="size-full bg-gradient-to-br from-[var(--surface-grouped)] to-[var(--separator)]/30" />
        )}
        
        {/* Floating Add Button overlay */}
        <div className="absolute bottom-3 right-3 flex size-9 items-center justify-center rounded-full bg-[var(--material-thick)]/90 backdrop-blur-md shadow-md text-[var(--text)] transition-transform duration-300 active:scale-90 group-hover:bg-[var(--text)] group-hover:text-[var(--bg)]">
          <Plus size={18} strokeWidth={2.5} />
        </div>
      </div>
      
      <div className="flex flex-col gap-1 px-1">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[15px] font-bold text-[var(--text)] leading-snug line-clamp-2 transition-colors group-hover:text-[var(--system-blue)]">
            {item.name}
          </h3>
        </div>
        {item.short_description && (
          <p className="text-xs text-[var(--text-tertiary)] line-clamp-1 font-medium">{item.short_description}</p>
        )}
        <div className="mt-1 flex items-center">
          <span className="text-[14px] font-extrabold tracking-tight text-[var(--text)]">
            {item.has_variants && item.price_from_vnd != null
              ? <span className="text-[11px] font-bold text-[var(--text-tertiary)] uppercase mr-1">{lang === 'vi' ? 'Từ' : 'From'}</span>
              : null}
            {formatVND(price)}
          </span>
        </div>
      </div>
    </button>
  )
}
