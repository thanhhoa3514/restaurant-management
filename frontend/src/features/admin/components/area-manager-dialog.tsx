import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Trash2, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { errorMessage } from '@/lib/api'
import { deleteArea, listAreas, listTableQRs, saveArea, type Area } from '@/features/dining/api'
import { AREAS_KEY, TABLE_QRS_KEY } from '@/features/dining/keys'
import type { AdminT } from '@/i18n'
import { cn } from '@/lib/utils'

// Local editor state: null = list mode, 'new' = create form, Area = edit form.
type Editing = Area | 'new' | null

export function AreaManagerDialog({
  open,
  t,
  onOpenChange,
}: {
  open: boolean
  t: AdminT
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('area_manage')}</DialogTitle>
          <DialogDescription>{t('area_manage_desc')}</DialogDescription>
        </DialogHeader>
        <AreaManagerBody t={t} />
      </DialogContent>
    </Dialog>
  )
}

function AreaManagerBody({ t }: { t: AdminT }) {
  const queryClient = useQueryClient()
  const { data, isLoading, isError } = useQuery({ queryKey: AREAS_KEY, queryFn: listAreas })
  const areas = data?.areas ?? []
  const maxAreas = data?.limits.max_areas ?? 0
  const maxTablesPerArea = data?.limits.max_tables_per_area ?? 0
  const { data: tables = [] } = useQuery({ queryKey: TABLE_QRS_KEY, queryFn: listTableQRs })
  const [editing, setEditing] = useState<Editing>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const invalidate = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: AREAS_KEY }),
      queryClient.invalidateQueries({ queryKey: TABLE_QRS_KEY }),
    ])

  const save = useMutation({
    mutationFn: saveArea,
    onSuccess: async () => {
      await invalidate()
      setEditing(null)
    },
  })
  const remove = useMutation({
    mutationFn: deleteArea,
    onSuccess: async () => {
      await invalidate()
      setConfirmDelete(null)
    },
  })

  if (editing !== null) {
    return (
      <AreaForm
        key={editing === 'new' ? 'new' : editing.id}
        area={editing === 'new' ? null : editing}
        t={t}
        isSaving={save.isPending}
        error={save.error}
        onCancel={() => {
          save.reset()
          setEditing(null)
        }}
        onSubmit={(values) =>
          save.mutate({ areaId: editing === 'new' ? undefined : editing.id, ...values })
        }
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-[12px] bg-[var(--surface-grouped)] px-3 py-2 text-xs text-[var(--text-secondary)]">
        <span>{t('area_limit_summary', areas.length, maxAreas)}</span>
        <span>{t('area_table_limit_short', maxTablesPerArea)}</span>
      </div>
      {isLoading && <p className="text-sm text-[var(--text-secondary)]">…</p>}
      {isError && <p className="text-sm text-[var(--system-red)]">{t('qr_load_error')}</p>}
      {!isLoading && areas.length === 0 && (
        <p className="py-6 text-center text-sm text-[var(--text-secondary)]">{t('area_empty')}</p>
      )}

      <ul className="space-y-2">
        {areas.map((area) => {
          const tableCount = tables.filter((table) => table.area_id === area.id).length
          return (
            <li
              key={area.id}
              className="flex items-center gap-2 rounded-[14px] border border-[var(--separator)] bg-[var(--material-regular)] px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-[var(--text)]">
                    {area.name}
                  </span>
                  {!area.is_active && (
                    <span className="rounded-full bg-[var(--surface-grouped)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-secondary)]">
                      {t('area_inactive')}
                    </span>
                  )}
                </div>
                {area.description && (
                  <p className="truncate text-xs text-[var(--text-secondary)]">
                    {area.description}
                  </p>
                )}
                <p className="text-xs tabular-nums text-[var(--text-secondary)]">
                  {t('area_table_count', tableCount, maxTablesPerArea)}
                </p>
                {tableCount > 0 && (
                  <p className="text-xs text-[var(--text-secondary)]">{t('area_delete_blocked')}</p>
                )}
              </div>

              {confirmDelete === area.id ? (
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="text-[var(--system-red)]"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(area.id)}
                  >
                    {t('area_delete')}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      remove.reset()
                      setConfirmDelete(null)
                    }}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      save.reset()
                      setEditing(area)
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-[var(--system-red)]"
                    disabled={tableCount > 0}
                    title={tableCount > 0 ? t('area_delete_blocked') : t('area_delete')}
                    onClick={() => {
                      remove.reset()
                      setConfirmDelete(area.id)
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {remove.isError && (
        <p className="text-sm text-[var(--system-red)]">
          {errorMessage(remove.error, t('qr_action_failed'))}
        </p>
      )}

      <Button
        className="w-full rounded-[var(--radius-lg)] bg-[var(--text)] text-[var(--bg)] hover:bg-[var(--text)]/90"
        disabled={maxAreas > 0 && areas.length >= maxAreas}
        onClick={() => {
          save.reset()
          setEditing('new')
        }}
      >
        <Plus className="size-4" />
        {t('area_add')}
      </Button>
      {maxAreas > 0 && areas.length >= maxAreas && (
        <p className="text-center text-xs text-[var(--text-secondary)]">
          {t('area_limit_reached', maxAreas)}
        </p>
      )}
    </div>
  )
}

function AreaForm({
  area,
  t,
  isSaving,
  error,
  onCancel,
  onSubmit,
}: {
  area: Area | null
  t: AdminT
  isSaving: boolean
  error: unknown
  onCancel: () => void
  onSubmit: (values: { name: string; description: string; displayOrder: number }) => void
}) {
  const [name, setName] = useState(area?.name ?? '')
  const [description, setDescription] = useState(area?.description ?? '')
  const [order, setOrder] = useState(String(area?.display_order ?? 0))

  const parsedOrder = Number(order)
  const canSubmit = name.trim().length > 0 && Number.isInteger(parsedOrder)

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="area-name">{t('area_name')}</Label>
        <Input
          id="area-name"
          value={name}
          placeholder={t('area_name_ph')}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="area-desc">{t('area_desc')}</Label>
        <Textarea
          id="area-desc"
          value={description}
          rows={2}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="area-order">{t('area_order')}</Label>
        <Input
          id="area-order"
          type="number"
          className="w-28"
          value={order}
          onChange={(e) => setOrder(e.target.value)}
        />
      </div>

      {error != null && (
        <p className="text-sm text-[var(--system-red)]">
          {errorMessage(error, t('qr_action_failed'))}
        </p>
      )}

      <div className={cn('flex justify-end gap-2')}>
        <Button variant="secondary" onClick={onCancel}>
          {t('area_cancel')}
        </Button>
        <Button
          className="bg-[var(--text)] text-[var(--bg)] hover:bg-[var(--text)]/90"
          disabled={!canSubmit || isSaving}
          onClick={() =>
            onSubmit({
              name: name.trim(),
              description: description.trim(),
              displayOrder: parsedOrder,
            })
          }
        >
          {isSaving ? t('area_saving') : t('area_save')}
        </Button>
      </div>
    </div>
  )
}
