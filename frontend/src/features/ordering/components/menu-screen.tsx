import { useMemo, useState, type FC } from 'react'
import { Search, ShoppingCart } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useOrdering } from '../hooks/use-ordering'
import { DICT } from '../data/i18n'
import { formatVND, totalItems } from '../helpers'
import { fetchCategories, fetchMenuItems, type ApiMenuItemSummary } from '../api'
import type { Lang } from '../types'
import { Button } from '../../../components/ui/button'
import { Badge } from '../../../components/ui/badge'
import { Card } from '../../../components/ui/card'
import { Skeleton } from '../../../components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '../../../components/ui/tabs'
import { Input } from '../../../components/ui/input'
import { LanguageLoader } from '../../../components/ui/language-loader'
import { ThemeToggle } from '../../../components/ui/theme-toggle'
import { LanguageSwitcher } from '../../../components/ui/language-switcher'
import { ItemDetail } from './item-detail'
import { CartSheet } from './cart-sheet'

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
    <div className="flex min-h-dvh flex-col pb-24">
      <header className="sticky top-0 z-sticky bg-background/80 backdrop-blur-xl border-b border-separator">
        <div className="px-4 pt-4 pb-3 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-primary">{t.restaurant}</h1>
              <p className="text-xs text-tertiary">{t.floor}</p>
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
              <Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">
                {t.table} {state.session?.table}
              </Badge>
            </div>
          </div>

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-quaternary" />
            <Input
              placeholder={t.search_placeholder}
              className="pl-9 h-10 text-sm rounded-xl"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </header>

      <div className="px-4 py-3 overflow-x-auto no-scrollbar">
        <Tabs
          value={activeCategory}
          onValueChange={setActiveCategory}
          className="w-max min-w-full"
        >
          <TabsList className="w-full">
            <TabsTrigger value="all" className="text-sm whitespace-nowrap">
              {state.lang === 'vi' ? 'Tất cả' : 'All'}
            </TabsTrigger>
            {(categoriesData ?? []).map((cat) => (
              <TabsTrigger key={cat.id} value={cat.id} className="text-sm whitespace-nowrap">
                {cat.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 px-4">
        {isItemsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/3] rounded-xl" />
            ))}
          </div>
        ) : isItemsError ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-sm text-tertiary">
              {state.lang === 'vi' ? 'Không tải được thực đơn.' : 'Could not load the menu.'}
            </p>
            <Button variant="secondary" size="sm" onClick={() => refetchItems()}>
              {state.lang === 'vi' ? 'Thử lại' : 'Retry'}
            </Button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <Search size={32} className="text-quaternary" />
            <p className="text-sm text-tertiary">{t.no_results}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
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
      </div>

      {cartCount > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-floating">
          <Button
            className="rounded-full h-14 px-8 gap-3 shadow-lg text-base font-semibold"
            size="lg"
            onClick={() => dispatch({ type: 'OPEN_CART' })}
          >
            <ShoppingCart size={20} />
            {t.view_cart} &middot; {state.lang === 'vi' ? `${cartCount} món` : `${cartCount} item${cartCount === 1 ? '' : 's'}`}
          </Button>
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
    <Card
      className="overflow-hidden active:scale-[0.97] transition-transform cursor-pointer"
      onClick={onSelect}
    >
      <div className="aspect-[4/3] bg-surface-grouped overflow-hidden">
        {item.image_url ? (
          <img src={item.image_url} alt={item.name} className="size-full object-cover" loading="lazy" />
        ) : (
          <div className="size-full bg-surface-grouped" />
        )}
      </div>
      <div className="p-3 flex flex-col gap-1">
        <h3 className="text-sm font-medium text-primary leading-tight line-clamp-2">
          {item.name}
        </h3>
        {item.short_description && (
          <p className="text-[11px] text-tertiary line-clamp-1">{item.short_description}</p>
        )}
        <div className="flex items-center justify-between mt-1">
          <span className="text-sm font-semibold text-system-blue">
            {item.has_variants && item.price_from_vnd != null
              ? `${lang === 'vi' ? 'từ ' : 'from '}${formatVND(price)}`
              : formatVND(price)}
          </span>
        </div>
      </div>
    </Card>
  )
}
