import { useEffect, useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Download, Plus, QrCode, RefreshCw } from 'lucide-react'
import QRCode from 'qrcode'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { SecureActionDialog } from '@/components/SecureActionDialog'
import { StaffShell } from '@/components/staff-shell'
import { ApiError } from '@/lib/api'
import { isStaffAuthenticated } from '@/lib/auth'
import { cn } from '@/lib/utils'
import { buildQROrderURL, listTableQRs, manageTableQR } from '@/features/dining/api'
import type { TableQR } from '@/features/dining/types'

const TABLE_QRS_KEY = ['dining', 'table-qrs'] as const

export const Route = createFileRoute('/admin/table-qrs')({
  beforeLoad: ({ location }) => {
    if (!isStaffAuthenticated('admin')) {
      throw redirect({ to: '/login', search: { redirect: location.href } })
    }
  },
})

export const RouteComponent = () => {
  const query = useQuery({ queryKey: TABLE_QRS_KEY, queryFn: listTableQRs })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const tables = query.data ?? []
  const withQR = tables.filter((t) => t.has_active_qr).length
  // Derive the open row from live query data (not a captured snapshot) so the
  // sheet re-renders with the fresh token after a generate/rotate refetch.
  const selected = tables.find((t) => t.table_id === selectedId) ?? null

  return (
    <StaffShell
      role="admin"
      eyebrow="Admin Portal"
      title="Mã QR theo bàn"
      subtitle="Tạo và xoay mã QR gọi món cho từng bàn"
      headerCenter={
        <div className="rounded-full bg-[var(--surface-grouped)]/70 px-4 py-2 text-sm font-semibold text-[var(--text-secondary)]">
          {withQR}/{tables.length} bàn có mã QR
        </div>
      }
      contentClassName="bg-[var(--surface-grouped)]/45"
    >
      <div className="mx-auto max-w-7xl space-y-6">
        {query.isLoading && (
          <p className="text-sm text-[var(--text-secondary)]">Đang tải danh sách bàn…</p>
        )}
        {query.isError && (
          <Card className="border border-[var(--system-red)]/30 bg-[var(--system-red)]/5">
            <CardContent className="p-5 text-sm text-[var(--system-red)]">
              Không tải được danh sách bàn:{' '}
              {query.error instanceof ApiError ? query.error.message : 'lỗi không xác định'}
            </CardContent>
          </Card>
        )}

        {query.isSuccess && tables.length === 0 && (
          <Card className="bg-[var(--material-regular)] backdrop-blur-2xl">
            <CardContent className="p-10 text-center text-sm text-[var(--text-secondary)]">
              Chưa có bàn nào. Thêm bàn ở phần quản lý sơ đồ trước.
            </CardContent>
          </Card>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {tables.map((table) => (
            <TableCard
              key={table.table_id}
              table={table}
              onOpen={() => setSelectedId(table.table_id)}
            />
          ))}
        </section>
      </div>

      <QRDetailSheet table={selected} onClose={() => setSelectedId(null)} />
    </StaffShell>
  )
}

function TableCard({ table, onOpen }: { table: TableQR; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col gap-3 rounded-[20px] border border-[var(--separator)] bg-[var(--material-regular)] p-5 text-left backdrop-blur-2xl transition-colors duration-[220ms] hover:border-[var(--system-purple)]/40 hover:bg-[var(--system-purple)]/5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--system-purple)]/20"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[17px] font-semibold text-[var(--text)]">
            {table.table_name}
          </div>
          <div className="font-mono text-xs text-[var(--text-tertiary)]">{table.table_code}</div>
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
        {table.has_active_qr ? 'Đã có mã QR' : 'Chưa tạo mã'}
      </Badge>
    </button>
  )
}

function QRDetailSheet({ table, onClose }: { table: TableQR | null; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  const [rotateOpen, setRotateOpen] = useState(false)

  // `table` is derived from live query data by the parent, so after a
  // generate/rotate refetch this token is the current one.
  const token = table?.qr_token
  const orderUrl = token ? buildQROrderURL(token) : null
  const copied = copiedUrl === orderUrl
  const shownDataUrl = orderUrl ? dataUrl : null

  const mutation = useMutation({
    mutationFn: manageTableQR,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TABLE_QRS_KEY }),
  })

  useEffect(() => {
    if (!orderUrl) {
      return
    }
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
                {table.has_active_qr ? (
                  <>
                    <div className="flex flex-col items-center gap-4 rounded-[20px] bg-white p-5">
                      {shownDataUrl ? (
                        <img
                          src={shownDataUrl}
                          alt={`Mã QR ${table.table_name}`}
                          className="size-64"
                        />
                      ) : (
                        <div className="flex size-64 items-center justify-center text-sm text-zinc-400">
                          Đang tạo mã…
                        </div>
                      )}
                    </div>

                    {orderUrl && (
                      <div className="rounded-[16px] bg-[var(--surface-grouped)]/70 p-3">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                          Liên kết gọi món
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
                        {copied ? 'Đã chép' : 'Chép link'}
                      </Button>
                      <Button
                        variant="secondary"
                        className="rounded-[var(--radius-lg)]"
                        disabled={!shownDataUrl}
                        asChild
                      >
                        <a href={shownDataUrl ?? '#'} download={`qr-${table.table_code}.png`}>
                          <Download className="size-4" />
                          Tải PNG
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
                      Xoay mã QR mới
                    </Button>
                  </>
                ) : (
                  <div className="space-y-4">
                    <Card className="border border-[var(--separator)] bg-[var(--material-regular)] p-4 backdrop-blur-2xl">
                      <p className="text-sm leading-relaxed text-[var(--text-secondary)]">
                        Bàn này chưa có mã QR. Tạo mã để khách quét và gọi món.
                      </p>
                    </Card>
                    <Button
                      className="w-full rounded-[var(--radius-lg)]"
                      disabled={mutation.isPending}
                      onClick={() => mutation.mutate({ tableId: table.table_id })}
                    >
                      <Plus className="size-4" />
                      {mutation.isPending ? 'Đang tạo…' : 'Tạo mã QR'}
                    </Button>
                  </div>
                )}

                {mutation.isError && (
                  <p className="text-sm text-[var(--system-red)]">
                    {mutation.error instanceof ApiError
                      ? mutation.error.message
                      : 'Thao tác thất bại'}
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
          title="Xoay mã QR"
          description={`Tạo mã QR mới cho ${table.table_name} sẽ vô hiệu hóa mã đang in/dán tại bàn. Khách dùng mã cũ sẽ không gọi món được. Hành động này không thể hoàn tác.`}
          requireConfirmationText={table.table_code}
          inputPlaceholder={`Nhập mã bàn "${table.table_code}" để xác nhận`}
          confirmText="Xoay mã"
          cancelText="Hủy"
          variant="warning"
          onOpenChange={setRotateOpen}
          onConfirm={() => mutation.mutate({ tableId: table.table_id, rotate: true })}
        />
      )}
    </>
  )
}

Route.options.component = RouteComponent
