import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, type Resolver } from 'react-hook-form'

import { SecureActionDialog } from '@/components/SecureActionDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { ImageUploader } from '@/features/catalog/components/image-uploader'
import type { AdminT } from '@/features/admin/data/i18n'
import { useMenuItemDetailQuery } from '@/features/catalog/queries'
import { useCreateItemMutation, useUpdateItemMutation } from '@/features/catalog/mutations'
import type {
  AdminCategoryDTO,
  AdminMenuItemDetailDTO,
  MenuItemFormBody,
  UpdateMenuItemRequest,
} from '@/features/catalog/types'
import { money } from '@/features/catalog/helper/utils'
import { ToggleBox, ReadonlyNested, FormError } from './catalog-shared'
import {
  STATUS_OPTIONS,
  AVAILABILITY_OPTIONS,
  STATION_OPTIONS,
  catalogFormSchema,
  blankForm,
  formFromDetail,
  normalizeForm,
} from '@/features/catalog/types/schema'

export function CatalogItemSheet({
  state,
  categories,
  defaultCategoryId,
  t,
  onClose,
}: {
  state: { mode: 'create' } | { mode: 'edit'; id: string } | null
  categories: AdminCategoryDTO[]
  defaultCategoryId: string
  t: AdminT
  onClose: () => void
}) {
  const editingId = state?.mode === 'edit' ? state.id : undefined
  const {
    data: detail,
    isLoading: isDetailLoading,
    error: detailError,
  } = useMenuItemDetailQuery(editingId)
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
}: {
  state: { mode: 'create' } | { mode: 'edit'; id: string } | null
  detail?: AdminMenuItemDetailDTO
  initialForm: MenuItemFormBody
  categories: AdminCategoryDTO[]
  detailError: unknown
  t: AdminT
  onClose: () => void
}) {
  const hookForm = useForm<z.infer<typeof catalogFormSchema>>({
    resolver: zodResolver(catalogFormSchema) as Resolver<z.infer<typeof catalogFormSchema>>,
    defaultValues: initialForm,
  })
  const [pendingPriceUpdate, setPendingPriceUpdate] = useState<UpdateMenuItemRequest | null>(null)

  const createMutation = useCreateItemMutation(async () => {
    onClose()
  })
  const updateMutation = useUpdateItemMutation(
    async () => {
      onClose()
    },
    () => setPendingPriceUpdate(null),
  )

  const busy = createMutation.isPending || updateMutation.isPending

  const onSubmit = (data: z.infer<typeof catalogFormSchema>) => {
    const normalized = normalizeForm(data as MenuItemFormBody)
    if (state?.mode === 'create') {
      createMutation.mutate(normalized)
      return
    }
    if (!detail) return
    const payload: UpdateMenuItemRequest = {
      ...normalized,
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
      <Form {...hookForm}>
        <form className="flex flex-1 flex-col overflow-hidden" onSubmit={hookForm.handleSubmit(onSubmit)}>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-5">
          <FormError error={detailError ?? createMutation.error ?? updateMutation.error} t={t} />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={hookForm.control}
              name="category_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('catalog_field_category')}</FormLabel>
                  <Select onValueChange={(val) => field.onChange(val === 'none' ? '' : val)} value={field.value || 'none'}>
                    <FormControl>
                      <SelectTrigger className="h-10 w-full rounded-[10px] bg-[var(--surface-grouped)] text-sm text-[var(--text)] border-transparent focus:ring-[3px] focus:ring-[var(--system-blue)]/18">
                        <SelectValue placeholder={t('catalog_pick_category')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">{t('catalog_pick_category')}</SelectItem>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={hookForm.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('catalog_field_name')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('catalog_name_placeholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={hookForm.control}
            name="short_description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('catalog_field_short_description')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('catalog_short_placeholder')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={hookForm.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('catalog_field_description')}</FormLabel>
                <FormControl>
                  <Textarea className="min-h-24" placeholder={t('catalog_desc_placeholder')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={hookForm.control}
              name="base_price_vnd"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('catalog_field_price')}</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} step={1000} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={hookForm.control}
              name="image_url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('catalog_field_image')}</FormLabel>
                  <FormControl>
                    <ImageUploader
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      disabled={busy}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <FormField
              control={hookForm.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('catalog_field_status')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-10 w-full rounded-[10px] bg-[var(--surface-grouped)] text-sm text-[var(--text)] border-transparent focus:ring-[3px] focus:ring-[var(--system-blue)]/18">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {STATUS_OPTIONS.map((status) => (
                        <SelectItem key={status} value={status}>
                          {t(`catalog_status_${status.toLowerCase()}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={hookForm.control}
              name="availability_status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('catalog_field_availability')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-10 w-full rounded-[10px] bg-[var(--surface-grouped)] text-sm text-[var(--text)] border-transparent focus:ring-[3px] focus:ring-[var(--system-blue)]/18">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {AVAILABILITY_OPTIONS.map((status) => (
                        <SelectItem key={status} value={status}>
                          {t(`catalog_availability_${status.toLowerCase()}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={hookForm.control}
              name="station"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('catalog_field_station')}</FormLabel>
                  <Select onValueChange={(val) => field.onChange(val === 'none' ? '' : val)} value={field.value || 'none'}>
                    <FormControl>
                      <SelectTrigger className="h-10 w-full rounded-[10px] bg-[var(--surface-grouped)] text-sm text-[var(--text)] border-transparent focus:ring-[3px] focus:ring-[var(--system-blue)]/18">
                        <SelectValue placeholder={t('catalog_station_placeholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">{t('catalog_station_placeholder')}</SelectItem>
                      {STATION_OPTIONS.map((station) => (
                        <SelectItem key={station} value={station}>
                          {t(`catalog_station_${station.toLowerCase()}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={hookForm.control}
              name="display_order"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('catalog_field_display_order')}</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-3 gap-2 pt-6">
              <FormField
                control={hookForm.control}
                name="is_available"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <ToggleBox
                        label={t('catalog_field_available')}
                        checked={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={hookForm.control}
                name="is_featured"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <ToggleBox
                        label={t('catalog_field_featured')}
                        checked={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={hookForm.control}
                name="is_spicy"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <ToggleBox
                        label={t('catalog_field_spicy')}
                        checked={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
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
            disabled={busy}
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {state?.mode === 'edit' ? t('catalog_save_changes') : t('catalog_create_confirm')}
          </Button>
        </div>
      </form>
      </Form>

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
