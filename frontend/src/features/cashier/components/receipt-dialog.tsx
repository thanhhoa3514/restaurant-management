import { useMemo, lazy, Suspense, useSyncExternalStore, type FC } from 'react'
import { Loader2, Printer, X } from 'lucide-react'

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
const LazyPDFLink = lazy(() => import('./lazy-pdf-link'))

interface ReceiptDialogProps {
  open: boolean
  session: CashierSession | null
  t: (key: string, ...args: Array<number | string>) => string
  lang: 'vi' | 'en'
  onOpenChange: (open: boolean) => void
}

export const ReceiptDialog: FC<ReceiptDialogProps> = ({ open, session, t, lang, onOpenChange }) => {
  const nowMs = useSyncExternalStore(subscribeTimer, () => cachedNow, () => 0)
  const now = nowMs ? new Date(nowMs) : null

  const invoice = session ? activeInvoice(session) : null

  const methodLabel = useMemo(() => {
    const payment = invoice?.payment
    if (!payment) return '—'
    if (payment.method === 'cash') return t('method_cash')
    if (payment.method === 'card') return `${t('method_card')}${payment.last4 ? ` · •••• ${payment.last4}` : ''}`
    return `${t('method_ewallet')} · ${providerName(payment.sub_method)}`
  }, [invoice, t])

  if (!session || !invoice) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="max-w-md gap-0 bg-transparent p-0 border-0 shadow-none">
        <DialogTitle className="sr-only">{t('print_receipt')}</DialogTitle>
        
        {/* Wrapper to center and style */}
        <div className="flex flex-col items-center justify-center p-4">
          
          {/* Close button floating above */}
          <div className="w-full flex justify-end mb-3 max-w-[360px]">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full" onClick={() => onOpenChange(false)}>
              <X className="size-6" />
            </Button>
          </div>

          {/* The Thermal Paper Receipt */}
          <div className="relative w-full max-w-[360px] bg-[#fdfbf7] text-zinc-800 shadow-[0_20px_50px_rgba(0,0,0,0.4)] font-mono text-[13px] leading-relaxed">
            
            {/* Top decorative edge */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-zinc-300 to-zinc-200" />
            
            <div className="p-7">
              {/* Header */}
              <div className="text-center mb-6">
                <div className="text-xl font-black uppercase tracking-wider">{t('restaurant')}</div>
                <div className="text-[11px] text-zinc-600 mt-1">{t('restaurant_address')}</div>
                <div className="text-[11px] text-zinc-600">{t('restaurant_phone')}</div>
              </div>
              
              <Dashed />
              
              <div className="text-center font-bold uppercase tracking-[0.2em] my-5 text-base">
                {t('receipt_title')}
              </div>
              
              {/* Meta Info */}
              <div className="space-y-1.5 text-xs mb-5">
                <ReceiptRow label={t('receipt_no')} value={invoice.number} />
                <ReceiptRow label={t('receipt_date')} value={invoice.payment?.completed_at ? fmtDateTime(invoice.payment.completed_at) : (now ? fmtDateTime(now) : '')} />
                <ReceiptRow
                  label={t('receipt_table')}
                  value={`${session.table_label} · ${lang === 'vi' ? session.area_name_vi : session.area_name_en}`}
                />
                <ReceiptRow label={t('receipt_cashier')} value={t('cashier_name')} />
              </div>
              
              <Dashed />
              
              {/* Items */}
              <div className="my-5 space-y-3">
                {invoice.items.map((item) => (
                  <div key={item.id} className="flex justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-[13px] leading-tight">
                        {lang === 'vi' ? item.name_snapshot_vi : item.name_snapshot_en}
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">
                        {item.qty} × {fmtVND(item.unit_price_snapshot)}
                      </div>
                    </div>
                    <div className="font-bold tabular-nums text-[13px] mt-0.5">
                      {fmtVND(item.line_total)}
                    </div>
                  </div>
                ))}
              </div>
              
              <Dashed />
              
              {/* Summary */}
              <div className="my-5 space-y-2 text-xs">
                <ReceiptRow label={t('subtotal')} value={fmtVND(invoice.subtotal)} />
                {invoice.service_charge_amount > 0 ? (
                  <ReceiptRow label={t('service_charge')} value={fmtVND(invoice.service_charge_amount)} />
                ) : null}
                <ReceiptRow label={t('vat')} value={fmtVND(invoice.vat_amount)} />
                {invoice.discount ? <ReceiptRow label={t('discount')} value={`-${fmtVND(invoice.discount.amount)}`} /> : null}
              </div>
              
              <Dashed />
              
              {/* Total & Payment */}
              <div className="flex justify-between items-end text-base font-bold my-5">
                <span>{t('total').toUpperCase()}</span>
                <span className="tabular-nums text-xl leading-none">{fmtVND(invoice.total)}</span>
              </div>
              
              <div className="space-y-1.5 text-xs">
                <ReceiptRow label={t('receipt_method')} value={methodLabel} />
                {invoice.payment?.transaction_id ? <ReceiptRow label={t('paid_txn')} value={invoice.payment.transaction_id} /> : null}
              </div>
              
              <Dashed />
              
              {/* Footer & Barcode */}
              <div className="text-center mt-6">
                <div className="text-xs font-medium italic mb-5">{t('receipt_thanks')}</div>
                
                {/* Fake Barcode Generator */}
                <div className="flex justify-center h-12 w-full max-w-[200px] mx-auto opacity-80">
                  {Array.from({ length: 50 }).map((_, i) => (
                    <div 
                      key={i} 
                      className="bg-zinc-900" 
                      style={{ 
                        width: `${Math.random() > 0.5 ? 2 : 1.5}px`, 
                        marginLeft: `${Math.random() > 0.5 ? 1 : 2}px`,
                        height: '100%',
                      }} 
                    />
                  ))}
                </div>
                <div className="mt-2 text-[10px] text-zinc-500 tracking-[0.2em] uppercase">{invoice.number}</div>
              </div>
            </div>
            
            {/* Bottom jagged edge simulation using CSS */}
            <div className="absolute bottom-0 w-full h-[6px] opacity-10" style={{
              backgroundImage: 'linear-gradient(45deg, transparent 33.333%, #000 33.333%, #000 66.667%, transparent 66.667%), linear-gradient(-45deg, transparent 33.333%, #000 33.333%, #000 66.667%, transparent 66.667%)',
              backgroundSize: '12px 24px',
              backgroundPosition: '0 100%'
            }} />
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex w-full max-w-[360px] gap-3">
             <div className="flex-1 flex bg-white rounded-2xl overflow-hidden shadow-sm">
               <Suspense fallback={
                  <Button className="w-full h-12 rounded-2xl bg-white text-zinc-800" disabled>
                    <Loader2 className="animate-spin mr-2 size-5" />
                    PDF
                  </Button>
                }>
                  <LazyPDFLink session={session} t={t} lang={lang} />
                </Suspense>
             </div>
            <Button className="flex-1 rounded-2xl h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-lg" onClick={() => window.print()}>
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
    <div className="flex justify-between gap-3">
      <span className="text-zinc-500">{label}</span>
      <span className="text-right tabular-nums font-semibold text-zinc-800">{value}</span>
    </div>
  )
}

function Dashed() {
  return <Separator className="my-4 border-t border-dashed border-zinc-300 bg-transparent" />
}
