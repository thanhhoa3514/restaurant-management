/* Hallmark · component: payment panel · genre: modern-minimal · theme: semantic-shadcn
 * pre-emit critique: P4 H4 E4 S5 R5 V4
 */
import { ReceiptText } from 'lucide-react'
import { useState, type FC } from 'react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  CashPayment,
  CardPayment,
  EWalletPayment,
  MethodSelect,
} from '@/features/cashier/components/payment/payment-method-views'
import {
  FailedView,
  EWalletPending,
  PaidView,
} from '@/features/cashier/components/payment/payment-status-views'
import { PartialPaymentView } from '@/features/cashier/components/payment/partial-payment-view'
import { STATUS_VARIANT } from '@/features/cashier/components/panel-styles'
import { activeInvoice, makeTxnId } from '@/features/cashier/helpers'
import type { CashierAction } from '@/features/cashier/hooks/use-cashier'
import type { CashierSession, Lang, PaymentMethod } from '@/features/cashier/types'

interface PaymentPanelProps {
  session: CashierSession | null
  now: Date
  lang: Lang
  t: (key: string, ...args: Array<number | string>) => string
  dispatch: React.Dispatch<CashierAction>
  onReceipt: (sessionId: string) => void
}

export const PaymentPanel: FC<PaymentPanelProps> = ({
  session,
  now,
  lang,
  t,
  dispatch,
  onReceipt,
}) => {
  const [modeState, setModeState] = useState<{
    sessionId: string | null
    mode: PaymentMethod | 'select'
  }>({
    sessionId: null,
    mode: 'select',
  })
  const [dismissedFailureKey, setDismissedFailureKey] = useState<string | null>(null)

  if (!session) {
    return <EmptyPaymentPanel t={t} />
  }

  const invoice = activeInvoice(session)
  const payment = invoice.payment
  const mode = modeState.sessionId === session.id ? modeState.mode : 'select'
  const setMode = (nextMode: PaymentMethod | 'select') =>
    setModeState({ sessionId: session.id, mode: nextMode })

  const paid = invoice.status === 'PAID' && payment?.status === 'completed'
  const partiallyPaid = invoice.status === 'PARTIALLY_PAID'
  const pending = payment?.status === 'pending' || payment?.status === 'processing'
  const failureKey = payment?.id ?? payment?.transaction_id ?? null
  const showFailed = payment?.status === 'failed' && failureKey !== dismissedFailureKey
  const split = session.invoices.length > 1
  const paidInvoices = session.invoices.filter((item) => item.status === 'PAID').length
  const remaining = invoice.remaining ?? invoice.total

  const retryPayment = () => {
    const subMethod = payment?.sub_method ?? 'sepay'
    const transactionId = makeTxnId()
    dispatch({
      type: 'startPayment',
      sessionId: session.id,
      method: 'ewallet',
      subMethod,
      transactionId,
    })
    dispatch({
      type: 'completePayment',
      sessionId: session.id,
      method: 'ewallet',
      subMethod,
      transactionId,
      amountTendered: null,
    })
  }

  return (
    <section
      className="flex h-full min-w-0 flex-col overflow-hidden"
      aria-labelledby="payment-title"
    >
      <PaymentPanelHeader
        session={session}
        lang={lang}
        t={t}
        splitSummary={
          split ? t('split_paid_count', paidInvoices, session.invoices.length) : undefined
        }
        invoiceNumber={split ? invoice.number : undefined}
      />

      <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-5">
        {paid && payment ? (
          <PaidView
            session={session}
            invoice={invoice}
            payment={payment}
            t={t}
            onReceipt={onReceipt}
          />
        ) : partiallyPaid ? (
          <PartialPaymentView
            session={session}
            invoice={invoice}
            remaining={remaining}
            mode={mode}
            t={t}
            dispatch={dispatch}
            onSelect={setMode}
            onBack={() => setMode('select')}
          />
        ) : pending && payment ? (
          <EWalletPending session={session} invoice={invoice} now={now} t={t} dispatch={dispatch} />
        ) : showFailed ? (
          <FailedView
            t={t}
            onRetry={retryPayment}
            onChangeMethod={() => {
              setDismissedFailureKey(failureKey)
              setMode('select')
            }}
          />
        ) : mode === 'cash' ? (
          <CashPayment
            session={session}
            invoice={invoice}
            t={t}
            dispatch={dispatch}
            onBack={() => setMode('select')}
          />
        ) : mode === 'card' ? (
          <CardPayment
            session={session}
            invoice={invoice}
            t={t}
            dispatch={dispatch}
            onBack={() => setMode('select')}
          />
        ) : mode === 'ewallet' ? (
          <EWalletPayment
            session={session}
            invoice={invoice}
            t={t}
            dispatch={dispatch}
            onBack={() => setMode('select')}
          />
        ) : (
          <MethodSelect invoice={invoice} t={t} onSelect={setMode} />
        )}
      </div>
    </section>
  )
}

function PaymentPanelHeader({
  session,
  lang,
  t,
  splitSummary,
  invoiceNumber,
}: {
  session: CashierSession
  lang: Lang
  t: PaymentPanelProps['t']
  splitSummary?: string
  invoiceNumber?: string
}) {
  return (
    <header className="border-b border-border px-4 py-3 sm:px-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id="payment-title" className="min-w-0 text-lg font-semibold text-foreground">
          {t('payment')}
        </h2>
        <Badge variant={STATUS_VARIANT[session.status]}>{t(`status_${session.status}`)}</Badge>
      </div>
      <p className="mt-1 truncate text-sm text-muted-foreground">
        {t('table')} {session.table_label} ·{' '}
        {lang === 'vi' ? session.area_name_vi : session.area_name_en}
      </p>
      {splitSummary ? (
        <p className="mt-1 truncate text-xs font-medium text-amber-700 dark:text-amber-400">
          {splitSummary} · {invoiceNumber}
        </p>
      ) : null}
    </header>
  )
}

function EmptyPaymentPanel({ t }: { t: PaymentPanelProps['t'] }) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center">
      <Card size="sm" className="max-w-sm border-dashed bg-muted/30">
        <CardContent className="space-y-3">
          <ReceiptText className="mx-auto size-7 text-muted-foreground" />
          <div>
            <p className="font-medium text-foreground">{t('select_session_empty')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t('select_session_hint')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
