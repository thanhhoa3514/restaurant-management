import { useMemo, useReducer, useRef, type FC } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { TakeawayPanel } from '@/features/cashier/components/takeaway-panel'
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
  onConfirmItem: (tableId: string, itemId: string) => void
  onRejectItem: (tableId: string, itemId: string, reason: string) => void
  onRequestBill: (tableId: string) => void
  onOpenSession: (tableId: string, guestCount: number, notes: string) => void
  onSplitGroup: (tableId: string) => void
  /** Mã các bàn khác trong cùng nhóm gộp, rỗng nếu bàn không được gộp */
  mergeSiblings: string[]
}

interface ReadyItem {
  item: WFItem
  orderId: string
}

interface TableSheetState {
  confirmBill: boolean
  showOpenForm: boolean
  guestCount: number
  notes: string
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
  onConfirmItem,
  onRejectItem,
  onRequestBill,
  onOpenSession,
  onSplitGroup,
  mergeSiblings,
}) => {
  const [{ confirmBill, showOpenForm, guestCount, notes }, dispatch] = useReducer(
    (state: TableSheetState, patch: Partial<TableSheetState>) => ({ ...state, ...patch }),
    { confirmBill: false, showOpenForm: false, guestCount: 2, notes: '' },
  )

  const prevTableIdRef = useRef(table?.id)

  if (table?.id !== prevTableIdRef.current) {
    prevTableIdRef.current = table?.id
    dispatch({
      confirmBill: false,
      showOpenForm: false,
      guestCount: table?.capacity ? Math.min(2, table.capacity) : 2,
      notes: '',
    })
  }

  const readyItems = useMemo<ReadyItem[]>(() => {
    if (!table?.session) return []
    return table.session.orders.flatMap((order) =>
      order.items.reduce<ReadyItem[]>((acc, item) => {
        if (item.status === 'ready') acc.push({ item, orderId: order.id })
        return acc
      }, []),
    )
  }, [table])

  const placedItems = useMemo<ReadyItem[]>(() => {
    if (!table?.session) return []
    return table.session.orders.flatMap((order) =>
      order.items.reduce<ReadyItem[]>((acc, item) => {
        if (item.status === 'placed') acc.push({ item, orderId: order.id })
        return acc
      }, []),
    )
  }, [table])

  const subtotal = useMemo(() => {
    if (!table?.session) return 0
    return table.session.orders.reduce(
      (sum, order) =>
        sum + order.items.reduce((inner, item) => inner + item.unit_price * item.qty, 0),
      0,
    )
  }, [table])

  if (!table) return null

  const isEmpty = table.status === 'empty' || !table.session
  const elapsedSeconds = table.session
    ? Math.floor((now.getTime() - table.session.started_at.getTime()) / 1000)
    : 0

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="right"
        hideClose
        className="w-full max-w-[31rem] gap-0 rounded-l-[28px] border-l border-zinc-200 bg-white shadow-xl max-sm:max-w-full max-sm:rounded-none dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--separator)] px-6 pb-4 pt-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[32px] font-bold leading-none text-[var(--text)]">
                {t('table')} {table.code}
              </h2>
              {isEmpty ? (
                <Badge variant="secondary" className="rounded-full">
                  {t('empty')}
                </Badge>
              ) : (
                <>
                  <span className="text-sm font-semibold text-[var(--text-secondary)]">
                    • {t('guests', table.session?.guest_count ?? 0)}
                  </span>
                  {table.session?.guest_name && (
                    <span className="ml-2 text-sm text-[var(--text-tertiary)]">
                      · {table.session.guest_name}
                    </span>
                  )}
                </>
              )}
            </div>
            {mergeSiblings.length > 0 && (
              <Badge className="mt-2 rounded-full border-0 bg-purple-500/12 text-purple-600 dark:text-purple-400">
                {t('merge_with', mergeSiblings.join(', '))}
              </Badge>
            )}
            <p className="mt-2 text-sm font-medium text-[var(--text-secondary)]">
              {isEmpty
                ? `${table.capacity} ${lang === 'vi' ? 'chỗ ngồi' : 'seats'}`
                : `${t('opened_at')} ${wfFmtClock(table.session?.started_at ?? now)} • ${wfFmtMin(elapsedSeconds)} ${t('minutes')}`}
            </p>
          </div>
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full"
            onClick={onClose}
            aria-label="Close"
          >
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
              setShowOpenForm={(v) => dispatch({ showOpenForm: v })}
              guestCount={guestCount}
              setGuestCount={(v) => dispatch({ guestCount: v })}
              notes={notes}
              setNotes={(v) => dispatch({ notes: v })}
              onSubmit={() => {
                onOpenSession(table.id, guestCount, notes)
                dispatch({ showOpenForm: false })
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
              placedItems={placedItems}
              onAcknowledgeCall={onAcknowledgeCall}
              onNotifyCashier={onNotifyCashier}
              onMarkItemServed={onMarkItemServed}
              onMarkAllServed={onMarkAllServed}
              onConfirmItem={onConfirmItem}
              onRejectItem={onRejectItem}
            />
          )}
        </div>

        {!isEmpty && (
          <div className="border-t border-[var(--separator)] bg-white/45 px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <div className="min-w-0">
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
                  {t('subtotal_label')}
                </div>
                <div className="mt-1 text-2xl font-bold tabular-nums text-[var(--text)]">
                  {wfFmtVND(subtotal)}
                </div>
                <div className="text-xs font-medium text-[var(--text-secondary)]">
                  {table.session?.orders.length ?? 0} {lang === 'vi' ? 'lượt gọi món' : 'orders'}
                </div>
              </div>
              {table.session?.merge_group_id && (
                <Button
                  variant="outline"
                  className="rounded-2xl max-sm:h-11 max-sm:w-full"
                  onClick={() => onSplitGroup(table.id)}
                >
                  {t('merge_split')}
                </Button>
              )}
              {!table.session?.bill_requested_at && (
                <TakeawayPanel
                  compact
                  lang={lang}
                  t={t}
                  sessionId={table.session?.id}
                  tableLabel={`${t('table')} ${table.code}`}
                  className="max-sm:h-11 max-sm:flex-1"
                />
              )}
              {table.session?.bill_requested_at ? (
                <Badge variant="default" className="shrink-0 rounded-full px-3 py-1.5">
                  {t('signal_bill')}
                </Badge>
              ) : (
                <Button
                  className="rounded-2xl max-sm:h-11 max-sm:w-full"
                  onClick={() => dispatch({ confirmBill: true })}
                >
                  {t('btn_request_bill')}
                </Button>
              )}
            </div>
          </div>
        )}

        {confirmBill && (
          <ConfirmBillDialog
            t={t}
            onCancel={() => dispatch({ confirmBill: false })}
            onConfirm={() => {
              onRequestBill(table.id)
              dispatch({ confirmBill: false })
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
  placedItems: ReadyItem[]
  onAcknowledgeCall: (tableId: string) => void
  onNotifyCashier: (tableId: string) => void
  onMarkItemServed: (tableId: string, itemId: string) => void
  onMarkAllServed: (tableId: string) => void
  onConfirmItem: (tableId: string, itemId: string) => void
  onRejectItem: (tableId: string, itemId: string, reason: string) => void
}

const OccupiedBody: FC<OccupiedBodyProps> = ({
  table,
  session,
  now,
  lang,
  t,
  readyItems,
  placedItems,
  onAcknowledgeCall,
  onNotifyCashier,
  onMarkItemServed,
  onMarkAllServed,
  onConfirmItem,
  onRejectItem,
}) => (
  <div className="space-y-5">
    {session.waiter_called_at && (
      <SignalBanner
        tone="red"
        title={
          session.waiter_call_reason
            ? `${t('signal_call')} — ${session.waiter_call_reason}`
            : t('signal_call')
        }
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

    {placedItems.length > 0 && (
      <section>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="flex items-center gap-2 text-base font-bold text-amber-800 dark:text-amber-400">
            <span className="size-2.5 rounded-full bg-amber-500" />
            {t('awaiting_confirm', placedItems.length)}
          </h3>
        </div>
        <Card className="overflow-hidden rounded-[24px] border-2 border-amber-500/25 bg-amber-500/10">
          {placedItems.map(({ item }) => (
            <PlacedItemRow
              key={item.id}
              item={item}
              lang={lang}
              t={t}
              onConfirm={() => onConfirmItem(table.id, item.id)}
              onReject={(reason) => onRejectItem(table.id, item.id, reason)}
            />
          ))}
        </Card>
      </section>
    )}

    {readyItems.length > 0 && (
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="flex items-center gap-2 text-base font-bold text-emerald-800">
            <span className="size-2.5 rounded-full bg-emerald-500" />
            {t('ready_section', readyItems.length)}
          </h3>
          {readyItems.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full text-emerald-700"
              onClick={() => onMarkAllServed(table.id)}
            >
              {t('btn_mark_all_served')}
            </Button>
          )}
        </div>
        <Card className="overflow-hidden rounded-[24px] border-2 border-emerald-500/20 bg-emerald-500/10">
          {readyItems.map(({ item }) => {
            const readyAt =
              item.status_history.find((entry) => entry.status === 'ready')?.timestamp ?? now
            const sinceReady = Math.floor((now.getTime() - readyAt.getTime()) / 1000)
            return (
              <div
                key={item.id}
                className="flex items-start gap-3 border-b border-emerald-500/15 p-4 last:border-b-0"
              >
                <QuantityPill qty={item.qty} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold leading-tight text-[var(--text)]">
                    <ItemName item={item} lang={lang} t={t} />
                  </div>
                  <div className="mt-1 text-sm text-[var(--text-secondary)]">
                    {lang === 'vi' ? item.options_text_vi : item.options_text_en}
                  </div>
                  {item.notes && (
                    <div className="mt-1 text-xs italic text-amber-700">“{item.notes}”</div>
                  )}
                  <div className="mt-2 font-mono text-xs font-semibold tabular-nums text-emerald-700">
                    {t('ready_since')} {wfFmtHMS(sinceReady)}
                  </div>
                </div>
                <Button
                  size="sm"
                  className="rounded-full bg-emerald-600 hover:bg-emerald-700"
                  onClick={() => onMarkItemServed(table.id, item.id)}
                >
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
            <Card
              key={order.id}
              className="overflow-hidden rounded-[24px] border border-zinc-200 bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900/50"
            >
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
        'flex flex-col gap-3 rounded-[24px] border-2 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between',
        red
          ? 'border-red-500/30 bg-red-500/10 text-red-950 animate-pulse'
          : 'border-blue-500/30 bg-blue-500/10 text-blue-950',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn('size-3 shrink-0 rounded-full', red ? 'bg-red-500' : 'bg-blue-500')} />
        <div className="min-w-0">
          <div className="font-bold">{title}</div>
          <div
            className={cn(
              'mt-0.5 font-mono text-sm font-semibold tabular-nums',
              red ? 'text-red-700' : 'text-blue-700',
            )}
          >
            {time}
          </div>
        </div>
      </div>
      <Button
        variant={red ? 'destructive' : 'default'}
        size="sm"
        className="w-full shrink-0 rounded-full sm:w-auto"
        onClick={onClick}
      >
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
        <div
          className={cn(
            'font-semibold leading-tight',
            served ? 'text-[var(--text-tertiary)] line-through' : 'text-[var(--text)]',
          )}
        >
          <ItemName item={item} lang={lang} t={t} />
        </div>
        <div
          className={cn(
            'mt-1 text-sm',
            served ? 'text-[var(--text-tertiary)]' : 'text-[var(--text-secondary)]',
          )}
        >
          {lang === 'vi' ? item.options_text_vi : item.options_text_en}
        </div>
        {item.notes && <div className="mt-1 text-xs italic text-amber-700">“{item.notes}”</div>}
      </div>
      <StatusChip status={item.status} t={t} />
    </div>
  )
}

interface PlacedItemRowProps {
  item: WFItem
  lang: Lang
  t: (key: string, ...args: Array<string | number>) => string
  onConfirm: () => void
  onReject: (reason: string) => void
}

// A PLACED item awaiting the server's confirm/reject decision. Reject reveals
// an inline optional-reason field so staff can note why (e.g. out of stock).
const PlacedItemRow: FC<PlacedItemRowProps> = ({ item, lang, t, onConfirm, onReject }) => {
  const [rejecting, setRejecting] = useReducer((s: boolean) => !s, false)
  const [reason, setReason] = useReducer((_: string, next: string) => next, '')
  return (
    <div className="space-y-3 border-b border-amber-500/15 p-4 last:border-b-0">
      <div className="flex items-start gap-3">
        <QuantityPill qty={item.qty} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold leading-tight text-[var(--text)]">
            <ItemName item={item} lang={lang} t={t} />
          </div>
          <div className="mt-1 text-sm text-[var(--text-secondary)]">
            {lang === 'vi' ? item.options_text_vi : item.options_text_en}
          </div>
          {item.notes && <div className="mt-1 text-xs italic text-amber-700">“{item.notes}”</div>}
        </div>
      </div>
      {rejecting ? (
        <div className="space-y-2">
          <Input
            autoFocus
            value={reason}
            placeholder={t('reject_reason_ph')}
            onChange={(event) => setReason(event.target.value)}
            className="h-10 rounded-xl"
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              className="flex-1 rounded-full"
              onClick={() => setRejecting()}
            >
              {t('cancel')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="flex-1 rounded-full"
              onClick={() => onReject(reason.trim())}
            >
              {t('btn_reject_send')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1 rounded-full text-red-600"
            onClick={() => setRejecting()}
          >
            {t('btn_reject_item')}
          </Button>
          <Button
            size="sm"
            className="flex-1 rounded-full bg-amber-600 hover:bg-amber-700"
            onClick={onConfirm}
          >
            {t('btn_confirm_item')}
          </Button>
        </div>
      )}
    </div>
  )
}

const QuantityPill: FC<{ qty: number; muted?: boolean }> = ({ qty, muted }) => (
  <span
    className={cn(
      'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums',
      muted
        ? 'bg-[var(--surface-grouped)] text-[var(--text-tertiary)]'
        : 'bg-[var(--text)] text-white',
    )}
  >
    ×{qty}
  </span>
)

const ItemName: FC<{
  item: WFItem
  lang: Lang
  t: (key: string, ...args: Array<string | number>) => string
}> = ({ item, lang, t }) => (
  <span className="inline-flex flex-wrap items-center gap-2">
    <span>{lang === 'vi' ? item.name_vi : item.name_en}</span>
    {item.is_takeaway ? (
      <Badge variant="warning" className="rounded-full px-2 py-0 text-[10px] no-underline">
        {t('takeaway_badge')}
      </Badge>
    ) : null}
  </span>
)

const CHIP_VARIANTS: Record<
  ItemStatus,
  'default' | 'secondary' | 'outline' | 'success' | 'warning'
> = {
  placed: 'warning',
  cancelled: 'outline',
  pending: 'secondary',
  acknowledged: 'default',
  preparing: 'warning',
  ready: 'success',
  served: 'outline',
}

const StatusChip: FC<{
  status: ItemStatus
  t: (key: string, ...args: Array<string | number>) => string
}> = ({ status, t }) => {
  return (
    <Badge variant={CHIP_VARIANTS[status]} className="shrink-0 rounded-full">
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
          {table.code}
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
        {t('table')} {table.code} • {table.capacity} {lang === 'vi' ? 'chỗ ngồi' : 'seats'}
      </p>

      <div className="mt-5 space-y-5">
        <Input
          value={`${t('table')} ${table.code}`}
          readOnly
          aria-label="Table"
          className="h-12 rounded-2xl font-semibold"
        />
        <div>
          <label className="mb-2 block text-sm font-semibold text-[var(--text-secondary)]">
            {t('guest_count_label')}
          </label>
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
          <label className="mb-2 block text-sm font-semibold text-[var(--text-secondary)]">
            {t('notes_label')}
          </label>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={t('notes_placeholder')}
            rows={4}
          />
        </div>
      </div>
      <div className="mt-6 flex gap-2">
        <Button
          variant="secondary"
          className="flex-1 rounded-2xl"
          onClick={() => setShowOpenForm(false)}
        >
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
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
        {t('confirm_bill_desc')}
      </p>
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
