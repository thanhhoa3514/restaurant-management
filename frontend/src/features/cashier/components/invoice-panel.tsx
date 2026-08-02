import { useState, type FC } from 'react'
import { Check, Loader2, ReceiptText } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { LIST_CARD, STATUS_VARIANT, WARN_TEXT } from '@/features/cashier/components/panel-styles'
import { DiscountDialog } from '@/features/cashier/components/discount-dialog'
import { SplitDialog } from '@/features/cashier/components/split-dialog'
import { VoidDialog } from '@/features/cashier/components/void-dialog'
import { activeInvoice, fmtClock, fmtVND } from '@/features/cashier/helpers'
import type { CashierSession, Lang } from '@/features/cashier/types'
import { useReopenSession } from '@/features/cashier/mutations/useReopenSession'
import { errorMessage } from '@/lib/api'

interface InvoicePanelProps {
  session: CashierSession | null
  now: Date
  lang: Lang
  t: (key: string, ...args: Array<number | string>) => string
  onApplyDiscount: (sessionId: string, amount: number, reason: string) => void
  onRemoveDiscount: (sessionId: string) => void
  onCloseSession: (sessionId: string) => Promise<boolean>
  onSelectInvoice: (sessionId: string, invoiceId: string) => void
  onSplit: (
    sessionId: string,
    groups: { label: string; order_item_ids: string[] }[],
  ) => Promise<boolean>
  onSessionReopened?: () => void
}

export const InvoicePanel: FC<InvoicePanelProps> = ({
  session,
  now,
  lang,
  t,
  onApplyDiscount,
  onRemoveDiscount,
  onCloseSession,
  onSelectInvoice,
  onSplit,
  onSessionReopened,
}) => {
  const [discountOpen, setDiscountOpen] = useState(false)
  const [voidOpen, setVoidOpen] = useState(false)
  const [splitOpen, setSplitOpen] = useState(false)
  const reopenMutation = useReopenSession()

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center">
        <div>
          <div className="mx-auto flex size-14 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--bg-elevated)] text-[var(--text-tertiary)] ring-1 ring-[var(--separator)]">
            <ReceiptText className="size-6" />
          </div>
          <p className="mt-4 text-sm text-[var(--text-tertiary)]">{t('select_session_hint')}</p>
        </div>
      </div>
    )
  }

  const invoice = activeInvoice(session)
  const terminal =
    session.status === 'paid' || session.status === 'closed' || session.status === 'voided'
  const elapsedMinutes = Math.max(
    0,
    Math.round((now.getTime() - session.started_at.getTime()) / 60000),
  )
  const split = session.invoices.length > 1
  const anyInvoicePaidOrPaying = session.invoices.some(
    (inv) =>
      inv.status === 'PAID' ||
      inv.payment?.status === 'pending' ||
      inv.payment?.status === 'processing',
  )
  const hasDiscount = session.invoices.some((inv) => (inv.discount?.amount ?? 0) > 0)

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="p-5 pb-3">
        <Card className={`border border-[var(--separator)] ${LIST_CARD}`}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardTitle className="text-2xl">
                  {t('table')} {session.table_label}
                </CardTitle>
                <div className="mt-2 flex flex-wrap gap-2 text-sm text-[var(--text-tertiary)]">
                  <span>{lang === 'vi' ? session.area_name_vi : session.area_name_en}</span>
                  <span>·</span>
                  <span>{t('guests', session.guest_count)}</span>
                  <span>·</span>
                  <span>
                    {t('invoice_duration')}: {t('elapsed_min', elapsedMinutes)}
                  </span>
                </div>
              </div>
              <Badge variant={STATUS_VARIANT[session.status]}>
                {t(`status_${session.status}`)}
              </Badge>
            </div>
            <div className="mt-2 text-xs font-semibold text-[var(--text-tertiary)]">
              {t('invoice_number')}: {invoice.number} · {t('invoice_opened_at')}{' '}
              {fmtClock(session.started_at)}
            </div>
            {split ? (
              <Tabs
                value={invoice.id}
                onValueChange={(value) => onSelectInvoice(session.id, value as string)}
                className="mt-3 w-full"
              >
                <TabsList className="w-full flex-wrap bg-[var(--surface-grouped)]">
                  {session.invoices.map((inv) => (
                    <TabsTrigger key={inv.id} value={inv.id ?? ''} className="flex-1 gap-1.5">
                      {inv.number}
                      {inv.status === 'PAID' ? (
                        <Badge variant="success" className="px-1.5">
                          <Check />
                        </Badge>
                      ) : null}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            ) : null}
          </CardHeader>
        </Card>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 pb-5">
        <section>
          <h2 className="mb-2 text-base font-semibold text-[var(--text)]">{t('order_details')}</h2>
          <div className="space-y-3">
            {invoice.orders.map((order) => (
              <Card
                key={order.id}
                className={`overflow-hidden border border-[var(--separator)] ${LIST_CARD}`}
              >
                <div className="flex items-center justify-between border-b border-[var(--separator)] px-4 py-2 text-sm">
                  <span className="font-semibold text-[var(--text-secondary)]">
                    {t('order_placed_at')} {fmtClock(order.submitted_at)}
                  </span>
                  <span className="font-mono text-xs text-[var(--text-tertiary)]">{order.id}</span>
                </div>
                {order.items.map((item) => (
                  <div
                    key={item.id}
                    className="border-b border-[var(--separator)]/60 px-4 py-3 last:border-b-0"
                  >
                    <div className="flex justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-[var(--text)]">
                          {lang === 'vi' ? item.name_snapshot_vi : item.name_snapshot_en}
                        </div>
                        <div className="text-sm text-[var(--text-tertiary)]">
                          {lang === 'vi' ? item.options_text_vi : item.options_text_en}
                        </div>
                        {item.notes ? (
                          <div className={`text-xs italic ${WARN_TEXT}`}>“{item.notes}”</div>
                        ) : null}
                        <div className="mt-1 text-xs text-[var(--text-tertiary)]">
                          {item.qty} × {fmtVND(item.unit_price_snapshot)}
                        </div>
                      </div>
                      <div className="font-bold tabular-nums text-[var(--text)]">
                        {fmtVND(item.line_total)}
                      </div>
                    </div>
                  </div>
                ))}
              </Card>
            ))}
          </div>
        </section>

        <Card className={`border border-[var(--separator)] ${LIST_CARD}`}>
          <CardContent className="space-y-3 p-5">
            <PriceRow label={t('subtotal')} value={fmtVND(invoice.subtotal)} />
            {invoice.service_charge_amount > 0 ? (
              <PriceRow label={t('service_charge')} value={fmtVND(invoice.service_charge_amount)} />
            ) : null}
            <PriceRow label={t('vat')} value={fmtVND(invoice.vat_amount)} />
            {invoice.discount ? (
              <PriceRow
                label={`${t('discount')} · ${invoice.discount.reason}`}
                value={`-${fmtVND(invoice.discount.amount)}`}
                tone="amber"
              />
            ) : (
              <Button
                variant="link"
                className="justify-start px-0"
                disabled={terminal}
                onClick={() => setDiscountOpen(true)}
              >
                {t('apply_discount')}
              </Button>
            )}
            {invoice.discount_history.length > 0 ? (
              <Textarea
                readOnly
                className="min-h-20 resize-none rounded-[var(--radius-lg)] bg-[var(--surface-grouped)] text-xs"
                value={invoice.discount_history
                  .map(
                    (item) =>
                      `${fmtClock(item.applied_at)} · ${item.action} · ${fmtVND(item.amount)} · ${item.reason}`,
                  )
                  .join('\n')}
              />
            ) : null}
            <Separator />
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-bold text-[var(--text)]">{t('total')}</span>
              <span className="text-4xl font-bold tabular-nums text-[var(--text)]">
                {fmtVND(invoice.total)}
              </span>
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                variant="secondary"
                className="flex-1 rounded-[var(--radius-lg)]"
                disabled={!invoice.discount || terminal}
                onClick={() => onRemoveDiscount(session.id)}
              >
                {t('remove_discount')}
              </Button>
              <Button
                variant="destructive"
                className="flex-1 rounded-[var(--radius-lg)]"
                disabled={invoice.payment?.status === 'pending' || terminal}
                onClick={() => setVoidOpen(true)}
              >
                {t('void_session')}
              </Button>
            </div>
            <Button
              variant="outline"
              className="w-full rounded-[var(--radius-lg)]"
              disabled={terminal || anyInvoicePaidOrPaying || hasDiscount}
              onClick={() => setSplitOpen(true)}
            >
              {t('split_invoice')}
            </Button>
            {hasDiscount ? (
              <p className="text-xs text-[var(--text-tertiary)]">
                {t('split_remove_discount_first')}
              </p>
            ) : null}
            {(session.status === 'bill_requested' || session.status === 'in_payment') && (
              <Button
                variant="outline"
                className="w-full rounded-[var(--radius-lg)]"
                disabled={reopenMutation.isPending}
                onClick={() => {
                  if (window.confirm(t('reopen_session_confirm'))) {
                    reopenMutation.mutate(session.id, {
                      onSuccess: () => {
                        toast.success(t('toast_reopen_done'))
                        onSessionReopened?.()
                      },
                      onError: (error) => {
                        toast.error(errorMessage(error, t('toast_reopen_failed')), {
                          id: 'cashier-reopen-session-error',
                        })
                      },
                    })
                  }
                }}
              >
                {reopenMutation.isPending && <Loader2 className="size-4 animate-spin" />}
                {t('reopen_session')}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <DiscountDialog
        open={discountOpen}
        session={session}
        t={t}
        onOpenChange={setDiscountOpen}
        onApply={(amount, reason) => {
          onApplyDiscount(session.id, amount, reason)
          setDiscountOpen(false)
        }}
        onRemove={() => {
          onRemoveDiscount(session.id)
          setDiscountOpen(false)
        }}
      />
      <VoidDialog
        open={voidOpen}
        session={session}
        t={t}
        onOpenChange={setVoidOpen}
        onConfirm={() => onCloseSession(session.id)}
      />
      <SplitDialog
        open={splitOpen}
        session={session}
        lang={lang}
        t={t}
        onOpenChange={setSplitOpen}
        onConfirm={(groups) => onSplit(session.id, groups)}
      />
    </div>
  )
}

function PriceRow({ label, value, tone }: { label: string; value: string; tone?: 'amber' }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span
        className={`font-semibold tabular-nums ${tone === 'amber' ? WARN_TEXT : 'text-[var(--text)]'}`}
      >
        {value}
      </span>
    </div>
  )
}
