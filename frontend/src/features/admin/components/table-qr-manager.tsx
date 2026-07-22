import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Download, LayoutGrid, Map as MapIcon, Pencil, Plus, QrCode, RefreshCw, SquareStack, Trash2 } from 'lucide-react'
import QRCode from 'qrcode'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { SecureActionDialog } from '@/components/SecureActionDialog'
import { ShellHeaderCenter } from '@/components/admin-shell'
import { AreaManagerDialog } from '@/features/admin/components/area-manager-dialog'
import { FloorBuilder } from '@/features/admin/components/floor-builder'
import { TableFormDialog } from '@/features/admin/components/table-form-dialog'
import { makeAdminT, type AdminT } from '@/i18n'
import { errorMessage } from '@/lib/api'
import { useLang } from '@/hooks/use-lang'
import { cn } from '@/lib/utils'
import { buildQROrderURL, deleteTable, listTableQRs, manageTableQR } from '@/features/dining/api'
import type { TableQR } from '@/features/dining/types'
import { TABLE_QRS_KEY } from '@/features/dining/keys'

export function TableQRManager() {
  const { lang } = useLang()
  const t = makeAdminT(lang)
  const queryClient = useQueryClient()
  const { data: tablesData, isLoading, isError, error, isSuccess } = useQuery({
    queryKey: TABLE_QRS_KEY,
    queryFn: listTableQRs,
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [view, setView] = useState<'grid' | 'plan'>('grid')
  // null = closed, 'new' = create, otherwise the table being edited.
  const [editing, setEditing] = useState<TableQR | 'new' | null>(null)
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
  const areaGroups = Array.from(
    tables.reduce((map, table) => {
      const name = table.area_name || t('qr_area_other')
      const group = map.get(name)
      if (group) group.push(table)
      else map.set(name, [table])
      return map
    }, new Map<string, TableQR[]>()),
    ([name, tables]) => ({ name, tables }),
  )
  const selected = tables.find((table) => table.table_id === selectedId) ?? null

  return (
    <>
      <ShellHeaderCenter>
        <div className="rounded-full bg-[var(--surface-grouped)]/70 px-4 py-2 text-sm font-semibold text-[var(--text-secondary)]">
          {t('qr_summary', tables.filter((t) => t.has_active_qr).length, tables.length)}
        </div>
      </ShellHeaderCenter>
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex rounded-[14px] bg-[var(--surface-grouped)]/70 p-1">
            {(['grid', 'plan'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setView(mode)}
                className={cn(
                  'flex items-center gap-2 rounded-[10px] px-3 py-1.5 text-sm font-semibold transition-colors',
                  view === mode
                    ? 'bg-[var(--material-regular)] text-[var(--text)] shadow-3xs'
                    : 'text-[var(--text-secondary)]',
                )}
              >
                {mode === 'grid' ? <LayoutGrid className="size-4" /> : <MapIcon className="size-4" />}
                {t(mode === 'grid' ? 'tbl_view_grid' : 'tbl_view_plan')}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              className="rounded-[var(--radius-lg)]"
              onClick={() => setAreasOpen(true)}
            >
              <SquareStack className="size-4" />
              {t('area_manage')}
            </Button>
            <Button className="rounded-[var(--radius-lg)]" onClick={() => setEditing('new')}>
              <Plus className="size-4" />
              {t('tbl_add')}
            </Button>
          </div>
        </div>

        {isLoading && (
          <p className="text-sm text-[var(--text-secondary)]">{t('qr_loading')}</p>
        )}
        {isError && (
          <Card className="border border-[var(--system-red)]/30 bg-[var(--system-red)]/5">
            <CardContent className="p-5 text-sm text-[var(--system-red)]">
              {t('qr_load_error')}:{' '}
              {errorMessage(error, t('qr_unknown_error'))}
            </CardContent>
          </Card>
        )}

        {isSuccess && tables.length === 0 && (
          <Card className="bg-[var(--material-regular)] backdrop-blur-2xl">
            <CardContent className="p-10 text-center text-sm text-[var(--text-secondary)]">
              {t('qr_empty')}
            </CardContent>
          </Card>
        )}

        {view === 'plan' && <FloorBuilder />}

        {view === 'grid' && areaGroups.map((group) => (
          <section key={group.name} className="space-y-3">
            <div className="flex items-baseline gap-2">
              <h2 className="text-[17px] font-semibold text-[var(--text)]">{group.name}</h2>
              <span className="text-sm text-[var(--text-tertiary)]">
                {t('qr_summary', group.tables.filter((table) => table.has_active_qr).length, group.tables.length)}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {group.tables.map((table) => (
                <TableCard
                  key={table.table_id}
                  table={table}
                  t={t}
                  onOpen={() => setSelectedId(table.table_id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
      <QRDetailSheet
        table={selected}
        t={t}
        onClose={() => setSelectedId(null)}
        onEdit={() => selected && setEditing(selected)}
        onDelete={() => selected && setDeleting(selected)}
      />
      <TableFormDialog
        table={editing === 'new' ? null : editing}
        open={editing !== null}
        t={t}
        onOpenChange={(next) => !next && setEditing(null)}
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
        'flex cursor-pointer flex-col gap-3 rounded-[20px] border border-[var(--separator)] bg-[var(--material-regular)] p-5 text-left backdrop-blur-2xl transition-all duration-[220ms] hover:border-[var(--system-purple)]/40 hover:bg-[var(--system-purple)]/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--system-purple)]/20',
        !table.has_active_qr && 'opacity-60',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[17px] font-semibold text-[var(--text)]">
            {table.table_name}
          </div>
          <div className="font-mono text-xs text-[var(--text-tertiary)]">
            {table.table_code} · {t('qr_seats', table.capacity)}
          </div>
        </div>
        <span
          className={cn(
            'flex size-10 items-center justify-center rounded-[14px]',
            table.has_active_qr
              ? 'bg-[var(--system-green)]/10 text-[var(--system-green)]'
              : 'bg-[var(--surface-grouped)] text-[var(--text-tertiary)]',
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
    return () => { active = false }
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
                  <Button variant="secondary" className="rounded-[var(--radius-lg)]" onClick={onEdit}>
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
                        <div className="flex size-64 items-center justify-center text-sm text-zinc-400">
                          {t('qr_generating')}
                        </div>
                      )}
                    </div>

                    {orderUrl && (
                      <div className="rounded-[16px] bg-[var(--surface-grouped)]/70 p-3">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                          {t('qr_link')}
                        </div>
                        <div className="break-all font-mono text-xs text-[var(--text-secondary)]">
                          {orderUrl}
                        </div>
                      </div>
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
