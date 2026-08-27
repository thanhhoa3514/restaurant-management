import { useEffect, useMemo, useState } from 'react'
import { CircleAlert, Loader2, Pencil, Plus, Trash2, Utensils } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Badge, type badgeVariants } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { useLang } from '@/hooks/use-lang'
import { formatVND } from '@/features/ordering/helpers'
import { createCombo, deleteCombo, getAdminCombo, updateCombo } from '@/features/catalog/api'
import { useAdminCombosQuery, useAllMenuItemsQuery } from '@/features/catalog/queries'
import { errorMessage } from '@/lib/api'
import type {
  AdminComboSummaryDTO,
  ComboComponentInput,
  MenuItemAvailabilityStatus,
  MenuItemStatus,
} from '@/features/catalog/types'

import './combo-management.css'

type Draft = {
  name: string
  description: string
  price: string
  image: string
  status: MenuItemStatus
  availabilityStatus: MenuItemAvailabilityStatus
  components: ComboComponentInput[]
}

const emptyDraft: Draft = {
  name: '',
  description: '',
  price: '',
  image: '',
  status: 'DRAFT',
  availabilityStatus: 'HIDDEN',
  components: [],
}

type BadgeVariant = NonNullable<Parameters<typeof badgeVariants>[0]>['variant']

function statusVariant(status: AdminComboSummaryDTO['status']): BadgeVariant {
  if (status === 'PUBLISHED') return 'success'
  if (status === 'ARCHIVED') return 'destructive'
  return 'warning'
}

function statusLabel(status: AdminComboSummaryDTO['status'], vi: boolean): string {
  if (status === 'PUBLISHED') return vi ? 'Đã xuất bản' : 'Published'
  if (status === 'ARCHIVED') return vi ? 'Đã lưu trữ' : 'Archived'
  return vi ? 'Bản nháp' : 'Draft'
}

function availabilityLabel(item: AdminComboSummaryDTO, vi: boolean): string {
  return availabilityStatusLabel(item.availability_status, vi)
}

function availabilityStatusLabel(status: MenuItemAvailabilityStatus, vi: boolean): string {
  const labels: Record<MenuItemAvailabilityStatus, [string, string]> = {
    AVAILABLE: ['Đang bán', 'Available'],
    OUT_OF_STOCK: ['Hết món', 'Out of stock'],
    TEMPORARILY_UNAVAILABLE: ['Tạm hết', 'Temporarily unavailable'],
    HIDDEN: ['Tạm ẩn', 'Hidden'],
  }
  return labels[status][vi ? 0 : 1]
}

export function ComboManagement() {
  const { lang } = useLang()
  const vi = lang === 'vi'
  const queryClient = useQueryClient()
  const { data, isLoading } = useAdminCombosQuery()
  const { data: menuItems = [] } = useAllMenuItemsQuery()
  const [editing, setEditing] = useState<AdminComboSummaryDTO | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [componentId, setComponentId] = useState('')
  const [componentQty, setComponentQty] = useState('1')

  const detail = useQuery({
    queryKey: ['catalog', 'combos', 'detail', editing?.id],
    queryFn: () => getAdminCombo(editing!.id),
    enabled: !!editing && formOpen,
  })

  useEffect(() => {
    if (!editing || !detail.data) return
    // The local form draft mirrors the asynchronously loaded combo detail.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft({
      name: detail.data.name,
      description: detail.data.description ?? '',
      price: String(detail.data.combo_price_vnd),
      image: detail.data.image_url ?? '',
      status: detail.data.status,
      availabilityStatus: detail.data.availability_status,
      components: detail.data.components.map((component, index) => ({
        menu_item_id: component.menu_item_id,
        variant_id: component.variant_id,
        quantity: component.quantity,
        display_order: index + 1,
      })),
    })
  }, [editing, detail.data])

  const menuItemById = useMemo(() => new Map(menuItems.map((item) => [item.id, item])), [menuItems])

  const items = data?.items ?? []
  const totalCount = data?.pagination.total_items ?? items.length
  const publishedCount =
    data?.pagination.visible ?? items.filter((item) => item.status === 'PUBLISHED').length
  const draftCount = items.filter((item) => item.status === 'DRAFT').length
  const unavailableCount =
    data?.pagination.unavailable ?? items.filter((item) => !item.is_available).length

  const reference = useMemo(
    () =>
      draft.components.reduce(
        (sum, component) =>
          sum +
          (menuItemById.get(component.menu_item_id)?.base_price_vnd ?? 0) * component.quantity,
        0,
      ),
    [draft.components, menuItemById],
  )
  const savings = Math.max(0, reference - (Number(draft.price) || 0))

  const closeEditor = () => {
    setFormOpen(false)
    setEditing(null)
    setDraft(emptyDraft)
    setComponentId('')
    setComponentQty('1')
  }

  const openCreate = () => {
    setEditing(null)
    setDraft(emptyDraft)
    setComponentId('')
    setComponentQty('1')
    setFormOpen(true)
  }

  const openEdit = (item: AdminComboSummaryDTO) => {
    setEditing(item)
    setDraft(emptyDraft)
    setComponentId('')
    setComponentQty('1')
    setFormOpen(true)
  }

  const save = useMutation({
    mutationFn: () =>
      editing
        ? updateCombo(editing.id, {
            name: draft.name,
            description: draft.description,
            image_url: draft.image,
            combo_price_vnd: Number(draft.price),
            status: draft.status,
            availability_status: draft.availabilityStatus,
            is_featured: editing.is_featured,
            display_order: editing.display_order,
            version: editing.version,
            components: draft.components,
          })
        : createCombo({
            name: draft.name,
            description: draft.description,
            image_url: draft.image,
            combo_price_vnd: Number(draft.price),
            status: draft.status,
            availability_status: draft.availabilityStatus,
            is_featured: false,
            display_order: 0,
            components: draft.components,
          }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['catalog', 'combos'] })
      closeEditor()
    },
  })

  const remove = useMutation({
    mutationFn: (item: AdminComboSummaryDTO) => deleteCombo(item.id, item.version),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['catalog', 'combos'] }),
  })

  const addComponent = () => {
    if (!componentId) return
    const quantity = Math.max(1, Number(componentQty) || 1)
    setDraft((current) => {
      const existing = current.components.findIndex(
        (component) => component.menu_item_id === componentId,
      )
      if (existing >= 0) {
        return {
          ...current,
          components: current.components.map((component, index) =>
            index === existing
              ? { ...component, quantity: component.quantity + quantity }
              : component,
          ),
        }
      }
      return {
        ...current,
        components: [
          ...current.components,
          {
            menu_item_id: componentId,
            quantity,
            display_order: current.components.length + 1,
          },
        ],
      }
    })
    setComponentId('')
    setComponentQty('1')
  }

  return (
    <div className="combo-admin">
      <header className="combo-admin__header">
        <div>
          <p className="combo-admin__kicker">{vi ? 'Catalog / 02' : 'Catalog / 02'}</p>
          <h2 className="combo-admin__title">{vi ? 'Combo & set menu' : 'Combos & set menus'}</h2>
          <p className="combo-admin__intro">
            {vi
              ? 'Định nghĩa phần ăn cố định, giá bán và những món sẽ được tách xuống các trạm bếp.'
              : 'Define fixed-price bundles, selling price, and the dishes that fan out to kitchen stations.'}
          </p>
        </div>
        <Button className="combo-admin__new-button" onClick={openCreate}>
          <Plus />
          {vi ? 'Tạo combo' : 'New combo'}
        </Button>
      </header>

      <div className="combo-admin__stats" aria-label={vi ? 'Tổng quan combo' : 'Combo overview'}>
        <div className="combo-admin__stat">
          <span className="combo-admin__stat-label">{vi ? 'Tổng số' : 'Total'}</span>
          <strong className="combo-admin__stat-value">{totalCount}</strong>
        </div>
        <div className="combo-admin__stat">
          <span className="combo-admin__stat-label">{vi ? 'Đang bán' : 'Published'}</span>
          <strong className="combo-admin__stat-value">{publishedCount}</strong>
        </div>
        <div className="combo-admin__stat">
          <span className="combo-admin__stat-label">{vi ? 'Bản nháp' : 'Drafts'}</span>
          <strong className="combo-admin__stat-value">{draftCount}</strong>
        </div>
        <div className="combo-admin__stat">
          <span className="combo-admin__stat-label">{vi ? 'Tạm ẩn' : 'Unavailable'}</span>
          <strong className="combo-admin__stat-value">{unavailableCount}</strong>
        </div>
      </div>

      <div className="combo-admin__workbench">
        <section aria-labelledby="combo-admin-list-title">
          <div className="combo-admin__list-heading">
            <div>
              <span className="combo-admin__section-label">{vi ? '01 / Index' : '01 / Index'}</span>
              <h3 id="combo-admin-list-title" className="combo-admin__list-title">
                {vi ? 'Danh sách combo' : 'Combo index'}
              </h3>
            </div>
            <span className="combo-admin__list-count">
              {items.length} {vi ? 'hiển thị' : 'shown'}
            </span>
          </div>

          {isLoading ? (
            <Card className="combo-admin__loading rounded-none shadow-none">
              <CardContent className="flex items-center gap-2 p-6">
                <Loader2 className="size-4 animate-spin" />
                {vi ? 'Đang tải combo…' : 'Loading combos…'}
              </CardContent>
            </Card>
          ) : items.length === 0 ? (
            <div className="combo-admin__empty">
              <div className="text-center">
                <Utensils className="mx-auto mb-2 size-5 text-[var(--combo-admin-accent-ink)]" />
                <p>{vi ? 'Chưa có combo nào.' : 'No combos yet.'}</p>
                <Button variant="link" onClick={openCreate}>
                  {vi ? 'Tạo combo đầu tiên' : 'Create the first combo'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="combo-admin__rows">
              {items.map((item, index) => (
                <div className="combo-admin__row" key={item.id}>
                  <span className="combo-admin__row-number">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="combo-admin__identity">
                    <span className="combo-admin__image">
                      {item.image_url ? (
                        <img src={item.image_url} alt="" />
                      ) : (
                        <Utensils className="size-4" />
                      )}
                    </span>
                    <span className="combo-admin__identity-copy">
                      <span className="combo-admin__name">{item.name}</span>
                      <span className="combo-admin__code">{item.code}</span>
                    </span>
                  </div>
                  <span className="combo-admin__row-value">
                    {formatVND(item.combo_price_vnd)}
                    <small>{vi ? 'giá set' : 'set price'}</small>
                  </span>
                  <span className="combo-admin__row-value">
                    <Badge variant={statusVariant(item.status)}>
                      {statusLabel(item.status, vi)}
                    </Badge>
                    <small>{availabilityLabel(item, vi)}</small>
                  </span>
                  <div className="combo-admin__actions">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="combo-admin__row-action"
                      aria-label={vi ? `Sửa ${item.name}` : `Edit ${item.name}`}
                      onClick={() => openEdit(item)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="combo-admin__component-remove"
                      aria-label={vi ? `Xoá ${item.name}` : `Delete ${item.name}`}
                      disabled={remove.isPending}
                      onClick={() => {
                        if (window.confirm(vi ? `Xoá ${item.name}?` : `Delete ${item.name}?`)) {
                          remove.mutate(item)
                        }
                      }}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="combo-admin__side-note">
          <span className="combo-admin__section-label">{vi ? '02 / Quy tắc' : '02 / Notes'}</span>
          <p>
            {vi
              ? 'Mỗi combo được lưu như một phần tử menu. Khi khách đặt, hệ thống tự tách thành các món thành phần để bếp xử lý theo trạm.'
              : 'Each combo is stored as one menu item. At order time, it fans out into component dishes for station-based kitchen work.'}
          </p>
        </aside>
      </div>

      <Sheet open={formOpen} onOpenChange={(open) => !open && closeEditor()}>
        <SheetContent side="right" className="combo-admin__sheet">
          <SheetHeader className="combo-admin__sheet-header">
            <SheetTitle className="combo-admin__sheet-title">
              {editing ? (vi ? 'Sửa combo' : 'Edit combo') : vi ? 'Combo mới' : 'New combo'}
            </SheetTitle>
            <SheetDescription className="combo-admin__sheet-description">
              {vi
                ? 'Thông tin này sẽ hiển thị ở menu khách.'
                : 'This information will appear in the guest menu.'}
            </SheetDescription>
          </SheetHeader>

          <div className="combo-admin__sheet-body">
            {editing && detail.isLoading ? (
              <div className="combo-admin__empty">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : (
              <>
                <section className="combo-admin__form-section">
                  <span className="combo-admin__section-label">
                    {vi ? '01 / Thông tin' : '01 / Identity'}
                  </span>
                  <div className="combo-admin__field">
                    <Label className="combo-admin__field-label" htmlFor="combo-name">
                      {vi ? 'Tên combo' : 'Combo name'}
                    </Label>
                    <Input
                      id="combo-name"
                      value={draft.name}
                      aria-invalid={save.isError && !draft.name.trim()}
                      onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                    />
                  </div>
                  <div className="combo-admin__field">
                    <Label className="combo-admin__field-label" htmlFor="combo-price">
                      {vi ? 'Giá combo (VND)' : 'Combo price (VND)'}
                    </Label>
                    <Input
                      id="combo-price"
                      type="number"
                      min="0"
                      value={draft.price}
                      aria-invalid={save.isError && !draft.price}
                      onChange={(event) => setDraft({ ...draft, price: event.target.value })}
                    />
                  </div>
                  <div className="combo-admin__field">
                    <Label className="combo-admin__field-label" htmlFor="combo-image">
                      {vi ? 'Ảnh URL' : 'Image URL'}
                    </Label>
                    <Input
                      id="combo-image"
                      value={draft.image}
                      onChange={(event) => setDraft({ ...draft, image: event.target.value })}
                    />
                  </div>
                  <div className="combo-admin__field">
                    <Label className="combo-admin__field-label" htmlFor="combo-description">
                      {vi ? 'Mô tả' : 'Description'}
                    </Label>
                    <Textarea
                      id="combo-description"
                      value={draft.description}
                      onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="combo-admin__field">
                      <Label className="combo-admin__field-label" htmlFor="combo-status">
                        {vi ? 'Trạng thái xuất bản' : 'Publication status'}
                      </Label>
                      <Select
                        value={draft.status}
                        itemToStringValue={(value) => statusLabel(value as MenuItemStatus, vi)}
                        onValueChange={(value) =>
                          setDraft({ ...draft, status: (value ?? 'DRAFT') as MenuItemStatus })
                        }
                      >
                        <SelectTrigger id="combo-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="DRAFT">{statusLabel('DRAFT', vi)}</SelectItem>
                          <SelectItem value="PUBLISHED">{statusLabel('PUBLISHED', vi)}</SelectItem>
                          <SelectItem value="ARCHIVED">{statusLabel('ARCHIVED', vi)}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="combo-admin__field">
                      <Label className="combo-admin__field-label" htmlFor="combo-availability">
                        {vi ? 'Tình trạng bán' : 'Availability'}
                      </Label>
                      <Select
                        value={draft.availabilityStatus}
                        itemToStringValue={(value) =>
                          availabilityStatusLabel(value as MenuItemAvailabilityStatus, vi)
                        }
                        onValueChange={(value) =>
                          setDraft({
                            ...draft,
                            availabilityStatus: (value ?? 'HIDDEN') as MenuItemAvailabilityStatus,
                          })
                        }
                      >
                        <SelectTrigger id="combo-availability">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="AVAILABLE">
                            {availabilityStatusLabel('AVAILABLE', vi)}
                          </SelectItem>
                          <SelectItem value="OUT_OF_STOCK">
                            {availabilityStatusLabel('OUT_OF_STOCK', vi)}
                          </SelectItem>
                          <SelectItem value="TEMPORARILY_UNAVAILABLE">
                            {availabilityStatusLabel('TEMPORARILY_UNAVAILABLE', vi)}
                          </SelectItem>
                          <SelectItem value="HIDDEN">
                            {availabilityStatusLabel('HIDDEN', vi)}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </section>

                <section className="combo-admin__form-section">
                  <div className="flex items-center justify-between gap-3">
                    <span className="combo-admin__section-label">
                      {vi ? '02 / Thành phần' : '02 / Components'}
                    </span>
                    <Badge variant="outline">{draft.components.length}</Badge>
                  </div>

                  <div className="combo-admin__component-list">
                    {draft.components.length === 0 ? (
                      <p className="text-sm text-[var(--text-secondary)]">
                        {vi ? 'Thêm món đầu tiên vào combo.' : 'Add the first dish to this combo.'}
                      </p>
                    ) : (
                      draft.components.map((component, index) => (
                        <div
                          className="combo-admin__component"
                          key={`${component.menu_item_id}-${index}`}
                        >
                          <span className="combo-admin__component-name">
                            {menuItemById.get(component.menu_item_id)?.name ??
                              component.menu_item_id}
                          </span>
                          <span className="combo-admin__component-qty">×{component.quantity}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="combo-admin__component-remove"
                            aria-label={vi ? 'Xoá món khỏi combo' : 'Remove dish from combo'}
                            onClick={() =>
                              setDraft({
                                ...draft,
                                components: draft.components
                                  .filter((_, componentIndex) => componentIndex !== index)
                                  .map((item, componentIndex) => ({
                                    ...item,
                                    display_order: componentIndex + 1,
                                  })),
                              })
                            }
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="combo-admin__component-add">
                    <Select
                      value={componentId || null}
                      itemToStringValue={(value) => menuItemById.get(value)?.name ?? value}
                      onValueChange={(value) => setComponentId(value ?? '')}
                    >
                      <SelectTrigger aria-label={vi ? 'Chọn món' : 'Choose dish'}>
                        <SelectValue placeholder={vi ? 'Chọn món' : 'Choose dish'} />
                      </SelectTrigger>
                      <SelectContent>
                        {menuItems.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      aria-label={vi ? 'Số lượng món' : 'Dish quantity'}
                      type="number"
                      min="1"
                      value={componentQty}
                      onChange={(event) => setComponentQty(event.target.value)}
                    />
                    <Button type="button" variant="secondary" onClick={addComponent}>
                      <Plus />
                      {vi ? 'Thêm món' : 'Add dish'}
                    </Button>
                  </div>

                  <div className="combo-admin__money-preview">
                    <span>{vi ? 'Giá gọi lẻ tham chiếu' : 'À-la-carte reference'}</span>
                    <strong>
                      {formatVND(reference)} · {vi ? 'Tiết kiệm' : 'Savings'} {formatVND(savings)}
                    </strong>
                  </div>
                </section>

                {save.isError && (
                  <p className="combo-admin__error" role="alert">
                    <CircleAlert className="mr-1 inline size-4" />
                    {errorMessage(
                      save.error,
                      vi ? 'Không thể lưu combo.' : 'Could not save combo.',
                    )}
                  </p>
                )}
              </>
            )}
          </div>

          <SheetFooter className="combo-admin__sheet-footer">
            <Button type="button" variant="outline" onClick={closeEditor}>
              {vi ? 'Huỷ' : 'Cancel'}
            </Button>
            <Button
              className="combo-admin__save-button"
              disabled={
                detail.isLoading ||
                save.isPending ||
                !draft.name.trim() ||
                !draft.price ||
                draft.components.length === 0
              }
              onClick={() => save.mutate()}
            >
              {save.isPending && <Loader2 className="animate-spin" />}
              {vi ? 'Lưu combo' : 'Save combo'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
