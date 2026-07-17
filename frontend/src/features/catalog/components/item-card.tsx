import { EyeOff, Loader2, Pencil, Star, Trash2, Utensils } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { AdminT } from '@/features/admin/data/i18n'
import type { AdminMenuItemSummaryDTO, AdminCategoryDTO } from '@/features/catalog/types'
import { money } from '@/features/catalog/helper/utils'
import { StatusBadge, AvailabilityBadge } from './catalog-badges'

export function ItemCard({
  item,
  category,
  t,
  mutationPending,
  onEdit,
  onToggle,
  onDelete,
}: {
  item: AdminMenuItemSummaryDTO
  category?: AdminCategoryDTO
  t: AdminT
  mutationPending: boolean
  onEdit: () => void
  onToggle: () => void
  onDelete: () => void
}) {
  const dim =
    !item.is_available || item.availability_status !== 'AVAILABLE' || item.status !== 'PUBLISHED'
  return (
    <Card
      className={cn(
        'border border-[var(--separator)] bg-[var(--material-regular)] py-0 backdrop-blur-2xl transition-all duration-[220ms]',
        dim && 'opacity-70',
      )}
    >
      <CardContent className="p-0">
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 p-4">
          <div className="relative overflow-hidden rounded-[18px] bg-[var(--surface-grouped)]">
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.name}
                className="aspect-square size-24 object-cover"
              />
            ) : (
              <div className="flex size-24 items-center justify-center text-[var(--text-tertiary)]">
                <Utensils className="size-8" />
              </div>
            )}
            {item.is_featured && (
              <span className="absolute right-2 top-2 rounded-full bg-[var(--system-yellow)] p-1 text-white shadow-sm">
                <Star className="size-3 fill-current" />
              </span>
            )}
          </div>

          <div className="min-w-0 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-bold text-[var(--text)]">{item.name}</h3>
                <p className="truncate text-xs font-medium text-[var(--text-tertiary)]">
                  {category?.name ?? t('catalog_uncategorized')} · v{item.version}
                </p>
              </div>
              <div className="text-right">
                <div className="font-bold text-[var(--text)]">{money(item.base_price_vnd)}</div>
                {item.price_from_vnd !== null && item.price_from_vnd !== item.base_price_vnd && (
                  <div className="text-xs text-[var(--text-tertiary)]">
                    {t('catalog_from_price', item.price_from_vnd)}
                  </div>
                )}
              </div>
            </div>

            {item.short_description && (
              <p className="line-clamp-2 text-sm text-[var(--text-secondary)]">
                {item.short_description}
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <StatusBadge status={item.status} t={t} />
              <AvailabilityBadge item={item} t={t} />
              {item.availability_status === 'HIDDEN' && (
                <Badge variant="warning" className="gap-1">
                  <EyeOff className="size-3" />
                  {t('catalog_hidden')}
                </Badge>
              )}
              {item.station && <Badge variant="secondary">{item.station}</Badge>}
              {item.display_order !== 0 && <Badge variant="outline">#{item.display_order}</Badge>}
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                size="sm"
                variant="secondary"
                className="rounded-[12px]"
                disabled={mutationPending}
                onClick={onEdit}
              >
                <Pencil className="size-4" />
                {t('catalog_edit')}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="rounded-[12px] text-[var(--system-orange)]"
                disabled={mutationPending}
                onClick={onToggle}
              >
                {mutationPending && <Loader2 className="size-4 animate-spin" />}
                {item.is_available ? t('catalog_mark_sold_out') : t('catalog_mark_available')}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="rounded-[12px] text-[var(--system-red)]"
                disabled={mutationPending}
                onClick={onDelete}
              >
                <Trash2 className="size-4" />
                {t('catalog_delete')}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
