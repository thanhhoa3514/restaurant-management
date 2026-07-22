import { useState } from 'react'
import { Loader2, Plus, Utensils } from 'lucide-react'

import { SecureActionDialog } from '@/components/SecureActionDialog'
import { ShellHeaderActions, ShellHeaderCenter, useShellConfig } from '@/components/admin-shell'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { makeAdminT } from '@/i18n'
import { useCategoriesQuery, useMenuItemsQuery } from '@/features/catalog/queries'
import { useDeleteItemMutation, useToggleItemMutation } from '@/features/catalog/mutations'
import type { AdminMenuItemSummaryDTO } from '@/features/catalog/types'
import { useLang } from '@/hooks/use-lang'
import { errorMessage } from '@/lib/api'

import { ErrorCard } from './catalog-shared'
import { CategoryFilter } from './category-filter'
import { ItemCard } from './item-card'
import { CatalogItemSheet } from './catalog-form'

export function CatalogManagement() {
  const { lang } = useLang()
  const t = makeAdminT(lang)
  const [categoryId, setCategoryId] = useState<string | undefined>()
  const [sheetState, setSheetState] = useState<
    { mode: 'create' } | { mode: 'edit'; id: string } | null
  >(null)
  const [toggleTarget, setToggleTarget] = useState<AdminMenuItemSummaryDTO | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminMenuItemSummaryDTO | null>(null)

  const {
    data: categories = [],
    isLoading: isCategoriesLoading,
    isError: isCategoriesError,
    error: categoriesError,
  } = useCategoriesQuery()
  const {
    data: items = [],
    refetch: refetchItems,
    isFetching: isItemsFetching,
    isError: isItemsError,
    error: itemsError,
    isLoading: isItemsLoading,
    isSuccess: isItemsSuccess,
  } = useMenuItemsQuery(categoryId)
  const selectedCategoryName = categoryId
    ? categories.find((category) => category.id === categoryId)?.name
    : t('catalog_all')

  useShellConfig({
    title: t('catalog_title'),
    subtitle: t('catalog_subtitle'),
    contentClassName: 'bg-[var(--surface-grouped)]/45',
  })

  const toggleMutation = useToggleItemMutation()

  const deleteMutation = useDeleteItemMutation()

  const visible = items.filter(
    (item) => item.status === 'PUBLISHED' && item.availability_status !== 'HIDDEN',
  ).length
  const unavailable = items.filter(
    (item) => !item.is_available || item.availability_status !== 'AVAILABLE',
  ).length

  return (
    <>
      <ShellHeaderCenter>
        <div className="rounded-full bg-[var(--surface-grouped)]/70 px-4 py-2 text-sm font-semibold text-[var(--text-secondary)]">
          {isItemsLoading || isItemsFetching ? (
            <span className="inline-block h-4 w-36 animate-pulse rounded bg-zinc-200 dark:bg-zinc-700 font-normal align-middle" />
          ) : (
            t('catalog_summary', items.length, visible, unavailable)
          )}
        </div>
      </ShellHeaderCenter>
      <ShellHeaderActions>
        <Button className="h-10 rounded-full" onClick={() => setSheetState({ mode: 'create' })}>
          <Plus className="size-4" />
          {t('catalog_new_item')}
        </Button>
      </ShellHeaderActions>

      <div className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <CategoryFilter
          categories={categories}
          selectedId={categoryId}
          loading={isCategoriesLoading}
          t={t}
          onSelect={setCategoryId}
        />

        <section className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--text-secondary)]">
                {selectedCategoryName}
              </p>
              <h2 className="text-2xl font-bold tracking-tight text-[var(--text)]">
                {t('catalog_items_heading')}
              </h2>
            </div>
            <Button variant="secondary" className="rounded-full" onClick={() => refetchItems()}>
              {isItemsFetching && <Loader2 className="size-4 animate-spin" />}
              {t('catalog_refresh')}
            </Button>
          </div>

          {(isCategoriesError || isItemsError) && (
            <ErrorCard error={categoriesError ?? itemsError} fallback={t('catalog_load_error')} />
          )}

          {isItemsLoading && (
            <Card className="border border-[var(--separator)] bg-[var(--material-regular)] backdrop-blur-2xl">
              <CardContent className="flex items-center gap-3 p-6 text-sm text-[var(--text-secondary)]">
                <Loader2 className="size-4 animate-spin" />
                {t('catalog_loading')}
              </CardContent>
            </Card>
          )}

          {isItemsSuccess && items.length === 0 && (
            <Card className="border border-[var(--separator)] bg-[var(--material-regular)] backdrop-blur-2xl">
              <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
                <div className="flex size-14 items-center justify-center rounded-[20px] bg-[var(--surface-grouped)] text-[var(--text-tertiary)]">
                  <Utensils className="size-7" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-[var(--text)]">{t('catalog_empty_title')}</p>
                  <p className="text-sm text-[var(--text-secondary)]">{t('catalog_empty_desc')}</p>
                </div>
                <Button
                  className="rounded-[var(--radius-lg)]"
                  onClick={() => setSheetState({ mode: 'create' })}
                >
                  <Plus className="size-4" />
                  {t('catalog_new_item')}
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                category={categories.find((category) => category.id === item.category_id)}
                t={t}
                mutationPending={
                  (toggleMutation.isPending && toggleMutation.variables?.id === item.id) ||
                  (deleteMutation.isPending && deleteMutation.variables?.id === item.id)
                }
                onEdit={() => setSheetState({ mode: 'edit', id: item.id })}
                onToggle={() => setToggleTarget(item)}
                onDelete={() => setDeleteTarget(item)}
              />
            ))}
          </div>
        </section>
      </div>

      <CatalogItemSheet
        state={sheetState}
        categories={categories}
        defaultCategoryId={categoryId ?? categories[0]?.id ?? ''}
        t={t}
        onClose={() => setSheetState(null)}
      />

      {toggleTarget && (
        <SecureActionDialog
          open={Boolean(toggleTarget)}
          title={t('catalog_toggle_title')}
          description={t(
            toggleTarget.is_available ? 'catalog_toggle_off_desc' : 'catalog_toggle_on_desc',
            toggleTarget.name,
            toggleTarget.version,
          )}
          confirmText={
            toggleTarget.is_available ? t('catalog_mark_sold_out') : t('catalog_mark_available')
          }
          cancelText={t('catalog_cancel')}
          variant="warning"
          onOpenChange={(open) => !open && setToggleTarget(null)}
          onConfirm={() => {
            const item = toggleTarget!
            setToggleTarget(null)
            toggleMutation.mutate(item)
          }}
        />
      )}

      {deleteTarget && (
        <SecureActionDialog
          open={Boolean(deleteTarget)}
          title={t('catalog_delete_title')}
          description={t('catalog_delete_desc', deleteTarget.name, deleteTarget.version)}
          requireConfirmationText={deleteTarget.name}
          inputPlaceholder={t('catalog_delete_placeholder', deleteTarget.name)}
          confirmText={
            deleteMutation.isPending ? t('catalog_deleting') : t('catalog_delete_confirm')
          }
          cancelText={t('catalog_cancel')}
          variant="destructive"
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          onConfirm={() => {
            const item = deleteTarget!
            setDeleteTarget(null)
            deleteMutation.mutate(item)
          }}
        />
      )}

      {(toggleMutation.isError || deleteMutation.isError) && (
        <div className="fixed bottom-5 right-5 z-[var(--z-toast)] max-w-sm rounded-[18px] border border-[var(--system-red)]/30 bg-[var(--material-thick)] p-4 text-sm text-[var(--system-red)] shadow-xl backdrop-blur-2xl">
          {errorMessage(toggleMutation.error ?? deleteMutation.error, t('catalog_action_failed'))}
        </div>
      )}
    </>
  )
}

export default CatalogManagement
