import { type FC, useMemo, lazy, Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useOrdering } from '../hooks/use-ordering'
import { DICT } from '../data/i18n'
import { formatVND } from '../helpers'
import { fetchGuestOrders } from '../api'
import { brandNameUpper } from '@/lib/brand'
import type { Session } from '../types'
import { Button } from '../../../components/ui/button'
import { Card } from '../../../components/ui/card'
import { Separator } from '../../../components/ui/separator'

const createInvoiceNumber = (session: Session | null) => {
  const seed = session
    ? `${session.token}-${session.table}-${session.startedAt.getTime()}`
    : 'guest-invoice'
  let hash = 0

  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) % 900000
  }

  return 100000 + hash
}

const LazyGuestPDFLink = lazy(() => import('./guest-lazy-pdf-link'))

export const GuestInvoiceScreen: FC = () => {
  const { state, dispatch } = useOrdering()
  const t = DICT[state.lang]
  const sessionToken = state.session?.token

  const { data: ordersData } = useQuery({
    queryKey: ['guest-orders', sessionToken],
    queryFn: () => fetchGuestOrders(sessionToken!),
    enabled: !!sessionToken,
  })

  const { total, vat, grandTotal, invoiceItems } = useMemo(() => {
    const itemsList: Array<{ name: string; qty: number; price: number }> = []
    let subtotal = 0

    for (const order of ordersData?.orders ?? []) {
      for (const item of order.items) {
        const name = item.variant_name_snapshot
          ? `${item.name_snapshot} (${item.variant_name_snapshot})`
          : item.name_snapshot
        subtotal += item.total_amount_vnd
        itemsList.push({
          name,
          qty: item.quantity,
          // Effective unit price (line total / qty); server prices authoritatively.
          price: item.quantity > 0 ? Math.round(item.total_amount_vnd / item.quantity) : item.total_amount_vnd,
        })
      }
    }

    const grand = ordersData?.session_total_vnd ?? subtotal
    return {
      total: subtotal,
      vat: grand - subtotal,
      grandTotal: grand,
      invoiceItems: itemsList,
    }
  }, [ordersData])

  const handleFinish = () => {
    // Clear cart and session, then redirect to landing page
    dispatch({ type: 'CLEAR_CART' })
    dispatch({ type: 'SET_SCREEN', payload: 'qr' })
  }

  const currentDateString = useMemo(() => fmtDateTime(new Date()), [])
  const invoiceNumber = useMemo(() => createInvoiceNumber(state.session), [state.session])

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--material-thick)]/30">
      <header className="sticky top-0 z-sticky bg-background/80 backdrop-blur-xl border-b border-separator px-4 pt-4 pb-3 text-center">
        <h1 className="text-lg font-bold text-system-green">
          {state.lang === 'vi' ? 'Thanh Toán Thành Công!' : 'Payment Successful!'}
        </h1>
        <p className="text-xs text-tertiary mt-0.5">
          {state.lang === 'vi' ? 'Hóa đơn điện tử của bạn đã sẵn sàng' : 'Your e-invoice is ready'}
        </p>
      </header>

      <div className="flex-1 px-4 py-6 flex flex-col gap-5 overflow-y-auto">
        {/* Success Visual Card */}
        <Card className="border border-separator bg-elevated/70 shadow-lg p-5 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-system-green/10 text-2xl text-system-green animate-in zoom-in duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]">
            ✓
          </div>
          <h2 className="mt-3 text-base font-bold text-primary">
            {state.lang === 'vi' ? 'Hóa Đơn Số Bàn' : 'Table Bill'} {state.session?.table}
          </h2>
          <p className="text-xs text-tertiary mt-1">
            {state.lang === 'vi' ? 'Cảm ơn quý khách đã tin dùng và lựa chọn nhà hàng chúng tôi.' : 'Thank you for choosing our restaurant.'}
          </p>
        </Card>

        {/* Invoice Summary Details */}
        <Card className="border border-separator bg-elevated/70 shadow-lg p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-tertiary mb-3">
            {state.lang === 'vi' ? 'TÓM TẮT HÓA ĐƠN' : 'BILL SUMMARY'}
          </h3>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-secondary">{t.subtotal}</span>
              <span className="font-semibold text-primary tabular-nums">{formatVND(total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">{t.vat}</span>
              <span className="font-semibold text-primary tabular-nums">{formatVND(vat)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-base font-bold">
              <span className="text-primary">{t.total.toUpperCase()}</span>
              <span className="text-system-blue tabular-nums">{formatVND(grandTotal)}</span>
            </div>
          </div>
        </Card>

        {/* PDF Download Section */}
        <Suspense fallback={
          <Button className="w-full h-14 rounded-xl font-bold flex items-center justify-center cursor-pointer shadow-lg" disabled>
            <span className="flex items-center justify-center">
              <Loader2 className="animate-spin mr-2 h-5 w-5 text-current" />
              {state.lang === 'vi' ? 'Đang chuẩn bị PDF...' : 'Preparing PDF...'}
            </span>
          </Button>
        }>
          <LazyGuestPDFLink pdfProps={{
            restaurantName: brandNameUpper(state.lang),
            tableName: `${state.session?.table}`,
            date: currentDateString,
            items: invoiceItems,
            total,
            vat,
            grandTotal,
            lang: state.lang,
            invoiceNumber
          }} />
        </Suspense>
      </div>

      <div className="sticky bottom-0 px-4 py-4 bg-background/80 backdrop-blur-xl border-t border-separator">
        <Button variant="secondary" className="w-full h-12 rounded-xl font-bold cursor-pointer" onClick={handleFinish}>
          {state.lang === 'vi' ? 'Hoàn Tất dùng bữa' : 'Finish Session'}
        </Button>
      </div>
    </div>
  )
}

function fmtDateTime(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default GuestInvoiceScreen
