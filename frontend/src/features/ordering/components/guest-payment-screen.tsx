import { useEffect, useRef, useState, type FC } from 'react'
import { CheckCircle2, Copy, Loader2, QrCode, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useOrdering } from '@/features/ordering/hooks/use-ordering'
import { useGuestPayment } from '@/features/ordering/queries/useGuestPayment'
import { formatVND } from '@/features/ordering/helpers'
import { clearSession } from '@/features/ordering/session-store'
import { setGuestRealtimeToken } from '@/lib/realtime-auth'

export const GuestPaymentScreen: FC = () => {
  const { state, dispatch } = useOrdering()
  const sessionToken = state.session?.token
  const isVietnamese = state.lang === 'vi'
  const { data, isLoading, isError, refetch, isFetching } = useGuestPayment(sessionToken, true)
  const [failedQRURL, setFailedQRURL] = useState<string | null>(null)

  const invoices = data?.invoices ?? []
  const newestInvoices = [...invoices].reverse()
  const activeInvoice =
    newestInvoices.find((invoice) => invoice.payment?.status === 'PROCESSING') ??
    newestInvoices.find((invoice) => invoice.status !== 'PAID') ??
    newestInvoices[0]
  const payment = activeInvoice?.payment
  const allPaid = invoices.length > 0 && invoices.every((invoice) => invoice.status === 'PAID')
  const qrFailed = Boolean(payment?.qr_code_url && failedQRURL === payment.qr_code_url)
  const notifiedPaymentRef = useRef<string | null>(null)

  useEffect(() => {
    if (!allPaid) return
    const paymentKey = payment?.id ?? activeInvoice?.id ?? 'current'
    if (notifiedPaymentRef.current === paymentKey) return
    notifiedPaymentRef.current = paymentKey
    toast.success(isVietnamese ? 'Thanh toán thành công' : 'Payment successful', {
      id: `payment-completed-${paymentKey}`,
      description: isVietnamese
        ? 'Hệ thống đã nhận giao dịch của bạn.'
        : 'Your payment has been received.',
    })
  }, [activeInvoice?.id, allPaid, isVietnamese, payment?.id])

  const copyPaymentCode = async () => {
    if (!payment?.payment_number) return
    try {
      await navigator.clipboard.writeText(payment.payment_number)
      toast.success(isVietnamese ? 'Đã sao chép nội dung chuyển khoản' : 'Payment reference copied')
    } catch {
      toast.error(
        isVietnamese ? 'Không thể sao chép. Hãy giữ để chọn mã.' : 'Could not copy the reference',
      )
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--surface-grouped)]">
      <header className="border-b border-[var(--separator)] bg-[var(--material-thin)] px-4 pb-4 pt-5 text-center backdrop-blur-2xl">
        <p className="text-xs font-medium text-[var(--text-tertiary)]">
          {isVietnamese ? 'Thanh toán tại bàn' : 'Pay at table'} {state.session?.table}
        </p>
        <h1 className="mt-1 text-xl font-bold text-[var(--text)]">
          {payment?.status === 'PROCESSING'
            ? isVietnamese
              ? 'Quét mã để thanh toán'
              : 'Scan to pay'
            : isVietnamese
              ? 'Đang chuẩn bị thanh toán'
              : 'Preparing payment'}
        </h1>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-6">
        {isLoading ? (
          <WaitingState
            title={isVietnamese ? 'Đang tải thông tin thanh toán' : 'Loading payment details'}
            description={
              isVietnamese
                ? 'Mã thanh toán sẽ xuất hiện tại đây.'
                : 'The payment QR will appear here.'
            }
          />
        ) : isError ? (
          <Card className="border border-[var(--separator)] bg-[var(--material-regular)] p-6 text-center">
            <RefreshCw className="mx-auto size-8 text-[var(--text-secondary)]" />
            <h2 className="mt-4 text-base font-bold text-[var(--text)]">
              {isVietnamese ? 'Chưa tải được mã thanh toán' : 'Could not load the payment QR'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
              {isVietnamese
                ? 'Kiểm tra kết nối rồi thử lại. Phiên thanh toán của bạn vẫn được giữ.'
                : 'Check your connection and try again. Your checkout session is still active.'}
            </p>
            <Button className="mt-5 h-12 w-full" onClick={() => void refetch()}>
              {isFetching ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {isVietnamese ? 'Tải lại mã' : 'Reload QR'}
            </Button>
          </Card>
        ) : allPaid ? (
          <Card className="border border-[var(--separator)] bg-[var(--material-regular)] p-6 text-center">
            <CheckCircle2 className="mx-auto size-10 text-[var(--system-green)]" />
            <h2 className="mt-4 text-lg font-bold text-[var(--text)]">
              {isVietnamese ? 'Đã nhận thanh toán' : 'Payment received'}
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              {state.wantsDigitalInvoice
                ? isVietnamese
                  ? 'Đang mở hóa đơn của bạn…'
                  : 'Opening your receipt…'
                : isVietnamese
                  ? 'Cảm ơn bạn. Giao dịch đã hoàn tất.'
                  : 'Thank you. Your payment is complete.'}
            </p>
            {!state.wantsDigitalInvoice ? (
              <Button
                className="mt-5 h-12 w-full"
                onClick={() => {
                  clearSession()
                  setGuestRealtimeToken('')
                  dispatch({ type: 'END_SESSION' })
                }}
              >
                {isVietnamese ? 'Hoàn tất' : 'Finish'}
              </Button>
            ) : null}
          </Card>
        ) : payment?.status === 'PROCESSING' && payment.qr_code_url ? (
          <Card className="border border-[var(--separator)] bg-[var(--material-regular)] p-5 text-center">
            {!qrFailed ? (
              <img
                src={payment.qr_code_url}
                alt={isVietnamese ? 'Mã QR thanh toán SePay' : 'SePay payment QR code'}
                referrerPolicy="no-referrer"
                className="mx-auto aspect-square w-full max-w-[280px] bg-white object-contain"
                onError={() => setFailedQRURL(payment.qr_code_url ?? null)}
              />
            ) : (
              <div className="mx-auto flex aspect-square w-full max-w-[280px] flex-col items-center justify-center bg-white p-6 text-zinc-700">
                <QrCode className="size-10" />
                <p className="mt-3 text-sm font-medium">
                  {isVietnamese ? 'Không tải được ảnh QR' : 'QR image unavailable'}
                </p>
              </div>
            )}

            <p className="mt-5 text-3xl font-bold tabular-nums text-[var(--text)]">
              {formatVND(payment.amount_vnd)}
            </p>
            <p className="mt-2 text-xs text-[var(--text-tertiary)]">
              {isVietnamese ? 'Nội dung chuyển khoản' : 'Payment reference'}
            </p>
            <button
              type="button"
              onClick={() => void copyPaymentCode()}
              className="mx-auto mt-2 flex min-h-11 max-w-full items-center gap-2 rounded-[var(--radius-lg)] bg-[var(--surface-grouped)] px-4 font-mono text-sm font-semibold text-[var(--text)]"
            >
              <span className="break-all">{payment.payment_number}</span>
              <Copy className="size-4 shrink-0 text-[var(--text-secondary)]" />
            </button>

            {qrFailed ? (
              <a
                href={payment.qr_code_url}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex min-h-11 items-center justify-center text-sm font-semibold text-[var(--system-blue)] underline"
              >
                {isVietnamese ? 'Mở QR trong tab mới' : 'Open QR in a new tab'}
              </a>
            ) : null}
            <p className="mt-5 text-sm leading-6 text-[var(--text-secondary)]">
              {isVietnamese
                ? 'Mã này cũng đang hiển thị tại quầy thu ngân và sẽ tự cập nhật khi giao dịch hoàn tất.'
                : 'This QR is also visible at the cashier and will update automatically after payment.'}
            </p>
          </Card>
        ) : payment?.status === 'FAILED' ? (
          <WaitingState
            title={isVietnamese ? 'Giao dịch chưa thành công' : 'Payment was not completed'}
            description={
              isVietnamese
                ? 'Vui lòng chờ thu ngân tạo lại mã thanh toán.'
                : 'Please wait while the cashier creates a new payment QR.'
            }
          />
        ) : (
          <WaitingState
            title={isVietnamese ? 'Thu ngân đang chuẩn bị mã' : 'The cashier is preparing your QR'}
            description={
              isVietnamese
                ? 'Bạn có thể giữ nguyên màn hình này. QR sẽ tự xuất hiện.'
                : 'Keep this screen open. The QR will appear automatically.'
            }
          />
        )}
      </main>

      <footer className="border-t border-[var(--separator)] bg-[var(--material-thin)] px-4 py-4 text-center text-xs text-[var(--text-tertiary)]">
        {isVietnamese
          ? 'Không đóng trang trong lúc chờ thanh toán.'
          : 'Keep this page open during checkout.'}
      </footer>
    </div>
  )
}

function WaitingState({ title, description }: { title: string; description: string }) {
  return (
    <Card
      className="border border-[var(--separator)] bg-[var(--material-regular)] p-6 text-center"
      aria-live="polite"
    >
      <Loader2 className="mx-auto size-9 animate-spin text-[var(--system-blue)]" />
      <h2 className="mt-4 text-base font-bold text-[var(--text)]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{description}</p>
    </Card>
  )
}
