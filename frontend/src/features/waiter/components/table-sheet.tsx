import { useMemo, useState, type FC } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { wfFmtClock, wfFmtHMS, wfFmtMin, wfFmtVND } from '@/features/waiter/helpers'
import { cn } from '@/lib/utils'
import type { ItemStatus, Lang, WFItem, WFSession, WFTable } from '@/features/waiter/types'

interface TableSheetProps {
  open: boolean
  table: WFTable | null
  now: Date
  lang: Lang
  t: (key: string, ...args: Array<string | number>) => string
  onClose: () => void
  onAcknowledgeCall: (tableId: string) => void
  onNotifyCashier: (tableId: string) => void
  onMarkItemServed: (tableId: string, itemId: string) => void
  onMarkAllServed: (tableId: string) => void
  onRequestBill: (tableId: string) => void
  onOpenSession: (tableId: string, guestCount: number, notes: string) => void
}

interface ReadyItem {
  item: WFItem
  orderId: string
}

export const TableSheet: FC<TableSheetProps> = ({
  open,
  table,
  now,
  lang,
  t,
  onClose,
  onAcknowledgeCall,
  onNotifyCashier,
  onMarkItemServed,
  onMarkAllServed,
  onRequestBill,
  onOpenSession,
}) => {
  const [confirmBill, setConfirmBill] = useState(false)
  const [showOpenForm, setShowOpenForm] = useState(false)
  const [guestCount, setGuestCount] = useState(2)
  const [notes, setNotes] = useState('')

  const [prevTableId, setPrevTableId] = useState(table?.id)

  if (table?.id !== prevTableId) {
    setPrevTableId(table?.id)
    setConfirmBill(false)
    setShowOpenForm(false)
    setGuestCount(table?.capacity ? Math.min(2, table.capacity) : 2)
    setNotes('')
  }

  const readyItems = useMemo<ReadyItem[]>(() => {
    if (!table?.session) return []
    return table.session.orders.flatMap((order) =>
      order.items.filter((item) => item.status === 'ready').map((item) => ({ item, orderId: order.id })),
    )
  }, [table])

  const subtotal = useMemo(() => {
    if (!table?.session) return 0
    return table.session.orders.reduce(
      (sum, order) => sum + order.items.reduce((inner, item) => inner + item.unit_price * item.qty, 0),
      0,
    )
  }, [table])

  if (!table) return null

  const isEmpty = table.status === 'empty' || !table.session
  const elapsedSeconds = table.session ? Math.floor((now.getTime() - table.session.started_at.getTime()) / 1000) : 0

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" hideClose className="w-full max-w-[31rem] rounded-l-[28px] border-l border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--separator)] px-6 pb-4 pt-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[32px] font-bold leading-none text-[var(--text)]">
                {t('table')} {table.number}
              </h2>
              {isEmpty ? (
                <Badge variant="secondary" className="rounded-full">
                  {t('empty')}
                </Badge>
              ) : (
                <span className="text-sm font-semibold text-[var(--text-secondary)]">• {t('guests', table.session?.guest_count ?? 0)}</span>
              )}
            </div>
            <p className="mt-2 text-sm font-medium text-[var(--text-secondary)]">
              {isEmpty
                ? `${table.capacity} ${lang === 'vi' ? 'chỗ ngồi' : 'seats'}`
                : `${t('opened_at')} ${wfFmtClock(table.session?.started_at ?? now)} • ${wfFmtMin(elapsedSeconds)} ${t('minutes')}`}
            </p>
          </div>
          <Button variant="secondary" size="icon" className="rounded-full" onClick={onClose} aria-label="Close">
            ×
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isEmpty ? (
            <EmptyTableBody
              table={table}
              lang={lang}
              t={t}
              showOpenForm={showOpenForm}
              setShowOpenForm={setShowOpenForm}
              guestCount={guestCount}
              setGuestCount={setGuestCount}
              notes={notes}
              setNotes={setNotes}
              onSubmit={() => {
                onOpenSession(table.id, guestCount, notes)
                setShowOpenForm(false)
              }}
            />
          ) : (
            <OccupiedBody
              table={table}
              session={table.session as WFSession}
              now={now}
              lang={lang}
              t={t}
              readyItems={readyItems}
              onAcknowledgeCall={onAcknowledgeCall}
              onNotifyCashier={onNotifyCashier}
              onMarkItemServed={onMarkItemServed}
              onMarkAllServed={onMarkAllServed}
            />
          )}
        </div>

        {!isEmpty && (
          <div className="border-t border-[var(--separator)] bg-white/45 px-6 py-4 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">{t('subtotal_label')}</div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-[var(--text)]">{wfFmtVND(subtotal)}</div>
                <div className="text-xs font-medium text-[var(--text-secondary)]">
                  {table.session?.orders.length ?? 0} {lang === 'vi' ? 'lượt gọi món' : 'orders'}
                </div>
              </div>
              {table.session?.bill_requested_at ? (
                <Badge variant="default" className="rounded-full px-3 py-1.5">
                  {t('signal_bill')}
                </Badge>
              ) : (
                <Button className="rounded-2xl" onClick={() => setConfirmBill(true)}>
                  {t('btn_request_bill')}
                </Button>
              )}
            </div>
          </div>
        )}

        {confirmBill && (
          <ConfirmBillDialog
            t={t}
            onCancel={() => setConfirmBill(false)}
            onConfirm={() => {
              onRequestBill(table.id)
              setConfirmBill(false)
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

interface OccupiedBodyProps {
  table: WFTable
  session: WFSession
  now: Date
  lang: Lang
  t: (key: string, ...args: Array<string | number>) => string
  readyItems: ReadyItem[]
  onAcknowledgeCall: (tableId: string) => void
  onNotifyCashier: (tableId: string) => void
  onMarkItemServed: (tableId: string, itemId: string) => void
  onMarkAllServed: (tableId: string) => void
}

const OccupiedBody: FC<OccupiedBodyProps> = ({
  table,
  session,
  now,
  lang,
  t,
  readyItems,
  onAcknowledgeCall,
  onNotifyCashier,
  onMarkItemServed,
  onMarkAllServed,
}) => (
  <div className="space-y-5">
    {session.waiter_called_at && (
      <SignalBanner
        tone="red"
        title={t('signal_call')}
        time={wfFmtHMS(Math.floor((now.getTime() - session.waiter_called_at.getTime()) / 1000))}
        buttonLabel={t('btn_acknowledge')}
        onClick={() => onAcknowledgeCall(table.id)}
      />
    )}
    {session.bill_requested_at && (
      <SignalBanner
        tone="blue"
        title={t('signal_bill')}
        time={wfFmtHMS(Math.floor((now.getTime() - session.bill_requested_at.getTime()) / 1000))}
        buttonLabel={t('btn_notify_cashier')}
        onClick={() => onNotifyCashier(table.id)}
      />
    )}

    {readyItems.length > 0 && (
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-base font-bold text-emerald-800">
            <span className="size-2.5 rounded-full bg-emerald-500" />
            {t('ready_section', readyItems.length)}
          </h3>
          {readyItems.length > 1 && (
            <Button variant="ghost" size="sm" className="rounded-full text-emerald-700" onClick={() => onMarkAllServed(table.id)}>
              {t('btn_mark_all_served')}
            </Button>
          )}
        </div>
        <Card className="overflow-hidden rounded-[24px] border-2 border-emerald-500/20 bg-emerald-500/10">
          {readyItems.map(({ item }) => {
            const readyAt = item.status_history.find((entry) => entry.status === 'ready')?.timestamp ?? now
            const sinceReady = Math.floor((now.getTime() - readyAt.getTime()) / 1000)
            return (
              <div key={item.id} className="flex items-start gap-3 border-b border-emerald-500/15 p-4 last:border-b-0">
                <QuantityPill qty={item.qty} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold leading-tight text-[var(--text)]">{lang === 'vi' ? item.name_vi : item.name_en}</div>
                  <div className="mt-1 text-sm text-[var(--text-secondary)]">{lang === 'vi' ? item.options_text_vi : item.options_text_en}</div>
                  {item.notes && <div className="mt-1 text-xs italic text-amber-700">“{item.notes}”</div>}
                  <div className="mt-2 font-mono text-xs font-semibold tabular-nums text-emerald-700">
                    {t('ready_since')} {wfFmtHMS(sinceReady)}
                  </div>
                </div>
                <Button size="sm" className="rounded-full bg-emerald-600 hover:bg-emerald-700" onClick={() => onMarkItemServed(table.id, item.id)}>
                  {t('btn_mark_served')}
                </Button>
              </div>
            )
          })}
        </Card>
      </section>
    )}

    <section>
      <h3 className="mb-3 text-base font-bold text-[var(--text)]">{t('order_history')}</h3>
      <div className="space-y-3">
        {session.orders.length === 0 ? (
          <Card className="rounded-[22px] p-5 text-sm text-[var(--text-tertiary)]">
            {lang === 'vi' ? 'Chưa có lượt gọi món nào.' : 'No orders yet.'}
          </Card>
        ) : (
          session.orders.map((order) => (
            <Card key={order.id} className="overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="flex items-center justify-between bg-zinc-50 px-4 py-3 dark:bg-zinc-900">
                <span className="text-sm font-semibold text-[var(--text-secondary)]">
                  {t('order_placed_at')} {wfFmtClock(order.submitted_at)}
                </span>
                <span className="font-mono text-xs text-[var(--text-tertiary)]">{order.id}</span>
              </div>
              <div className="divide-y divide-[var(--separator)]/70">
                {order.items.map((item) => (
                  <OrderItemRow key={item.id} item={item} lang={lang} t={t} />
                ))}
              </div>
            </Card>
          ))
        )}
      </div>
    </section>
  </div>
)

interface SignalBannerProps {
  tone: 'red' | 'blue'
  title: string
  time: string
  buttonLabel: string
  onClick: () => void
}

const SignalBanner: FC<SignalBannerProps> = ({ tone, title, time, buttonLabel, onClick }) => {
  const red = tone === 'red'
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-[24px] border-2 p-4 shadow-sm',
        red ? 'border-red-500/30 bg-red-500/10 text-red-950 animate-pulse' : 'border-blue-500/30 bg-blue-500/10 text-blue-950',
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className={cn('mt-2 size-3 rounded-full', red ? 'bg-red-500' : 'bg-blue-500')} />
        <div className="min-w-0">
          <div className="font-bold">{title}</div>
          <div className={cn('mt-1 font-mono text-sm font-semibold tabular-nums', red ? 'text-red-700' : 'text-blue-700')}>{time}</div>
        </div>
      </div>
      <Button variant={red ? 'destructive' : 'default'} size="sm" className="rounded-full" onClick={onClick}>
        {buttonLabel}
      </Button>
    </div>
  )
}

interface OrderItemRowProps {
  item: WFItem
  lang: Lang
  t: (key: string, ...args: Array<string | number>) => string
}

const OrderItemRow: FC<OrderItemRowProps> = ({ item, lang, t }) => {
  const served = item.status === 'served'
  return (
    <div className="flex items-start gap-3 p-4">
      <QuantityPill qty={item.qty} muted={served} />
      <div className="min-w-0 flex-1">
        <div className={cn('font-semibold leading-tight', served ? 'text-[var(--text-tertiary)] line-through' : 'text-[var(--text)]')}>
          {lang === 'vi' ? item.name_vi : item.name_en}
        </div>
        <div className={cn('mt-1 text-sm', served ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-secondary)]')}>
          {lang === 'vi' ? item.options_text_vi : item.options_text_en}
        </div>
        {item.notes && <div className="mt-1 text-xs italic text-amber-700">“{item.notes}”</div>}
      </div>
      <StatusChip status={item.status} t={t} />
    </div>
  )
}

const QuantityPill: FC<{ qty: number; muted?: boolean }> = ({ qty, muted }) => (
  <span
    className={cn(
      'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums',
      muted ? 'bg-[var(--surface-grouped)] text-[var(--text-tertiary)]' : 'bg-[var(--text)] text-white',
    )}
  >
    ×{qty}
  </span>
)

const StatusChip: FC<{ status: ItemStatus; t: (key: string, ...args: Array<string | number>) => string }> = ({ status, t }) => {
  const variantByStatus: Record<ItemStatus, 'default' | 'secondary' | 'outline' | 'success' | 'warning'> = {
    pending: 'secondary',
    acknowledged: 'default',
    preparing: 'warning',
    ready: 'success',
    served: 'outline',
  }
  return (
    <Badge variant={variantByStatus[status]} className="shrink-0 rounded-full">
      {t(`status_${status}`)}
    </Badge>
  )
}

interface EmptyTableBodyProps {
  table: WFTable
  lang: Lang
  t: (key: string, ...args: Array<string | number>) => string
  showOpenForm: boolean
  setShowOpenForm: (show: boolean) => void
  guestCount: number
  setGuestCount: (count: number) => void
  notes: string
  setNotes: (notes: string) => void
  onSubmit: () => void
}

const EmptyTableBody: FC<EmptyTableBodyProps> = ({
  table,
  lang,
  t,
  showOpenForm,
  setShowOpenForm,
  guestCount,
  setGuestCount,
  notes,
  setNotes,
  onSubmit,
}) => {
  if (!showOpenForm) {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto flex size-24 items-center justify-center rounded-[28px] bg-[var(--surface-grouped)] text-4xl font-bold text-[var(--text-tertiary)]">
          {table.number}
        </div>
        <div className="mt-5 text-xl font-bold text-[var(--text)]">{t('empty')}</div>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {table.capacity} {lang === 'vi' ? 'chỗ ngồi' : 'seats'}
        </p>
        <Button size="lg" className="mt-7 w-full rounded-2xl" onClick={() => setShowOpenForm(true)}>
          {t('empty_table_cta')}
        </Button>
      </div>
    )
  }

  return (
    <div>
      <h3 className="text-lg font-bold text-[var(--text)]">{t('open_session_title')}</h3>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">
        {t('table')} {table.number} • {table.capacity} {lang === 'vi' ? 'chỗ ngồi' : 'seats'}
      </p>

      <div className="mt-5 space-y-5">
        <Input value={`${t('table')} ${table.number}`} readOnly aria-label="Table" className="h-12 rounded-2xl font-semibold" />
        <div>
          <label className="mb-2 block text-sm font-semibold text-[var(--text-secondary)]">{t('guest_count_label')}</label>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: table.capacity }, (_, index) => index + 1).map((count) => (
              <Button
                key={count}
                type="button"
                variant={guestCount === count ? 'default' : 'secondary'}
                size="icon"
                className="rounded-2xl text-base font-bold"
                onClick={() => setGuestCount(count)}
              >
                {count}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold text-[var(--text-secondary)]">{t('notes_label')}</label>
          <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={t('notes_placeholder')} rows={4} />
        </div>
      </div>
      <div className="mt-6 flex gap-2">
        <Button variant="secondary" className="flex-1 rounded-2xl" onClick={() => setShowOpenForm(false)}>
          {t('cancel')}
        </Button>
        <Button className="flex-1 rounded-2xl" onClick={onSubmit}>
          {t('btn_open_session')}
        </Button>
      </div>
    </div>
  )
}

const ConfirmBillDialog: FC<{
  t: (key: string, ...args: Array<string | number>) => string
  onCancel: () => void
  onConfirm: () => void
}> = ({ t, onCancel, onConfirm }) => (
  <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 p-6 backdrop-blur-3xs">
    <Card className="w-full max-w-sm rounded-[24px] border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-lg font-bold text-[var(--text)]">{t('confirm_bill_title')}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{t('confirm_bill_desc')}</p>
      <Separator className="my-5" />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" className="rounded-2xl" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <Button className="rounded-2xl" onClick={onConfirm}>
          {t('confirm')}
        </Button>
      </div>
    </Card>
  </div>
)

export default TableSheet
