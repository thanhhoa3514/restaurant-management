import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  Building2,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  SquareStack,
  Trash2,
} from 'lucide-react'
import QRCode from 'qrcode'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { SecureActionDialog } from '@/components/SecureActionDialog'
import { ShellHeaderCenter } from '@/components/admin-shell'
import { AreaManagerDialog } from '@/features/admin/components/area-manager-dialog'
import { TableFormDialog } from '@/features/admin/components/table-form-dialog'
import { makeAdminT, type AdminT } from '@/i18n'
import { errorMessage } from '@/lib/api'
import { useLang } from '@/hooks/use-lang'
import { cn } from '@/lib/utils'
import {
  buildQROrderURL,
  deleteTable,
  listAreas,
  listTableQRs,
  manageTableQR,
} from '@/features/dining/api'
import type { TableQR } from '@/features/dining/types'
import { AREAS_KEY, TABLE_QRS_KEY } from '@/features/dining/keys'
import '@/features/dining/table-catalogue.css'

export function TableQRManager() {
  const { lang } = useLang()
  const t = makeAdminT(lang)
  const queryClient = useQueryClient()
  const {
    data: tablesData,
    isLoading,
    isError,
    error,
    isSuccess,
  } = useQuery({
    queryKey: TABLE_QRS_KEY,
    queryFn: listTableQRs,
  })
  const { data: areasData } = useQuery({ queryKey: AREAS_KEY, queryFn: listAreas })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // null = closed, 'new' = create, otherwise the table being edited.
  const [editing, setEditing] = useState<TableQR | 'new' | null>(null)
  const [createAreaId, setCreateAreaId] = useState<string | undefined>()
  const [deleting, setDeleting] = useState<TableQR | null>(null)
  const [areasOpen, setAreasOpen] = useState(false)

  const removeTable = useMutation({
    mutationFn: deleteTable,
    onSuccess: () => {
      setSelectedId(null)
      return queryClient.invalidateQueries({ queryKey: TABLE_QRS_KEY })
    },
  })

  const tables = tablesData ?? []
  const areas = areasData?.areas ?? []
  const maxTablesPerArea = areasData?.limits.max_tables_per_area ?? 0
  const areaGroups = areas.map((area) => ({
    id: area.id,
    name: area.name,
    description: area.description,
    isActive: area.is_active,
    tables: tables.filter((table) => table.area_id === area.id),
  }))
  const unassignedTables = tables.filter(
    (table) => !table.area_id || !areas.some((area) => area.id === table.area_id),
  )
  if (unassignedTables.length > 0) {
    areaGroups.push({
      id: 'unassigned',
      name: t('qr_area_other'),
      description: t('qr_area_other_desc'),
      isActive: false,
      tables: unassignedTables,
    })
  }
  const activeAreas = areaGroups.filter((group) => group.isActive)
  const hasTableCapacity = activeAreas.some(
    (group) => maxTablesPerArea === 0 || group.tables.length < maxTablesPerArea,
  )
  const selected = tables.find((table) => table.table_id === selectedId) ?? null

  return (
    <>
      <ShellHeaderCenter>
        <div className="rounded-full bg-[var(--surface-grouped)]/70 px-4 py-2 text-sm font-semibold text-[var(--text-secondary)]">
          {t('qr_summary', tables.filter((t) => t.has_active_qr).length, tables.length)}
        </div>
      </ShellHeaderCenter>
      <div className="dining-catalogue mx-auto max-w-7xl space-y-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-[var(--text)]">{t('qr_catalogue_title')}</h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              {t(
                'qr_limits_summary',
                areas.length,
                areasData?.limits.max_areas ?? 0,
                maxTablesPerArea,
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              className="rounded-[var(--radius-lg)]"
              onClick={() => setAreasOpen(true)}
            >
              <SquareStack className="size-4" />
              {t('area_manage')}
            </Button>
            <Button
              className="whitespace-nowrap rounded-[var(--radius-lg)] bg-[var(--text)] text-[var(--bg)] hover:bg-[var(--text)]/90"
              disabled={activeAreas.length > 0 && !hasTableCapacity}
              onClick={() => {
                if (activeAreas.length === 0) {
                  setAreasOpen(true)
                  return
                }
                setCreateAreaId(undefined)
                setEditing('new')
              }}
            >
              <Plus className="size-4" />
              {activeAreas.length === 0 ? t('area_add_first') : t('tbl_add')}
            </Button>
          </div>
        </div>

        {isLoading && <p className="text-sm text-[var(--text-secondary)]">{t('qr_loading')}</p>}
        {isError && (
          <Card className="border border-[var(--system-red)]/30 bg-[var(--system-red)]/5">
            <CardContent className="p-5 text-sm text-[var(--system-red)]">
              {t('qr_load_error')}: {errorMessage(error, t('qr_unknown_error'))}
            </CardContent>
          </Card>
        )}

        {isSuccess && areaGroups.length === 0 && (
          <Card className="bg-[var(--material-regular)] backdrop-blur-2xl">
            <CardContent className="p-10 text-center text-sm text-[var(--text-secondary)]">
              {t('qr_empty')}
            </CardContent>
          </Card>
        )}

        {isSuccess &&
          areaGroups.map((group) => {
            const isFull = maxTablesPerArea > 0 && group.tables.length >= maxTablesPerArea
            return (
              <section key={group.id} className="dining-area-section">
                <div className="dining-area-heading">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-[12px] bg-[var(--surface-grouped)] text-[var(--text-secondary)]">
                      <Building2 className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[17px] font-semibold text-[var(--text)]">
                          {group.name}
                        </h2>
                        {!group.isActive && (
                          <Badge className="border-0 bg-[var(--surface-grouped)] text-[var(--text-secondary)]">
                            {t('area_inactive')}
                          </Badge>
                        )}
                      </div>
                      {group.description && (
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">
                          {group.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-sm tabular-nums text-[var(--text-secondary)]">
                    <div>{t('area_table_count', group.tables.length, maxTablesPerArea)}</div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {t(
                        'area_qr_count',
                        group.tables.filter((table) => table.has_active_qr).length,
                      )}
                    </div>
                  </div>
                </div>

                {group.tables.length === 0 ? (
                  <div className="dining-area-empty">
                    <p>{t('area_no_tables')}</p>
                    <Button
                      variant="secondary"
                      disabled={!group.isActive || isFull}
                      onClick={() => {
                        setCreateAreaId(group.id)
                        setEditing('new')
                      }}
                    >
                      <Plus className="size-4" />
                      {t('area_add_table')}
                    </Button>
                  </div>
                ) : (
                  <div className="dining-table-grid dining-table-grid--admin">
                    {group.tables.map((table) => (
                      <TableCard
                        key={table.table_id}
                        table={table}
                        t={t}
                        onOpen={() => setSelectedId(table.table_id)}
                      />
                    ))}
                  </div>
                )}
                {group.tables.length > 0 && group.isActive && !isFull && (
                  <Button
                    variant="ghost"
                    className="mt-3 whitespace-nowrap text-[var(--text-secondary)]"
                    onClick={() => {
                      setCreateAreaId(group.id)
                      setEditing('new')
                    }}
                  >
                    <Plus className="size-4" />
                    {t('area_add_table')}
                  </Button>
                )}
              </section>
            )
          })}
      </div>
      <QRDetailSheet
        table={selected}
        t={t}
        onClose={() => setSelectedId(null)}
        onEdit={() => {
          setCreateAreaId(undefined)
          if (selected) setEditing(selected)
        }}
        onDelete={() => selected && setDeleting(selected)}
      />
      <TableFormDialog
        table={editing === 'new' ? null : editing}
        initialAreaId={editing === 'new' ? createAreaId : undefined}
        open={editing !== null}
        t={t}
        onOpenChange={(next) => {
          if (!next) {
            setEditing(null)
            setCreateAreaId(undefined)
          }
        }}
      />
      <AreaManagerDialog open={areasOpen} t={t} onOpenChange={setAreasOpen} />
      {deleting && (
        <SecureActionDialog
          open
          title={t('tbl_delete_title')}
          description={t('tbl_delete_desc', deleting.table_name)}
          requireConfirmationText={deleting.table_code}
          inputPlaceholder={t('qr_confirm_placeholder', deleting.table_code)}
          confirmText={t('tbl_delete_confirm')}
          cancelText={t('qr_cancel')}
          variant="destructive"
          onOpenChange={(next) => !next && setDeleting(null)}
          onConfirm={() => removeTable.mutate(deleting.table_id)}
        />
      )}
      {removeTable.isError && (
        <p className="mx-auto max-w-7xl text-sm text-[var(--system-red)]">
          {errorMessage(removeTable.error, t('qr_action_failed'))}
        </p>
      )}
    </>
  )
}

function TableCard({ table, t, onOpen }: { table: TableQR; t: AdminT; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex min-h-44 cursor-pointer flex-col gap-3 rounded-[20px] border border-[var(--separator)] bg-[var(--material-regular)] p-5 text-left transition-colors duration-[220ms] hover:border-[var(--system-blue)]/40 hover:bg-[var(--surface-grouped)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--system-blue)] active:bg-[var(--surface-grouped)]',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[17px] font-semibold text-[var(--text)]">
            {table.table_name}
          </div>
          <div className="font-mono text-xs text-[var(--text-secondary)]">
            {table.table_code} · {t('qr_seats', table.capacity)}
          </div>
        </div>
        <span
          className={cn(
            'flex size-10 items-center justify-center rounded-[14px]',
            table.has_active_qr
              ? 'bg-[var(--system-green)]/10 text-[var(--system-green)]'
              : 'bg-[var(--surface-grouped)] text-[var(--text-secondary)]',
          )}
        >
          <QrCode className="size-5" />
        </span>
      </div>
      <Badge
        className={cn(
          'w-fit border-0',
          table.has_active_qr
            ? 'bg-[var(--system-green)]/10 text-[var(--system-green)]'
            : 'bg-[var(--surface-grouped)] text-[var(--text-secondary)]',
        )}
      >
        {table.has_active_qr ? t('qr_has') : t('qr_none')}
      </Badge>
    </button>
  )
}

function QRDetailSheet({
  table,
  t,
  onClose,
  onEdit,
  onDelete,
}: {
  table: TableQR | null
  t: AdminT
  onClose: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const queryClient = useQueryClient()
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [rotateOpen, setRotateOpen] = useState(false)

  const token = table?.qr_token
  const orderUrl = token ? buildQROrderURL(token) : null
  const copied = copiedUrl === orderUrl
  const shownDataUrl = orderUrl ? dataUrl : null

  const mutation = useMutation({
    mutationFn: manageTableQR,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TABLE_QRS_KEY }),
  })

  useEffect(() => {
    if (!orderUrl) return
    let active = true
    QRCode.toDataURL(orderUrl, { width: 320, margin: 2 })
      .then((url) => {
        if (active) setDataUrl(url)
      })
      .catch(() => {
        if (active) setDataUrl(null)
      })
    return () => {
      active = false
    }
  }, [orderUrl])

  const handleCopy = async () => {
    if (!orderUrl) return
    await navigator.clipboard.writeText(orderUrl)
    setCopiedUrl(orderUrl)
    setTimeout(() => {
      setCopiedUrl((current) => (current === orderUrl ? null : current))
    }, 1500)
  }

  const open = table !== null

  return (
    <>
      <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
        <SheetContent side="right" className="w-full bg-[var(--material-thick)] sm:max-w-md">
          {table && (
            <>
              <SheetHeader title={table.table_name} subtitle={table.table_code} />
              <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-5">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    className="rounded-[var(--radius-lg)]"
                    onClick={onEdit}
                  >
                    <Pencil className="size-4" />
                    {t('tbl_edit')}
                  </Button>
                  <Button
                    variant="secondary"
                    className="rounded-[var(--radius-lg)] text-[var(--system-red)]"
                    onClick={onDelete}
                  >
                    <Trash2 className="size-4" />
                    {t('tbl_delete')}
                  </Button>
                </div>
                {table.has_active_qr ? (
                  <>
                    <div className="flex flex-col items-center gap-4 rounded-[20px] bg-white p-5">
                      {shownDataUrl ? (
                        <img
                          src={shownDataUrl}
                          alt={`${t('qr_title')} · ${table.table_name}`}
                          className="size-64"
                        />
                      ) : (
                        <div className="flex size-64 items-center justify-center text-sm text-zinc-600">
                          {t('qr_generating')}
                        </div>
                      )}
                    </div>

                    {orderUrl && (
                      <div className="rounded-[16px] bg-[var(--surface-grouped)]/70 p-3">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                          {t('qr_link')}
                        </div>
                        <div className="break-all font-mono text-xs text-[var(--text-secondary)]">
                          {orderUrl}
                        </div>
                      </div>
                    )}

                    {orderUrl && (
                      <Button
                        className="w-full rounded-[var(--radius-lg)] bg-[var(--text)] text-[var(--bg)] hover:bg-[var(--text)]/90"
                        asChild
                      >
                        <a href={orderUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="size-4" />
                          {t('qr_open')}
                        </a>
                      </Button>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="secondary"
                        className="rounded-[var(--radius-lg)]"
                        onClick={handleCopy}
                      >
                        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                        {copied ? t('qr_copied') : t('qr_copy')}
                      </Button>
                      <Button
                        variant="secondary"
                        className="rounded-[var(--radius-lg)]"
                        disabled={!shownDataUrl}
                        asChild
                      >
                        <a href={shownDataUrl ?? '#'} download={`qr-${table.table_code}.png`}>
                          <Download className="size-4" />
                          {t('qr_download')}
                        </a>
                      </Button>
                    </div>

                    <Button
                      variant="secondary"
                      className="w-full rounded-[var(--radius-lg)] text-[var(--system-orange)]"
                      disabled={mutation.isPending}
                      onClick={() => setRotateOpen(true)}
                    >
                      <RefreshCw className="size-4" />
                      {t('qr_rotate')}
                    </Button>
                  </>
                ) : (
                  <div className="space-y-4">
                    <Card className="border border-[var(--separator)] bg-[var(--material-regular)] p-4 backdrop-blur-2xl">
                      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                        {t('qr_create_hint')}
                      </p>
                    </Card>
                    <Button
                      className="w-full rounded-[var(--radius-lg)]"
                      disabled={mutation.isPending}
                      onClick={() => mutation.mutate({ tableId: table.table_id })}
                    >
                      <Plus className="size-4" />
                      {mutation.isPending ? t('qr_creating') : t('qr_create')}
                    </Button>
                  </div>
                )}

                {mutation.isError && (
                  <p className="text-sm text-[var(--system-red)]">
                    {errorMessage(mutation.error, t('qr_action_failed'))}
                  </p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {table && (
        <SecureActionDialog
          open={rotateOpen}
          title={t('qr_rotate_title')}
          description={t('qr_rotate_desc', table.table_name)}
          requireConfirmationText={table.table_code}
          inputPlaceholder={t('qr_confirm_placeholder', table.table_code)}
          confirmText={t('qr_rotate_confirm')}
          cancelText={t('qr_cancel')}
          variant="warning"
          onOpenChange={setRotateOpen}
          onConfirm={() => mutation.mutate({ tableId: table.table_id, rotate: true })}
        />
      )}
    </>
  )
}
