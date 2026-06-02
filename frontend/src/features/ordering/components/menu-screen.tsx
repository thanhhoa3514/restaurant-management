import { useState, type FC } from 'react'
import { useOrdering } from '../hooks/use-ordering'
import { DICT } from '../data/i18n'
import { MENU } from '../data/menu'
import { CATEGORIES } from '../types/categories'
import { totalItems } from '../helpers'
import type { CartLine, MenuItem, Lang } from '../types'
import { Button } from '../../../components/ui/button'
import { Badge } from '../../../components/ui/badge'
import { Card } from '../../../components/ui/card'
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
  const [activeCategory, setActiveCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null)
  const [changingLang, setChangingLang] = useState<'vi' | 'en' | null>(null)

  const filtered = MENU.filter((item) => {
    if (!item.is_available) return false
    if (activeCategory !== 'all' && item.category !== activeCategory) return false
    if (search) {
      const q = search.toLowerCase()
      const name = state.lang === 'vi' ? item.name.vi : item.name.en
      if (!name.toLowerCase().includes(q)) return false
    }
    return true
  })

  const cartCount = totalItems(state.cart)

  const handleAddToCart = (line: CartLine) => {
    dispatch({ type: 'ADD_TO_CART', payload: line })
  }

  const handleOpenCart = () => {
    dispatch({ type: 'OPEN_CART' })
  }

  const handleCloseCart = () => {
    dispatch({ type: 'CLOSE_CART' })
  }

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
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-quaternary"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
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
            {CATEGORIES.map((cat) => (
              <TabsTrigger key={cat.id} value={cat.id} className="text-sm whitespace-nowrap">
                {state.lang === 'vi' ? cat.name_vi : cat.name_en}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 px-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-quaternary">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <p className="text-sm text-tertiary">{t.no_results}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filtered.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                lang={state.lang}
                onSelect={() => setSelectedItem(item)}
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
            onClick={handleOpenCart}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1" />
              <circle cx="20" cy="21" r="1" />
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
            </svg>
            {t.view_cart} &middot; {state.lang === 'vi' ? `${cartCount} món` : `${cartCount} item${cartCount === 1 ? '' : 's'}`}
          </Button>
        </div>
      )}

      {selectedItem && (
        <ItemDetail
          item={selectedItem}
          lang={state.lang}
          onAdd={handleAddToCart}
          onClose={() => setSelectedItem(null)}
          onSelectItem={setSelectedItem}
        />
      )}

      <CartSheet
        open={state.cartOpen}
        lang={state.lang}
        onClose={handleCloseCart}
      />

      <LanguageLoader
        open={changingLang !== null}
        targetLang={changingLang || state.lang}
      />
    </div>
  )
}

interface MenuItemCardProps {
  item: MenuItem
  lang: Lang
  onSelect: () => void
}

const MenuItemCard: FC<MenuItemCardProps> = ({ item, lang, onSelect }) => {
  const name = lang === 'vi' ? item.name.vi : item.name.en
  const desc = lang === 'vi' ? item.description.vi : item.description.en

  return (
    <Card
      className="overflow-hidden active:scale-[0.97] transition-transform cursor-pointer"
      onClick={onSelect}
    >
      <div className="aspect-[4/3] bg-surface-grouped overflow-hidden">
        <img
          src={item.image}
          alt={name}
          className="size-full object-cover"
          loading="lazy"
        />
      </div>
      <div className="p-3 flex flex-col gap-1">
        <h3 className="text-sm font-medium text-primary leading-tight line-clamp-2">
          {name}
        </h3>
        <p className="text-[11px] text-tertiary line-clamp-1">{desc}</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-sm font-semibold text-system-blue">
            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.price)}
          </span>
          {item.is_bestseller && (
            <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0 h-5 font-medium">
              Bestseller
            </Badge>
          )}
        </div>
      </div>
    </Card>
  )
}
