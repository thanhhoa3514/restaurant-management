import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { AdminT } from '@/features/admin/data/i18n'
import type { AdminCategoryDTO } from '@/features/catalog/types'

export function CategoryFilter({
  categories,
  selectedId,
  loading,
  t,
  onSelect,
}: {
  categories: AdminCategoryDTO[]
  selectedId?: string
  loading: boolean
  t: AdminT
  onSelect: (id: string | undefined) => void
}) {
  return (
    <aside className="h-fit rounded-[24px] border border-[var(--separator)] bg-[var(--material-regular)] p-3 backdrop-blur-2xl lg:sticky lg:top-24">
      <div className="mb-2 px-2 py-1 text-xs font-bold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
        {t('catalog_categories')}
      </div>
      <Button
        type="button"
        variant="ghost"
        className={categoryButtonClass(!selectedId)}
        onClick={() => onSelect(undefined)}
      >
        <span>{t('catalog_all')}</span>
        <span className="text-xs text-[var(--text-tertiary)]">{t('catalog_all_hint')}</span>
      </Button>
      {loading && (
        <p className="px-3 py-4 text-sm text-[var(--text-secondary)]">{t('catalog_loading')}</p>
      )}
      {categories.map((category) => (
        <Button
          key={category.id}
          type="button"
          variant="ghost"
          className={categoryButtonClass(selectedId === category.id)}
          onClick={() => onSelect(category.id)}
        >
          <span>{category.name}</span>
          <span className="text-xs text-[var(--text-tertiary)]">#{category.display_order}</span>
        </Button>
      ))}
    </aside>
  )
}

export function categoryButtonClass(active: boolean) {
  return cn(
    'mb-1 flex w-full h-auto cursor-pointer items-center justify-between rounded-[16px] px-3 py-3 text-left text-sm font-semibold transition-colors duration-[220ms]',
    active
      ? 'bg-[var(--system-purple)] text-white shadow-sm [&_span:last-child]:text-white/75 hover:bg-[var(--system-purple)]/90 hover:text-white'
      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-grouped)] hover:text-[var(--text)]',
  )
}
