import { CheckCircle2, ExternalLink, LoaderCircle, Mail, Printer, XCircle } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  PAYMENT_DESTRUCTIVE_BUTTON,
  PAYMENT_OUTLINE_BUTTON,
  PAYMENT_PRIMARY_BUTTON,
  PAYMENT_SECONDARY_BUTTON,
  paymentProviders,
} from '@/features/cashier/components/payment/payment-config'
import { PaidRow, type PaymentT } from '@/features/cashier/components/payment/payment-shared'
import { fmtDateTime, fmtHMS, fmtVND, providerName } from '@/features/cashier/helpers'
import type { CashierAction } from '@/features/cashier/hooks/use-cashier'
import { useMockCompletePayment } from '@/features/cashier/mutations/useMockCompletePayment'
import type { CashierSession, Invoice } from '@/features/cashier/types'
import { errorMessage } from '@/lib/api'
import { cn } from '@/lib/utils'

export function EWalletPending({
  session,
  invoice,
  now,
  t,
  dispatch,
}: {
  session: CashierSession
  invoice: Invoice
  now: Date
  t: PaymentT
  dispatch: React.Dispatch<CashierAction>
}) {
  const payment = invoice.payment
  const provider = paymentProviders.find((item) => item.id === payment?.sub_method)
  const mockPaymentMutation = useMockCompletePayment()

  if (!payment) return null

  const elapsed = Math.max(0, Math.floor((now.getTime() - payment.initiated_at.getTime()) / 1000))
  const checkoutURL = payment.deeplink || payment.pay_url || payment.qr_code_url

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2">
            <span className={cn('size-2.5 rounded-full', provider?.dot ?? 'bg-muted-foreground')} />
            <Badge variant="outline">{providerName(payment.sub_method)}</Badge>
          </div>
          <CardTitle>{t('ewallet_qr_title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {payment.qr_code_url ? (
            <img
              src={payment.qr_code_url}
              alt={t('ewallet_qr_title')}
              className="mx-auto size-52 rounded-xl border border-border bg-white object-contain p-2"
            />
          ) : (
            <div className="mx-auto flex size-52 items-center justify-center rounded-xl border border-border bg-white p-4 text-xs text-zinc-600">
              {t('ewallet_qr_unavailable')}
            </div>
          )}
          <div>
            <div className="text-3xl font-semibold tabular-nums text-foreground">
              {fmtVND(invoice.total)}
            </div>
            <div className="mt-1 break-all font-mono text-xs text-muted-foreground">
              {payment.transaction_id}
            </div>
          </div>
        </CardContent>
        {checkoutURL ? (
          <CardFooter className="justify-center">
            <Button asChild variant="outline" size="sm" className={PAYMENT_OUTLINE_BUTTON}>
              <a href={checkoutURL} target="_blank" rel="noreferrer">
                {t('ewallet_open_link')}
                <ExternalLink />
              </a>
            </Button>
          </CardFooter>
        ) : null}
      </Card>

      <Card size="sm" className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="flex items-center gap-3">
          <LoaderCircle className="size-5 animate-spin text-amber-700 motion-reduce:animate-none dark:text-amber-400" />
          <div className="min-w-0 flex-1">
            <div className="font-medium text-foreground">{t('ewallet_awaiting')}</div>
            <div className="font-mono text-xs tabular-nums text-muted-foreground">
              {fmtHMS(elapsed)}
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground">{t('ewallet_pending_hint')}</p>

      {payment.sub_method === 'mock' ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button
            className={PAYMENT_PRIMARY_BUTTON}
            disabled={mockPaymentMutation.isPending}
            onClick={() => {
              mockPaymentMutation.mutate(
                { paymentNumber: payment.transaction_id, result: 'success' },
                {
                  onSuccess: (response) =>
                    dispatch({
                      type: 'replaceInvoice',
                      sessionId: session.id,
                      invoice: response.invoice,
                    }),
                  onError: (error) =>
                    toast.error(errorMessage(error, t('toast_mock_payment_failed')), {
                      id: 'cashier-mock-payment-error',
                    }),
                },
              )
            }}
          >
            {mockPaymentMutation.isPending ? <LoaderCircle className="animate-spin" /> : null}
            {t('ewallet_simulate_paid')}
          </Button>
          <Button
            variant="destructive"
            className={PAYMENT_DESTRUCTIVE_BUTTON}
            disabled={mockPaymentMutation.isPending}
            onClick={() => {
              mockPaymentMutation.mutate(
                { paymentNumber: payment.transaction_id, result: 'failed' },
                {
                  onSuccess: (response) =>
                    dispatch({
                      type: 'replaceInvoice',
                      sessionId: session.id,
                      invoice: response.invoice,
                    }),
                  onError: (error) =>
                    toast.error(errorMessage(error, t('toast_mock_payment_failed')), {
                      id: 'cashier-mock-payment-error',
                    }),
                },
              )
            }}
          >
            {mockPaymentMutation.isPending ? <LoaderCircle className="animate-spin" /> : null}
            {t('ewallet_simulate_failed')}
          </Button>
        </div>
      ) : null}

      <Button
        variant="secondary"
        className={cn(PAYMENT_SECONDARY_BUTTON, 'w-full')}
        onClick={() => dispatch({ type: 'cancelPayment', sessionId: session.id })}
      >
        {t('ewallet_cancel')}
      </Button>
    </div>
  )
}

export function PaidView({
  session,
  invoice,
  payment,
  t,
  dispatch,
  onReceipt,
}: {
  session: CashierSession
  invoice: Invoice
  payment: NonNullable<Invoice['payment']>
  t: PaymentT
  dispatch: React.Dispatch<CashierAction>
  onReceipt: (sessionId: string) => void
}) {
  return (
    <div className="space-y-4">
      <PaymentStateHeader icon={CheckCircle2} title={t('paid_title')} tone="success" />

      <Card>
        <CardContent className="space-y-3">
          <PaidRow label={t('paid_amount')} value={fmtVND(invoice.total)} />
          <PaidRow
            label={t('paid_method')}
            value={
              payment.method === 'ewallet'
                ? `${t('method_ewallet')} · ${providerName(payment.sub_method)}`
                : t(`method_${payment.method}`)
            }
          />
          <PaidRow label={t('paid_txn')} value={payment.transaction_id} />
          <PaidRow
            label={t('paid_time')}
            value={payment.completed_at ? fmtDateTime(payment.completed_at) : '—'}
          />
          {payment.method === 'cash' && payment.amount_tendered !== null ? (
            <PaidRow label={t('cash_tendered')} value={fmtVND(payment.amount_tendered)} />
          ) : null}
          {payment.method === 'cash' && payment.change !== null ? (
            <PaidRow label={t('cash_change')} value={fmtVND(payment.change)} />
          ) : null}
        </CardContent>
      </Card>

      <Separator />

      <Button
        className={cn(PAYMENT_PRIMARY_BUTTON, 'w-full')}
        size="lg"
        onClick={() => onReceipt(session.id)}
      >
        <Printer />
        {t('print_receipt')}
      </Button>
      <Button
        variant="outline"
        className={cn(PAYMENT_OUTLINE_BUTTON, 'w-full')}
        onClick={() => dispatch({ type: 'closeSession', sessionId: session.id })}
      >
        {t('close_session')}
      </Button>
      <Button
        variant="ghost"
        className="w-full text-muted-foreground"
        disabled
        title={t('send_email_sms_soon')}
      >
        <Mail />
        {t('send_email_sms')}
      </Button>
    </div>
  )
}

export function FailedView({
  t,
  onRetry,
  onChangeMethod,
}: {
  t: PaymentT
  onRetry: () => void
  onChangeMethod: () => void
}) {
  return (
    <div className="space-y-4 py-4">
      <PaymentStateHeader
        icon={XCircle}
        title={t('failed_title')}
        description={t('failed_reason_default')}
        tone="error"
      />
      <Button className={cn(PAYMENT_PRIMARY_BUTTON, 'w-full')} size="lg" onClick={onRetry}>
        {t('retry')}
      </Button>
      <Button
        variant="outline"
        className={cn(PAYMENT_OUTLINE_BUTTON, 'w-full')}
        onClick={onChangeMethod}
      >
        {t('change_method')}
      </Button>
    </div>
  )
}

function PaymentStateHeader({
  icon: Icon,
  title,
  description,
  tone,
}: {
  icon: typeof CheckCircle2
  title: string
  description?: string
  tone: 'success' | 'error'
}) {
  return (
    <Card
      size="sm"
      className={cn(
        tone === 'success'
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : 'border-destructive/30 bg-destructive/5',
      )}
    >
      <CardHeader className="text-center">
        <Icon
          className={cn(
            'mx-auto size-8',
            tone === 'success' ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive',
          )}
        />
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
    </Card>
  )
}
