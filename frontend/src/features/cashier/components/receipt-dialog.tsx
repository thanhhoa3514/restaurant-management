import { useState, useMemo, lazy, Suspense, useSyncExternalStore, type FC } from 'react'
import { Loader2, Printer, X, SlidersHorizontal } from 'lucide-react'

let cachedNow = Date.now()

const subscribeTimer = (cb: () => void) => {
  const timer = setInterval(() => {
    cachedNow = Date.now()
    cb()
  }, 1000)
  return () => clearInterval(timer)
}

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { activeInvoice, fmtDateTime, fmtVND, providerName } from '@/features/cashier/helpers'
import type { CashierSession } from '@/features/cashier/types'
import { cn } from '@/lib/utils'

const LazyPDFLink = lazy(() => import('./lazy-pdf-link'))

type PaperSize = '80mm' | '58mm'

interface ReceiptDialogProps {
  open: boolean
  session: CashierSession | null
  t: (key: string, ...args: Array<number | string>) => string
  lang: 'vi' | 'en'
  onOpenChange: (open: boolean) => void
}

export const ReceiptDialog: FC<ReceiptDialogProps> = ({ open, session, t, lang, onOpenChange }) => {
  const [paperSize, setPaperSize] = useState<PaperSize>('80mm')
  const nowMs = useSyncExternalStore(
    subscribeTimer,
    () => cachedNow,
    () => 0,
  )
  const now = nowMs ? new Date(nowMs) : null

  const invoice = session ? activeInvoice(session) : null

  const methodLabel = useMemo(() => {
    const payment = invoice?.payment
    if (!payment) return '—'
    if (payment.method === 'cash') return t('method_cash')
    if (payment.method === 'card')
      return `${t('method_card')}${payment.last4 ? ` · •••• ${payment.last4}` : ''}`
    return `${t('method_ewallet')} · ${providerName(payment.sub_method)}`
  }, [invoice, t])

  const handleWebPrint = () => {
    window.print()
  }

  if (!session || !invoice) return null

  const isK58 = paperSize === '58mm'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-xl gap-0 bg-transparent p-0 border-0 shadow-none"
      >
        <DialogTitle className="sr-only">{t('print_receipt')}</DialogTitle>

        {/* Style injection for seamless Thermal Paper Printing */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
            @media print {
              body * {
                visibility: hidden !important;
              }
              #thermal-receipt-print, #thermal-receipt-print * {
                visibility: visible !important;
              }
              #thermal-receipt-print {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: ${paperSize} !important;
                margin: 0 !important;
                padding: 12px 8px !important;
                box-shadow: none !important;
                background: #ffffff !important;
                color: #000000 !important;
              }
              @page {
                size: ${paperSize} auto;
                margin: 0mm;
              }
            }
          `,
          }}
        />

        {/* Wrapper to center and style */}
        <div className="flex flex-col items-center justify-center p-4">
          {/* Controls Bar: Paper Size Selector & Close */}
          <div className="w-full flex items-center justify-between mb-4 max-w-[380px] bg-zinc-900/90 backdrop-blur-md p-2 rounded-2xl border border-zinc-800 text-white shadow-lg">
            <div className="flex items-center gap-1.5 pl-2">
              <SlidersHorizontal className="size-4 text-zinc-400" />
              <span className="text-xs font-semibold text-zinc-300">Khổ giấy:</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPaperSize('80mm')}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                  paperSize === '80mm'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800',
                )}
              >
                K80 (80mm)
              </button>
              <button
                type="button"
                onClick={() => setPaperSize('58mm')}
                className={cn(
                  'px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer',
                  paperSize === '58mm'
                    ? 'bg-white text-zinc-900 shadow-sm'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800',
                )}
              >
                K58 (58mm)
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-full ml-1"
                onClick={() => onOpenChange(false)}
              >
                <X className="size-5" />
              </Button>
            </div>
          </div>

          {/* The Thermal Paper Receipt Container */}
          <div
            id="thermal-receipt-print"
            className={cn(
              'relative bg-[#fdfbf7] text-zinc-900 shadow-[0_20px_50px_rgba(0,0,0,0.4)] font-mono leading-relaxed transition-all duration-300',
              isK58 ? 'w-[280px] text-[11px] p-5' : 'w-[360px] text-[13px] p-7',
            )}
          >
            {/* Top decorative edge */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-zinc-300 to-zinc-200" />

            <div>
              {/* Header */}
              <div className="text-center mb-5">
                <div
                  className={cn(
                    'font-black uppercase tracking-wider',
                    isK58 ? 'text-base' : 'text-xl',
                  )}
                >
                  {t('restaurant')}
                </div>
                <div className={cn('text-zinc-600 mt-1', isK58 ? 'text-[10px]' : 'text-[11px]')}>
                  {t('restaurant_address')}
                </div>
                <div className={cn('text-zinc-600', isK58 ? 'text-[10px]' : 'text-[11px]')}>
                  {t('restaurant_phone')}
                </div>
              </div>

              <Dashed />

              <div
                className={cn(
                  'text-center font-bold uppercase tracking-[0.18em] my-4',
                  isK58 ? 'text-sm' : 'text-base',
                )}
              >
                {t('receipt_title')}
              </div>

              {/* Meta Info */}
              <div className={cn('space-y-1 mb-4', isK58 ? 'text-[11px]' : 'text-xs')}>
                <ReceiptRow label={t('receipt_no')} value={invoice.number} />
                <ReceiptRow
                  label={t('receipt_date')}
                  value={
                    invoice.payment?.completed_at
                      ? fmtDateTime(invoice.payment.completed_at)
                      : now
                        ? fmtDateTime(now)
                        : ''
                  }
                />
                <ReceiptRow
                  label={t('receipt_table')}
                  value={`${session.table_label} · ${lang === 'vi' ? session.area_name_vi : session.area_name_en}`}
                />
                <ReceiptRow label={t('receipt_cashier')} value={t('cashier_name')} />
              </div>

              <Dashed />

              {/* Items */}
              <div className="my-4 space-y-2.5">
                {invoice.items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div
                        className={cn(
                          'font-bold leading-tight',
                          isK58 ? 'text-[12px]' : 'text-[13px]',
                        )}
                      >
                        {lang === 'vi' ? item.name_snapshot_vi : item.name_snapshot_en}
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-0.5">
                        {item.qty} × {fmtVND(item.unit_price_snapshot)}
                      </div>
                    </div>
                    <div
                      className={cn(
                        'font-bold tabular-nums shrink-0 mt-0.5',
                        isK58 ? 'text-[12px]' : 'text-[13px]',
                      )}
                    >
                      {fmtVND(item.line_total)}
                    </div>
                  </div>
                ))}
              </div>

              <Dashed />

              {/* Summary */}
              <div className={cn('my-4 space-y-1.5', isK58 ? 'text-[11px]' : 'text-xs')}>
                <ReceiptRow label={t('subtotal')} value={fmtVND(invoice.subtotal)} />
                {invoice.service_charge_amount > 0 ? (
                  <ReceiptRow
                    label={t('service_charge')}
                    value={fmtVND(invoice.service_charge_amount)}
                  />
                ) : null}
                <ReceiptRow label={t('vat')} value={fmtVND(invoice.vat_amount)} />
                {invoice.discount ? (
                  <ReceiptRow label={t('discount')} value={`-${fmtVND(invoice.discount.amount)}`} />
                ) : null}
              </div>

              <Dashed />

              {/* Total & Payment */}
              <div className="flex justify-between items-end font-bold my-4">
                <span className={isK58 ? 'text-sm' : 'text-base'}>{t('total').toUpperCase()}</span>
                <span className={cn('tabular-nums leading-none', isK58 ? 'text-lg' : 'text-xl')}>
                  {fmtVND(invoice.total)}
                </span>
              </div>

              <div className={cn('space-y-1', isK58 ? 'text-[11px]' : 'text-xs')}>
                <ReceiptRow label={t('receipt_method')} value={methodLabel} />
                {invoice.payment?.transaction_id ? (
                  <ReceiptRow label={t('paid_txn')} value={invoice.payment.transaction_id} />
                ) : null}
              </div>

              <Dashed />

              {/* Footer & Barcode */}
              <div className="text-center mt-5">
                <div className="text-xs font-medium italic mb-4">{t('receipt_thanks')}</div>

                {/* Simulated Barcode */}
                <div className="flex justify-center h-10 w-full max-w-[180px] mx-auto opacity-85">
                  {Array.from({ length: 42 }).map((_, i) => (
                    <div
                      key={i}
                      className="bg-zinc-900"
                      style={{
                        width: `${i % 3 === 0 ? 2.5 : 1.5}px`,
                        marginLeft: `${i % 2 === 0 ? 1 : 2}px`,
                        height: '100%',
                      }}
                    />
                  ))}
                </div>
                <div className="mt-1.5 text-[10px] text-zinc-500 tracking-[0.2em] uppercase">
                  {invoice.number}
                </div>
              </div>
            </div>

            {/* Bottom jagged edge simulation */}
            <div
              className="absolute bottom-0 left-0 right-0 h-[6px] opacity-10"
              style={{
                backgroundImage:
                  'linear-gradient(45deg, transparent 33.333%, #000 33.333%, #000 66.667%, transparent 66.667%), linear-gradient(-45deg, transparent 33.333%, #000 33.333%, #000 66.667%, transparent 66.667%)',
                backgroundSize: '12px 24px',
                backgroundPosition: '0 100%',
              }}
            />
          </div>

          {/* Action Buttons */}
          <div className="mt-5 flex w-full max-w-[360px] gap-3">
            <div className="flex-1 flex bg-white rounded-2xl overflow-hidden shadow-sm">
              <Suspense
                fallback={
                  <Button className="w-full h-12 rounded-2xl bg-white text-zinc-800" disabled>
                    <Loader2 className="animate-spin mr-2 size-5" />
                    PDF
                  </Button>
                }
              >
                <LazyPDFLink session={session} t={t} lang={lang} />
              </Suspense>
            </div>
            <Button
              className="flex-1 rounded-2xl h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-lg cursor-pointer"
              onClick={handleWebPrint}
            >
              <Printer className="mr-2 size-5" />
              {t('print')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-zinc-500 shrink-0">{label}</span>
      <span className="text-right tabular-nums font-semibold text-zinc-900 truncate">{value}</span>
    </div>
  )
}

function Dashed() {
  return <Separator className="my-3 border-t border-dashed border-zinc-300 bg-transparent" />
}
