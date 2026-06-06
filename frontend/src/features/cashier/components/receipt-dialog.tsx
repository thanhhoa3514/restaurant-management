import { useMemo, lazy, Suspense, type FC } from 'react'
import { Spinner } from '@/components/ui/spinner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { fmtDateTime, fmtVND, providerName } from '@/features/cashier/helpers'
import type { CashierSession } from '@/features/cashier/types'
const LazyPDFLink = lazy(() => import('./lazy-pdf-link'))

interface ReceiptDialogProps {
  open: boolean
  session: CashierSession | null
  t: (key: string, ...args: Array<number | string>) => string
  lang: 'vi' | 'en'
  onOpenChange: (open: boolean) => void
}

export const ReceiptDialog: FC<ReceiptDialogProps> = ({ open, session, t, lang, onOpenChange }) => {
  const methodLabel = useMemo(() => {
    const payment = session?.payment
    if (!payment) return '—'
    if (payment.method === 'cash') return t('method_cash')
    if (payment.method === 'card') return `${t('method_card')}${payment.last4 ? ` · •••• ${payment.last4}` : ''}`
    return `${t('method_ewallet')} · ${providerName(payment.sub_method)}`
  }, [session, t])

  if (!session) return null

  const invoice = session.invoice

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg bg-[var(--material-thick)]" hideClose>
        <SheetHeader title={t('print_receipt')} subtitle={invoice.number} />
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          <Card className="mx-auto max-w-sm border border-[var(--separator)] bg-white p-5 font-mono text-xs leading-relaxed text-zinc-950 shadow-xl">
            <div className="text-center">
              <div className="text-base font-bold">{t('restaurant')}</div>
              <div>{t('restaurant_address')}</div>
              <div>{t('restaurant_phone')}</div>
            </div>
            <Dashed />
            <div className="text-center text-sm font-bold uppercase tracking-wider">{t('receipt_title')}</div>
            <div className="mt-2 space-y-1">
              <ReceiptRow label={t('receipt_no')} value={invoice.number} />
              <ReceiptRow label={t('receipt_date')} value={fmtDateTime(session.payment?.completed_at ?? new Date())} />
              <ReceiptRow
                label={t('receipt_table')}
                value={`${session.table_number} · ${lang === 'vi' ? session.area_name_vi : session.area_name_en}`}
              />
              <ReceiptRow label={t('receipt_cashier')} value={t('cashier_name')} />
            </div>
            <Dashed />
            {invoice.items.map((item) => (
              <div key={item.id} className="mb-2 flex justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{lang === 'vi' ? item.name_snapshot_vi : item.name_snapshot_en} × {item.qty}</div>
                  <div className="text-[11px] text-zinc-500">{fmtVND(item.unit_price_snapshot)}</div>
                </div>
                <div className="font-semibold tabular-nums">{fmtVND(item.line_total)}</div>
              </div>
            ))}
            <Dashed />
            <ReceiptRow label={t('subtotal')} value={fmtVND(invoice.subtotal)} />
            {invoice.service_charge_amount > 0 ? (
              <ReceiptRow label={t('service_charge')} value={fmtVND(invoice.service_charge_amount)} />
            ) : null}
            <ReceiptRow label={t('vat')} value={fmtVND(invoice.vat_amount)} />
            {invoice.discount ? <ReceiptRow label={t('discount')} value={`-${fmtVND(invoice.discount.amount)}`} /> : null}
            <Dashed />
            <div className="flex justify-between text-sm font-bold">
              <span>{t('total').toUpperCase()}</span>
              <span className="tabular-nums">{fmtVND(invoice.total)}</span>
            </div>
            <div className="mt-3">
              <ReceiptRow label={t('receipt_method')} value={methodLabel} />
              {session.payment?.transaction_id ? <ReceiptRow label={t('paid_txn')} value={session.payment.transaction_id} /> : null}
            </div>
            <Dashed />
            <div className="text-center">
              <div>{t('receipt_thanks')}</div>
              <div className="mx-auto mt-3 grid size-24 grid-cols-6 gap-0.5 rounded bg-white p-1 outline outline-zinc-300">
                {Array.from({ length: 36 }, (_, index) => (
                  <span key={index} className={(index + invoice.number.length) % 3 === 0 ? 'bg-zinc-950' : 'bg-white'} />
                ))}
              </div>
              <div className="mt-1 text-[10px] text-zinc-500">{t('receipt_scan_hint')}</div>
            </div>
          </Card>
        </div>
        <div className="flex gap-2 border-t border-[var(--separator)] p-4">
          <Button variant="secondary" className="flex-1 rounded-[var(--radius-lg)]" onClick={() => onOpenChange(false)}>
            {t('close')}
          </Button>
          <Suspense fallback={
            <Button className="flex-1 rounded-[var(--radius-lg)] cursor-pointer" disabled>
              <span className="flex items-center justify-center">
                <Spinner className="mr-2 h-4 w-4 text-current" />
                {t('loading_pdf', 'Đang tải...')}
              </span>
            </Button>
          }>
            <LazyPDFLink session={session} t={t} lang={lang} />
          </Suspense>
          <Button className="flex-1 rounded-[var(--radius-lg)]" onClick={() => window.print()}>
            {t('print')}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span>{label}:</span>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  )
}

function Dashed() {
  return <Separator className="my-3 border-t border-dashed border-zinc-400 bg-transparent" />
}

export default ReceiptDialog
