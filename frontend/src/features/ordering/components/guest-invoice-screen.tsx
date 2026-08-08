import { lazy, Suspense, type FC } from 'react'
import { CheckCircle2, CircleAlert, Loader2, ReceiptText, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { brandNameUpper } from '@/constants/brand'
import type { BillingInvoiceDTO, BillingPaymentDTO } from '@/features/billing/api'
import { formatVND } from '@/features/ordering/helpers'
import { useOrdering } from '@/features/ordering/hooks/use-ordering'
import { useGuestPayment } from '@/features/ordering/queries/useGuestPayment'
import { clearSession } from '@/features/ordering/session-store'
import { errorMessage } from '@/lib/api'
import { setGuestDeviceAccessToken } from '@/lib/realtime-auth'
import { fmtDateTime } from '@/shared/date'

const LazyGuestPDFLink = lazy(() => import('./guest-lazy-pdf-link'))

type Lang = 'vi' | 'en'

function paymentLabel(payment: BillingPaymentDTO, lang: Lang): string {
  const code = payment.method_code.toUpperCase()
  const labels: Record<string, [string, string]> = {
    CASH: ['Tiền mặt', 'Cash'],
    BANK_TRANSFER: ['Chuyển khoản', 'Bank transfer'],
    SEPAY: ['Chuyển khoản SePay', 'SePay transfer'],
    VIETQR: ['Chuyển khoản VietQR', 'VietQR transfer'],
    CARD: ['Thẻ', 'Card'],
    E_WALLET: ['Ví điện tử', 'E-wallet'],
  }
  const known = labels[code]
  if (known) return lang === 'vi' ? known[0] : known[1]
  return payment.method_code.replaceAll('_', ' ')
}

function invoicePaymentMethod(invoice: BillingInvoiceDTO, lang: Lang): string {
  const payments = invoice.payments ?? (invoice.payment ? [invoice.payment] : [])
  const completed = payments.filter((payment) => payment.status === 'COMPLETED')
  const labels = [...new Set(completed.map((payment) => paymentLabel(payment, lang)))]
  return labels.join(', ') || (lang === 'vi' ? 'Chưa ghi nhận' : 'Not recorded')
}

function vatLabel(invoice: BillingInvoiceDTO, lang: Lang): string {
  const rate = new Intl.NumberFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
    maximumFractionDigits: 2,
  }).format(invoice.vat_basis_points / 100)
  return `VAT (${rate}%)`
}

export const GuestInvoiceScreen: FC = () => {
  const { state, dispatch } = useOrdering()
  const deviceAccessToken = state.session?.accessToken
  const lang = state.lang
  const {
    data: checkout,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useGuestPayment(deviceAccessToken)
  const invoices = (checkout?.invoices ?? []).filter((invoice) => invoice.status === 'PAID')

  const handleFinish = () => {
    clearSession()
    setGuestDeviceAccessToken('')
    dispatch({ type: 'END_SESSION' })
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--material-thick)]/30">
      <header className="sticky top-0 z-sticky border-b border-separator bg-background/80 px-4 pb-3 pt-4 text-center backdrop-blur-xl">
        <h1 className="text-lg font-bold text-system-green">
          {lang === 'vi' ? 'Thanh toán thành công' : 'Payment successful'}
        </h1>
        <p className="mt-0.5 text-xs text-tertiary">
          {lang === 'vi' ? 'Hóa đơn điện tử của bạn đã sẵn sàng' : 'Your e-invoice is ready'}
        </p>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-5 px-4 py-6">
        <Card className="border border-separator bg-elevated/70 p-5 text-center shadow-lg">
          <CheckCircle2 className="mx-auto size-12 text-system-green" />
          <h2 className="mt-3 text-base font-bold text-primary">
            {lang === 'vi' ? 'Bàn' : 'Table'} {state.session?.table}
          </h2>
          <p className="mt-1 text-xs text-tertiary">
            {lang === 'vi'
              ? 'Cảm ơn quý khách. Thông tin bên dưới được lấy từ hóa đơn đã thanh toán.'
              : 'Thank you. The details below come from the paid invoice.'}
          </p>
        </Card>

        {isLoading ? (
          <Card className="border border-separator bg-elevated/70 p-8 text-center">
            <Loader2 className="mx-auto size-7 animate-spin text-system-blue" />
            <p className="mt-3 text-sm font-medium text-secondary">
              {lang === 'vi' ? 'Đang tải hóa đơn...' : 'Loading invoice...'}
            </p>
          </Card>
        ) : isError || invoices.length === 0 ? (
          <Card className="border border-separator bg-elevated/70 p-6 text-center">
            <CircleAlert className="mx-auto size-9 text-system-orange" />
            <h2 className="mt-3 text-base font-bold text-primary">
              {lang === 'vi' ? 'Chưa tải được hóa đơn' : 'Could not load the invoice'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-secondary">
              {isError
                ? errorMessage(
                    error,
                    lang === 'vi'
                      ? 'Kiểm tra kết nối rồi thử lại.'
                      : 'Check your connection and try again.',
                  )
                : lang === 'vi'
                  ? 'Hệ thống chưa trả về hóa đơn đã thanh toán. Vui lòng tải lại.'
                  : 'No paid invoice was returned yet. Please reload.'}
            </p>
            <Button className="mt-5 h-12 w-full" onClick={() => void refetch()}>
              {isFetching ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 size-4" />
              )}
              {lang === 'vi' ? 'Tải lại hóa đơn' : 'Reload invoice'}
            </Button>
          </Card>
        ) : (
          invoices.map((invoice) => (
            <InvoiceCard
              key={invoice.id}
              invoice={invoice}
              lang={lang}
              restaurantName={brandNameUpper(lang)}
              tableName={`${state.session?.table ?? ''}`}
            />
          ))
        )}
      </main>

      <div className="sticky bottom-0 border-t border-separator bg-background/80 px-4 py-4 backdrop-blur-xl">
        <Button
          variant="secondary"
          className="h-12 w-full rounded-xl font-bold cursor-pointer"
          onClick={handleFinish}
        >
          {lang === 'vi' ? 'Hoàn tất dùng bữa' : 'Finish session'}
        </Button>
      </div>
    </div>
  )
}

function InvoiceCard({
  invoice,
  lang,
  restaurantName,
  tableName,
}: {
  invoice: BillingInvoiceDTO
  lang: Lang
  restaurantName: string
  tableName: string
}) {
  const paymentMethod = invoicePaymentMethod(invoice, lang)
  const invoiceDate = fmtDateTime(
    new Date(invoice.paid_at ?? invoice.issued_at ?? new Date().toISOString()),
  )
  const items = invoice.items.map((item) => ({
    id: item.id,
    name: item.name_snapshot,
    isTakeaway: item.is_takeaway,
    qty: item.quantity,
    unitPrice: item.unit_price_vnd,
    lineTotal: item.total_amount_vnd,
  }))

  return (
    <Card className="border border-separator bg-elevated/70 p-4 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-tertiary">
            {lang === 'vi' ? 'Mã hóa đơn' : 'Invoice number'}
          </p>
          <h3 className="mt-1 font-mono text-sm font-bold text-primary">
            {invoice.invoice_number}
          </h3>
        </div>
        <ReceiptText className="size-5 shrink-0 text-system-blue" />
      </div>

      <div className="mt-4 space-y-3">
        {invoice.items.map((item) => (
          <div
            key={item.id}
            className={`flex items-start justify-between gap-4 text-sm ${item.parent_invoice_item_id ? 'pl-4 text-secondary' : ''}`}
          >
            <div className="min-w-0">
              <span className="font-semibold text-primary">
                {item.quantity} × {item.name_snapshot}
              </span>
              {item.is_takeaway ? (
                <span className="ml-2 rounded-full bg-system-orange/10 px-2 py-0.5 text-[10px] font-bold text-system-orange">
                  {lang === 'vi' ? 'Mang về' : 'Takeaway'}
                </span>
              ) : null}
            </div>
            <span className="shrink-0 font-semibold tabular-nums text-primary">
              {formatVND(item.total_amount_vnd)}
            </span>
          </div>
        ))}
      </div>

      <Separator className="my-4" />

      <div className="space-y-2.5 text-sm">
        <InvoiceTotalRow
          label={lang === 'vi' ? 'Tạm tính' : 'Subtotal'}
          amount={invoice.subtotal_vnd}
        />
        {invoice.discount_amount_vnd > 0 ? (
          <InvoiceTotalRow
            label={lang === 'vi' ? 'Giảm giá' : 'Discount'}
            amount={-invoice.discount_amount_vnd}
          />
        ) : null}
        {invoice.service_charge_amount_vnd > 0 ? (
          <InvoiceTotalRow
            label={lang === 'vi' ? 'Phí phục vụ' : 'Service charge'}
            amount={invoice.service_charge_amount_vnd}
          />
        ) : null}
        <InvoiceTotalRow label={vatLabel(invoice, lang)} amount={invoice.vat_amount_vnd} />
        <Separator />
        <div className="flex justify-between text-base font-bold">
          <span className="text-primary">{lang === 'vi' ? 'Tổng tiền' : 'Total'}</span>
          <span className="tabular-nums text-system-blue">
            {formatVND(invoice.total_amount_vnd)}
          </span>
        </div>
        <div className="flex justify-between gap-4 pt-1 text-xs">
          <span className="text-tertiary">
            {lang === 'vi' ? 'Phương thức thanh toán' : 'Payment method'}
          </span>
          <span className="text-right font-semibold text-secondary">{paymentMethod}</span>
        </div>
      </div>

      <Suspense
        fallback={
          <Button className="mt-5 h-14 w-full rounded-xl font-bold" disabled>
            <Loader2 className="mr-2 size-5 animate-spin" />
            {lang === 'vi' ? 'Đang chuẩn bị PDF...' : 'Preparing PDF...'}
          </Button>
        }
      >
        <div className="mt-5">
          <LazyGuestPDFLink
            pdfProps={{
              restaurantName,
              tableName,
              date: invoiceDate,
              items,
              subtotal: invoice.subtotal_vnd,
              discount: invoice.discount_amount_vnd,
              serviceCharge: invoice.service_charge_amount_vnd,
              vat: invoice.vat_amount_vnd,
              vatBasisPoints: invoice.vat_basis_points,
              grandTotal: invoice.total_amount_vnd,
              paymentMethod,
              lang,
              invoiceNumber: invoice.invoice_number,
            }}
          />
        </div>
      </Suspense>
    </Card>
  )
}

function InvoiceTotalRow({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-secondary">{label}</span>
      <span className="font-semibold tabular-nums text-primary">{formatVND(amount)}</span>
    </div>
  )
}
