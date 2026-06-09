import { useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, EyeOff, Loader2, Pencil, Plus, Star, Trash2, Utensils } from 'lucide-react'

import { SecureActionDialog } from '@/components/SecureActionDialog'
import { ShellHeaderActions, ShellHeaderCenter, useShellConfig } from '@/components/admin-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { makeAdminT, type AdminT } from '@/features/admin/data/i18n'
import {
  catalogQueryKeys,
  createMenuItem,
  deleteMenuItem,
  getAdminMenuItem,
  listAdminCategories,
  listAdminMenuItems,
  toggleAvailability,
  updateMenuItem,
} from '@/features/catalog/api'
import type {
  AdminCategoryDTO,
  AdminMenuItemDetailDTO,
  AdminMenuItemSummaryDTO,
  MenuItemAvailabilityStatus,
  MenuItemFormBody,
  MenuItemStatus,
  UpdateMenuItemRequest,
} from '@/features/catalog/types'
import { ApiError } from '@/lib/api'
import { useLang } from '@/lib/use-lang'
import { cn } from '@/lib/utils'

const STATUS_OPTIONS: MenuItemStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED']
const AVAILABILITY_OPTIONS: MenuItemAvailabilityStatus[] = [
  'AVAILABLE',
  'OUT_OF_STOCK',
  'TEMPORARILY_UNAVAILABLE',
  'HIDDEN',
]
const STATION_OPTIONS = ['HOTPOT', 'GRILL', 'NOODLE', 'DRINK', 'DESSERT', 'GENERAL'] as const

const blankForm = (categoryId = ''): MenuItemFormBody => ({
  category_id: categoryId,
  name: '',
  description: '',
  short_description: '',
  base_price_vnd: 0,
  image_url: '',
  is_available: true,
  availability_status: 'AVAILABLE',
  status: 'PUBLISHED',
  is_featured: false,
  is_spicy: false,
  station: '',
  display_order: 0,
})

const formFromDetail = (item: AdminMenuItemDetailDTO): MenuItemFormBody => ({
  category_id: item.category_id,
  name: item.name,
  description: item.description ?? '',
  short_description: item.short_description ?? '',
  base_price_vnd: item.base_price_vnd,
  image_url: item.image_url ?? '',
  is_available: item.is_available,
  availability_status: item.availability_status,
  status: item.status,
  is_featured: item.is_featured,
  is_spicy: item.is_spicy,
  station: item.station ?? '',
  display_order: item.display_order,
})

const moneyFormatter = new Intl.NumberFormat('vi-VN', {
  style: 'currency',
  currency: 'VND',
  maximumFractionDigits: 0,
})

const money = (value: number) => moneyFormatter.format(value)

const availabilityAfterToggle = (item: AdminMenuItemSummaryDTO) =>
  !item.is_available
    ? ('AVAILABLE' as const)
    : item.availability_status === 'HIDDEN'
      ? ('HIDDEN' as const)
      : ('OUT_OF_STOCK' as const)

export function CatalogManagement() {
  const { lang } = useLang()
  const t = makeAdminT(lang)
  const queryClient = useQueryClient()
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
  } = useQuery({
    queryKey: catalogQueryKeys.categories,
    queryFn: listAdminCategories,
  })
  const {
    data: items = [],
    refetch: refetchItems,
    isFetching: isItemsFetching,
    isError: isItemsError,
    error: itemsError,
    isLoading: isItemsLoading,
    isSuccess: isItemsSuccess,
  } = useQuery({
    queryKey: catalogQueryKeys.items(categoryId),
    queryFn: () => listAdminMenuItems(categoryId),
  })
  const selectedCategoryName = categoryId
    ? categories.find((category) => category.id === categoryId)?.name
    : t('catalog_all')

  useShellConfig({
    title: t('catalog_title'),
    subtitle: t('catalog_subtitle'),
    contentClassName: 'bg-[var(--surface-grouped)]/45',
  })

  const invalidateCatalog = async () => {
    await queryClient.invalidateQueries({ queryKey: ['catalog'] })
  }



  const toggleMutation = useMutation({
    mutationFn: (item: AdminMenuItemSummaryDTO) =>
      toggleAvailability(item.id, !item.is_available, item.version, availabilityAfterToggle(item)),
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: ['catalog', 'items'] })
      const snapshots = queryClient.getQueriesData<AdminMenuItemSummaryDTO[]>({
        queryKey: ['catalog', 'items'],
      })
      queryClient.setQueriesData<AdminMenuItemSummaryDTO[]>(
        { queryKey: ['catalog', 'items'] },
        (current) =>
          current?.map((candidate) =>
            candidate.id === item.id
              ? {
                  ...candidate,
                  is_available: !item.is_available,
                  availability_status: availabilityAfterToggle(item),
                  version: item.version + 1,
                }
              : candidate,
          ),
      )
      return { snapshots }
    },
    onSuccess: (result, item) => {
      queryClient.setQueriesData<AdminMenuItemSummaryDTO[]>(
        { queryKey: ['catalog', 'items'] },
        (current) =>
          current?.map((candidate) =>
            candidate.id === item.id ? { ...candidate, version: result.version } : candidate,
          ),
      )
    },
    onError: async (error, _item, context) => {
      for (const [key, data] of context?.snapshots ?? []) queryClient.setQueryData(key, data)
      if (error instanceof ApiError && error.status === 409) await invalidateCatalog()
    },
    onSettled: invalidateCatalog,
  })

  const refreshConflict = async (error: unknown) => {
    if (error instanceof ApiError && error.status === 409) await invalidateCatalog()
  }

  const deleteMutation = useMutation({
    mutationFn: (item: AdminMenuItemSummaryDTO) => deleteMenuItem(item.id, item.version),
    onSuccess: async () => {
      setDeleteTarget(null)
      await queryClient.invalidateQueries({ queryKey: ['catalog'] })
      await invalidateCatalog()
    },
    onError: async (error) => {
      setDeleteTarget(null)
      await refreshConflict(error)
    },
  })

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
          {t('catalog_summary', items.length, visible, unavailable)}
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
            <Button
              variant="secondary"
              className="rounded-full"
              onClick={() => refetchItems()}
            >
              {isItemsFetching && <Loader2 className="size-4 animate-spin" />}
              {t('catalog_refresh')}
            </Button>
          </div>

          {(isCategoriesError || isItemsError) && (
            <ErrorCard
              error={categoriesError ?? itemsError}
              fallback={t('catalog_load_error')}
            />
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
        onSaved={invalidateCatalog}
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
            const item = toggleTarget
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
          onConfirm={() => deleteMutation.mutate(deleteTarget)}
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

function CategoryFilter({
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
      <button
        type="button"
        className={categoryButtonClass(!selectedId)}
        onClick={() => onSelect(undefined)}
      >
        <span>{t('catalog_all')}</span>
        <span className="text-xs text-[var(--text-tertiary)]">{t('catalog_all_hint')}</span>
      </button>
      {loading && (
        <p className="px-3 py-4 text-sm text-[var(--text-secondary)]">{t('catalog_loading')}</p>
      )}
      {categories.map((category) => (
        <button
          key={category.id}
          type="button"
          className={categoryButtonClass(selectedId === category.id)}
          onClick={() => onSelect(category.id)}
        >
          <span>{category.name}</span>
          <span className="text-xs text-[var(--text-tertiary)]">#{category.display_order}</span>
        </button>
      ))}
    </aside>
  )
}

function categoryButtonClass(active: boolean) {
  return cn(
    'mb-1 flex w-full cursor-pointer items-center justify-between rounded-[16px] px-3 py-3 text-left text-sm font-semibold transition-colors duration-[220ms] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--system-purple)]/20',
    active
      ? 'bg-[var(--system-purple)] text-white shadow-sm [&_span:last-child]:text-white/75'
      : 'text-[var(--text-secondary)] hover:bg-[var(--surface-grouped)] hover:text-[var(--text)]',
  )
}

function ItemCard({
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

function StatusBadge({ status, t }: { status: MenuItemStatus; t: AdminT }) {
  if (status === 'PUBLISHED')
    return <Badge variant="success">{t('catalog_status_published')}</Badge>
  if (status === 'ARCHIVED') return <Badge variant="warning">{t('catalog_status_archived')}</Badge>
  return <Badge variant="secondary">{t('catalog_status_draft')}</Badge>
}

function AvailabilityBadge({ item, t }: { item: AdminMenuItemSummaryDTO; t: AdminT }) {
  if (item.availability_status === 'HIDDEN')
    return <Badge variant="warning">{t('catalog_availability_hidden')}</Badge>
  if (!item.is_available || item.availability_status === 'OUT_OF_STOCK') {
    return <Badge variant="warning">{t('catalog_availability_sold_out')}</Badge>
  }
  if (item.availability_status === 'TEMPORARILY_UNAVAILABLE') {
    return <Badge variant="warning">{t('catalog_availability_temporarily_unavailable')}</Badge>
  }
  return <Badge variant="success">{t('catalog_availability_available')}</Badge>
}

function CatalogItemSheet({
  state,
  categories,
  defaultCategoryId,
  t,
  onClose,
  onSaved,
}: {
  state: { mode: 'create' } | { mode: 'edit'; id: string } | null
  categories: AdminCategoryDTO[]
  defaultCategoryId: string
  t: AdminT
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const editingId = state?.mode === 'edit' ? state.id : undefined
  const {
    data: detail,
    isLoading: isDetailLoading,
    error: detailError,
  } = useQuery({
    queryKey: editingId
      ? catalogQueryKeys.detail(editingId)
      : ['catalog', 'items', 'detail', 'new'],
    queryFn: () => getAdminMenuItem(editingId ?? ''),
    enabled: Boolean(editingId),
  })
  const open = state !== null
  const initialForm =
    state?.mode === 'edit' && detail ? formFromDetail(detail) : blankForm(defaultCategoryId)
  const formKey =
    state?.mode === 'edit' && detail
      ? `${detail.id}:${detail.version}`
      : `create:${defaultCategoryId}`

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="w-full bg-[var(--material-thick)] sm:max-w-xl">
        <SheetHeader
          title={state?.mode === 'edit' ? t('catalog_edit_title') : t('catalog_create_title')}
          subtitle={
            state?.mode === 'edit' && detail
              ? `${detail.name} · v${detail.version}`
              : t('catalog_sheet_subtitle')
          }
        />
        {state?.mode === 'edit' && isDetailLoading ? (
          <div className="flex flex-1 items-center justify-center gap-3 text-sm text-[var(--text-secondary)]">
            <Loader2 className="size-4 animate-spin" />
            {t('catalog_loading_detail')}
          </div>
        ) : (
          <CatalogItemForm
            key={formKey}
            state={state}
            detail={detail}
            initialForm={initialForm}
            categories={categories}
            detailError={detailError}
            t={t}
            onClose={onClose}
            onSaved={onSaved}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

function CatalogItemForm({
  state,
  detail,
  initialForm,
  categories,
  detailError,
  t,
  onClose,
  onSaved,
}: {
  state: { mode: 'create' } | { mode: 'edit'; id: string } | null
  detail?: AdminMenuItemDetailDTO
  initialForm: MenuItemFormBody
  categories: AdminCategoryDTO[]
  detailError: unknown
  t: AdminT
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<MenuItemFormBody>(() => initialForm)
  const [pendingPriceUpdate, setPendingPriceUpdate] = useState<UpdateMenuItemRequest | null>(null)

  const createMutation = useMutation({
    mutationFn: createMenuItem,
    onSuccess: async () => {
      onClose()
      await queryClient.invalidateQueries({ queryKey: ['catalog'] })
      await onSaved()
    },
  })
  const updateMutation = useMutation({
    mutationFn: updateMenuItem,
    onSuccess: async (result) => {
      if (detail?.id)
        await queryClient.invalidateQueries({ queryKey: catalogQueryKeys.detail(detail.id) })
      if (result?.id)
        await queryClient.invalidateQueries({ queryKey: catalogQueryKeys.detail(result.id) })
      onClose()
      await onSaved()
    },
    onError: async (error) => {
      setPendingPriceUpdate(null)
      if (error instanceof ApiError && error.status === 409) {
        if (detail?.id)
          await queryClient.invalidateQueries({ queryKey: catalogQueryKeys.detail(detail.id) })
        await onSaved()
      }
    },
  })

  const busy = createMutation.isPending || updateMutation.isPending
  const valid =
    form.category_id &&
    form.name.trim() &&
    Number.isFinite(form.base_price_vnd) &&
    form.base_price_vnd >= 0

  const updateField = <K extends keyof MenuItemFormBody>(key: K, value: MenuItemFormBody[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!valid) return
    if (state?.mode === 'create') {
      createMutation.mutate(normalizeForm(form))
      return
    }
    if (!detail) return
    const payload: UpdateMenuItemRequest = {
      ...normalizeForm(form),
      id: detail.id,
      version: detail.version,
    }
    if (payload.base_price_vnd !== detail.base_price_vnd) {
      setPendingPriceUpdate(payload)
      return
    }
    updateMutation.mutate(payload)
  }

  return (
    <>
      <form className="flex flex-1 flex-col overflow-hidden" onSubmit={handleSubmit}>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-5">
          <FormError error={detailError ?? createMutation.error ?? updateMutation.error} t={t} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('catalog_field_category')}>
              <select
                className="h-10 w-full rounded-[10px] border border-transparent bg-[var(--surface-grouped)] px-[14px] text-sm text-[var(--text)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--system-blue)]/18"
                value={form.category_id}
                onChange={(event) => updateField('category_id', event.target.value)}
                required
              >
                <option value="">{t('catalog_pick_category')}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('catalog_field_name')}>
              <Input
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder={t('catalog_name_placeholder')}
                required
              />
            </Field>
          </div>

          <Field label={t('catalog_field_short_description')}>
            <Input
              value={form.short_description}
              onChange={(event) => updateField('short_description', event.target.value)}
              placeholder={t('catalog_short_placeholder')}
            />
          </Field>

          <Field label={t('catalog_field_description')}>
            <Textarea
              className="min-h-24"
              value={form.description}
              onChange={(event) => updateField('description', event.target.value)}
              placeholder={t('catalog_desc_placeholder')}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('catalog_field_price')}>
              <Input
                type="number"
                min={0}
                step={1000}
                value={form.base_price_vnd}
                onChange={(event) => updateField('base_price_vnd', Number(event.target.value))}
                required
              />
            </Field>
            <Field label={t('catalog_field_image')}>
              <Input
                value={form.image_url}
                onChange={(event) => updateField('image_url', event.target.value)}
                placeholder="https://"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label={t('catalog_field_status')}>
              <select
                className="h-10 w-full rounded-[10px] border border-transparent bg-[var(--surface-grouped)] px-[14px] text-sm text-[var(--text)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--system-blue)]/18"
                value={form.status}
                onChange={(event) => updateField('status', event.target.value as MenuItemStatus)}
              >
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {t(`catalog_status_${status.toLowerCase()}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('catalog_field_availability')}>
              <select
                className="h-10 w-full rounded-[10px] border border-transparent bg-[var(--surface-grouped)] px-[14px] text-sm text-[var(--text)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--system-blue)]/18"
                value={form.availability_status}
                onChange={(event) =>
                  updateField(
                    'availability_status',
                    event.target.value as MenuItemAvailabilityStatus,
                  )
                }
              >
                {AVAILABILITY_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {t(`catalog_availability_${status.toLowerCase()}`)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('catalog_field_station')}>
              <select
                className="h-10 w-full rounded-[10px] border border-transparent bg-[var(--surface-grouped)] px-[14px] text-sm text-[var(--text)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--system-blue)]/18"
                value={form.station}
                onChange={(event) => updateField('station', event.target.value)}
              >
                <option value="">{t('catalog_station_placeholder')}</option>
                {STATION_OPTIONS.map((station) => (
                  <option key={station} value={station}>
                    {station}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('catalog_field_display_order')}>
              <Input
                type="number"
                value={form.display_order}
                onChange={(event) => updateField('display_order', Number(event.target.value))}
              />
            </Field>
            <div className="grid grid-cols-3 gap-2 pt-6">
              <ToggleBox
                label={t('catalog_field_available')}
                checked={form.is_available}
                onChange={(checked) => updateField('is_available', checked)}
              />
              <ToggleBox
                label={t('catalog_field_featured')}
                checked={form.is_featured}
                onChange={(checked) => updateField('is_featured', checked)}
              />
              <ToggleBox
                label={t('catalog_field_spicy')}
                checked={form.is_spicy}
                onChange={(checked) => updateField('is_spicy', checked)}
              />
            </div>
          </div>

          {detail && <ReadonlyNested detail={detail} t={t} />}
        </div>

        <div className="flex gap-2 border-t border-[var(--separator)] p-4">
          <Button
            type="button"
            variant="secondary"
            className="flex-1 rounded-[var(--radius-lg)]"
            onClick={onClose}
          >
            {t('catalog_cancel')}
          </Button>
          <Button
            type="submit"
            className="flex-1 rounded-[var(--radius-lg)]"
            disabled={!valid || busy}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {state?.mode === 'edit' ? t('catalog_save_changes') : t('catalog_create_confirm')}
          </Button>
        </div>
      </form>

      {pendingPriceUpdate && detail && (
        <SecureActionDialog
          open={Boolean(pendingPriceUpdate)}
          title={t('catalog_price_title')}
          description={t(
            'catalog_price_desc',
            detail.name,
            money(detail.base_price_vnd),
            money(pendingPriceUpdate.base_price_vnd),
            pendingPriceUpdate.version,
          )}
          confirmText={updateMutation.isPending ? t('catalog_saving') : t('catalog_price_confirm')}
          cancelText={t('catalog_cancel')}
          variant="warning"
          onOpenChange={(open) => !open && setPendingPriceUpdate(null)}
          onConfirm={() => {
            const payload = pendingPriceUpdate
            setPendingPriceUpdate(null)
            updateMutation.mutate(payload)
          }}
        />
      )}
    </>
  )
}

function normalizeForm(form: MenuItemFormBody): MenuItemFormBody {
  return {
    ...form,
    name: form.name.trim(),
    description: form.description.trim(),
    short_description: form.short_description.trim(),
    image_url: form.image_url.trim(),
    station: form.station.trim(),
    base_price_vnd: Math.max(0, Math.round(Number(form.base_price_vnd) || 0)),
    display_order: Math.round(Number(form.display_order) || 0),
  }
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-[var(--text-secondary)]">{label}</Label>
      {children}
    </div>
  )
}

function ToggleBox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-[14px] border px-3 py-3 text-sm font-semibold transition-colors duration-[220ms]',
        checked
          ? 'border-[var(--system-blue)]/30 bg-[var(--system-blue)]/10 text-[var(--system-blue)]'
          : 'border-[var(--separator)] bg-[var(--surface-grouped)] text-[var(--text-secondary)]',
      )}
      onClick={() => onChange(!checked)}
    >
      {label}
    </button>
  )
}

function ReadonlyNested({ detail, t }: { detail: AdminMenuItemDetailDTO; t: AdminT }) {
  const variantCount = detail.variants?.length ?? 0
  const optionCount =
    detail.option_groups?.reduce((sum, group) => sum + (group.options?.length ?? 0), 0) ?? 0
  if (variantCount === 0 && optionCount === 0) return null
  return (
    <Card className="border border-[var(--separator)] bg-[var(--surface-grouped)]/70 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-bold text-[var(--text)]">
        <AlertTriangle className="size-4 text-[var(--system-orange)]" />
        {t('catalog_readonly_variants_title')}
      </div>
      <p className="text-sm text-[var(--text-secondary)]">
        {t('catalog_readonly_variants_desc', variantCount, optionCount)}
      </p>
    </Card>
  )
}

function ErrorCard({ error, fallback }: { error: unknown; fallback: string }) {
  return (
    <Card className="border border-[var(--system-red)]/30 bg-[var(--system-red)]/5">
      <CardContent className="p-5 text-sm text-[var(--system-red)]">
        {errorMessage(error, fallback)}
      </CardContent>
    </Card>
  )
}

function FormError({ error, t }: { error: unknown; t: AdminT }) {
  if (!error) return null
  return (
    <div className="rounded-[16px] border border-[var(--system-red)]/30 bg-[var(--system-red)]/5 p-3 text-sm text-[var(--system-red)]">
      {errorMessage(error, t('catalog_action_failed'))}
    </div>
  )
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return fallback
}

export default CatalogManagement
