import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { errorMessage } from '@/lib/api'
import { listAreas, saveTable } from '@/features/dining/api'
import type { AdminT } from '@/i18n'
import type { TableQR } from '@/features/dining/types'
import { AREAS_KEY, TABLE_QRS_KEY } from '@/features/dining/keys'

const TABLE_STATUSES = ['AVAILABLE', 'RESERVED', 'CLEANING', 'INACTIVE'] as const
// OCCUPIED is omitted on purpose: it is owned by the session lifecycle, not by
// an admin dropdown.
const STATUS_LABEL: Record<(typeof TABLE_STATUSES)[number], Parameters<AdminT>[0]> = {
  AVAILABLE: 'tbl_status_available',
  RESERVED: 'tbl_status_reserved',
  CLEANING: 'tbl_status_cleaning',
  INACTIVE: 'tbl_status_inactive',
}

const NO_AREA = 'none'

export function TableFormDialog({
  table,
  open,
  t,
  onOpenChange,
}: {
  /** null creates a new table. */
  table: TableQR | null
  open: boolean
  t: AdminT
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Remounting per table seeds the fields from useState initialisers,
            so no effect is needed to reset them between opens. */}
        <TableForm key={table?.table_id ?? 'new'} table={table} t={t} onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  )
}

function TableForm({
  table,
  t,
  onOpenChange,
}: {
  table: TableQR | null
  t: AdminT
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const { data: areasData } = useQuery({
    queryKey: AREAS_KEY,
    queryFn: listAreas,
  })
  const areas = areasData?.areas ?? []

  const [code, setCode] = useState(table?.table_code ?? '')
  const [name, setName] = useState(table?.table_name ?? '')
  const [capacity, setCapacity] = useState(String(table?.capacity ?? 4))
  const [areaId, setAreaId] = useState<string>(table?.area_id ?? NO_AREA)
  const [status, setStatus] = useState<string>(table?.table_status ?? 'AVAILABLE')

  const mutation = useMutation({
    mutationFn: saveTable,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: TABLE_QRS_KEY })
      onOpenChange(false)
    },
  })

  const parsedCapacity = Number(capacity)
  const canSubmit = code.trim().length > 0 && Number.isInteger(parsedCapacity) && parsedCapacity > 0

  return (
    <>
      <DialogHeader>
        <DialogTitle>{table ? t('tbl_edit') : t('tbl_create_title')}</DialogTitle>
        <DialogDescription>{t('qr_subtitle')}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="table-code">{t('tbl_code')}</Label>
            <Input
              id="table-code"
              value={code}
              placeholder="T11"
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="table-capacity">{t('tbl_capacity')}</Label>
            <Input
              id="table-capacity"
              type="number"
              min={1}
              max={50}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="table-name">{t('tbl_name')}</Label>
          <Input
            id="table-name"
            value={name}
            placeholder={code || 'T11'}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t('tbl_area')}</Label>
          <Select value={areaId} onValueChange={(value) => setAreaId(value ?? NO_AREA)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_AREA}>{t('tbl_area_none')}</SelectItem>
              {areas.map((area) => (
                <SelectItem key={area.id} value={area.id}>
                  {area.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>{t('tbl_status')}</Label>
          <Select value={status} onValueChange={(value) => setStatus(value ?? 'AVAILABLE')}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TABLE_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(STATUS_LABEL[value])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {mutation.isError && (
          <p className="text-sm text-[var(--system-red)]">
            {errorMessage(mutation.error, t('qr_action_failed'))}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button variant="secondary" onClick={() => onOpenChange(false)}>
          {t('qr_cancel')}
        </Button>
        <Button
          disabled={!canSubmit || mutation.isPending}
          onClick={() =>
            mutation.mutate({
              tableId: table?.table_id,
              areaId: areaId === NO_AREA ? null : areaId,
              code: code.trim(),
              name: name.trim() || code.trim(),
              capacity: parsedCapacity,
              status,
            })
          }
        >
          {mutation.isPending ? t('tbl_saving') : t('tbl_save')}
        </Button>
      </DialogFooter>
    </>
  )
}
