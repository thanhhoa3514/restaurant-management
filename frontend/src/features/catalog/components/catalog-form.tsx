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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ImageUploader } from '@/features/catalog/components/image-uploader'
import type { AdminT } from '@/i18n'
import { useMenuItemDetailQuery } from '@/features/catalog/queries'
import { useCreateItemMutation, useUpdateItemMutation } from '@/features/catalog/mutations'
import type {
  AdminCategoryDTO,
  AdminMenuItemDetailDTO,
  MenuItemFormBody,
  UpdateMenuItemRequest,
} from '@/features/catalog/types'
import { money } from '@/features/catalog/helper/utils'
import { FeatureToggleCard, FormError } from './catalog-shared'
import { VariantsOptionsEditor } from './variants-options-editor'
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

  const title = state?.mode === 'edit' ? t('catalog_edit_title') : t('catalog_create_title')
  const subtitle =
    state?.mode === 'edit' && detail
      ? `${detail.name} · v${detail.version}`
      : t('catalog_sheet_subtitle')

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="flex w-[95vw] max-w-2xl h-[85vh] max-h-[85vh] flex-col gap-0 overflow-hidden bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-0 sm:max-w-3xl rounded-2xl">
        <DialogHeader className="shrink-0 border-b border-zinc-200 dark:border-zinc-800 px-6 py-4 text-left bg-zinc-50 dark:bg-zinc-900/90">
          <DialogTitle className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {title}
          </DialogTitle>
          {subtitle && (
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">
              {subtitle}
            </p>
          )}
        </DialogHeader>

        {state?.mode === 'edit' && isDetailLoading ? (
          <div className="flex flex-1 items-center justify-center gap-3 text-sm text-zinc-500 py-16">
            <Loader2 className="size-4 animate-spin text-blue-600" />
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
      </DialogContent>
    </Dialog>
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
  const [activeTab, setActiveTab] = useState('info')
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

  const variants = hookForm.watch('variants') ?? []
  const optionGroups = hookForm.watch('option_groups') ?? []

  return (
    <>
      <Form {...hookForm}>
        <form
          className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-zinc-900"
          onSubmit={hookForm.handleSubmit(onSubmit)}
        >
          {/* Solid Navigation Tabs Header */}
          <div className="shrink-0 border-b border-zinc-200 dark:border-zinc-800 px-6 pt-3 pb-2 bg-zinc-100 dark:bg-zinc-800/80">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="w-full grid grid-cols-3 bg-zinc-200/70 dark:bg-zinc-800 p-1 rounded-xl h-10">
                <TabsTrigger
                  value="info"
                  className="rounded-lg text-xs font-bold gap-1.5 cursor-pointer"
                >
                  Thông tin món
                </TabsTrigger>
                <TabsTrigger
                  value="options"
                  className="rounded-lg text-xs font-bold gap-1.5 cursor-pointer"
                >
                  Biến thể & Topping
                  {(variants.length > 0 || optionGroups.length > 0) && (
                    <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-blue-600 text-white font-black">
                      {variants.length + optionGroups.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="status"
                  className="rounded-lg text-xs font-bold gap-1.5 cursor-pointer"
                >
                  Trạm bếp & Trạng thái
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5 bg-white dark:bg-zinc-900">
            <FormError error={detailError ?? createMutation.error ?? updateMutation.error} t={t} />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              {/* TAB 1: THÔNG TIN CHUNG */}
              <TabsContent value="info" className="space-y-4 mt-0">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={hookForm.control}
                    name="category_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('catalog_field_category')}</FormLabel>
                        <Select
                          onValueChange={(val) => field.onChange(val === 'none' ? '' : val)}
                          value={field.value || 'none'}
                        >
                          <FormControl>
                            <SelectTrigger className="h-10 w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-sm font-medium">
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
                          <Input
                            placeholder={t('catalog_name_placeholder')}
                            className="bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={hookForm.control}
                    name="base_price_vnd"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('catalog_field_price')}</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={1000}
                            className="font-mono bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={hookForm.control}
                    name="short_description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('catalog_field_short_description')}</FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('catalog_short_placeholder')}
                            className="bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={hookForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('catalog_field_description')}</FormLabel>
                      <FormControl>
                        <Textarea
                          className="min-h-20 bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                          placeholder={t('catalog_desc_placeholder')}
                          {...field}
                        />
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
              </TabsContent>

              {/* TAB 2: BIẾN THỂ & TOPPING */}
              <TabsContent value="options" className="mt-0">
                <VariantsOptionsEditor
                  variants={variants}
                  optionGroups={optionGroups}
                  onVariantsChange={(nextVariants) =>
                    hookForm.setValue('variants', nextVariants, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  onOptionGroupsChange={(nextGroups) =>
                    hookForm.setValue('option_groups', nextGroups, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                />
              </TabsContent>

              {/* TAB 3: TRẠNG THÁI & TRẠM BẾP */}
              <TabsContent value="status" className="space-y-5 mt-0">
                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField
                    control={hookForm.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('catalog_field_status')}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-10 w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
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
                            <SelectTrigger className="h-10 w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
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
                        <Select
                          onValueChange={(val) => field.onChange(val === 'none' ? '' : val)}
                          value={field.value || 'none'}
                        >
                          <FormControl>
                            <SelectTrigger className="h-10 w-full rounded-xl bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700">
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

                <FormField
                  control={hookForm.control}
                  name="display_order"
                  render={({ field }) => (
                    <FormItem className="max-w-xs">
                      <FormLabel>{t('catalog_field_display_order')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          className="bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Feature Toggles: Solid Clean Switch Cards */}
                <div className="pt-2">
                  <FormLabel className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2.5 block">
                    Đặc tính món ăn
                  </FormLabel>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <FormField
                      control={hookForm.control}
                      name="is_available"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <FeatureToggleCard
                              label={t('catalog_field_available')}
                              activeColor="green"
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
                            <FeatureToggleCard
                              label={t('catalog_field_featured')}
                              activeColor="amber"
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
                            <FeatureToggleCard
                              label={t('catalog_field_spicy')}
                              activeColor="red"
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
              </TabsContent>
            </Tabs>
          </div>

          <div className="flex shrink-0 gap-3 border-t border-zinc-200 dark:border-zinc-800 p-4 bg-zinc-50 dark:bg-zinc-900">
            <Button
              type="button"
              variant="secondary"
              className="flex-1 rounded-xl cursor-pointer font-bold bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
              onClick={onClose}
            >
              {t('catalog_cancel')}
            </Button>
            <Button
              type="submit"
              className="flex-1 rounded-xl cursor-pointer font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md"
              disabled={busy}
            >
              {busy && <Loader2 className="size-4 animate-spin mr-1.5" />}
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
