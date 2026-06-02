import { useEffect, useMemo, useState, type FC } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { fmtDateTime, fmtHMS, fmtVND, makeTxnId, providerName } from '@/features/cashier/helpers'
import type { CashierAction } from '@/features/cashier/hooks/use-cashier'
import type { CashierSession, Lang, PaymentMethod, Provider } from '@/features/cashier/types'

interface PaymentPanelProps {
  session: CashierSession | null
  now: Date
  lang: Lang
  t: (key: string, ...args: Array<number | string>) => string
  dispatch: React.Dispatch<CashierAction>
  onReceipt: (sessionId: string) => void
}

interface CardForm {
  txn: string
  last4: string
  bank: string
}

const providers: Provider[] = [
  { id: 'momo', name: 'Momo', accent: 'border-pink-300 bg-pink-500/10 text-pink-700', dot: 'bg-pink-500' },
  { id: 'zalopay', name: 'ZaloPay', accent: 'border-sky-300 bg-sky-500/10 text-sky-700', dot: 'bg-sky-500' },
  { id: 'vnpay', name: 'VNPay', accent: 'border-red-300 bg-red-500/10 text-red-700', dot: 'bg-red-500' },
]

export const PaymentPanel: FC<PaymentPanelProps> = ({ session, now, lang, t, dispatch, onReceipt }) => {
  const [modeState, setModeState] = useState<{ sessionId: string | null; mode: PaymentMethod | 'select' }>({
    sessionId: null,
    mode: 'select',
  })

  if (!session) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center">
        <div>
          <div className="mx-auto flex size-16 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--surface-grouped)] text-3xl">◇</div>
          <p className="mt-4 font-semibold text-[var(--text)]">{t('select_session_empty')}</p>
          <p className="mt-1 text-sm text-[var(--text-tertiary)]">{t('select_session_hint')}</p>
        </div>
      </div>
    )
  }

  const payment = session.payment
  const mode = modeState.sessionId === session.id ? modeState.mode : 'select'
  const setMode = (nextMode: PaymentMethod | 'select') => setModeState({ sessionId: session.id, mode: nextMode })
  const paid = session.status === 'paid' && payment?.status === 'completed'
  const pending = payment?.status === 'pending'
  const failed = payment?.status === 'failed'

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-[var(--separator)] p-5 pb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--text)]">{t('payment')}</h2>
          <Badge className="rounded-full border-0 bg-[var(--surface-grouped)] text-[var(--text-secondary)]">{t(`status_${session.status}`)}</Badge>
        </div>
        <p className="mt-1 text-sm text-[var(--text-tertiary)]">
          {t('table')} {session.table_number} · {lang === 'vi' ? session.area_name_vi : session.area_name_en}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {paid && payment ? (
          <PaidView session={session} payment={payment} t={t} dispatch={dispatch} onReceipt={onReceipt} />
        ) : pending && payment ? (
          <EWalletPending session={session} now={now} t={t} dispatch={dispatch} />
        ) : failed ? (
          <FailedView t={t} onRetry={() => setMode('ewallet')} onChangeMethod={() => setMode('select')} />
        ) : mode === 'cash' ? (
          <CashPayment session={session} t={t} dispatch={dispatch} onBack={() => setMode('select')} />
        ) : mode === 'card' ? (
          <CardPayment session={session} t={t} dispatch={dispatch} onBack={() => setMode('select')} />
        ) : mode === 'ewallet' ? (
          <EWalletPayment session={session} t={t} dispatch={dispatch} onBack={() => setMode('select')} />
        ) : (
          <MethodSelect session={session} t={t} onSelect={setMode} />
        )}
      </div>
    </div>
  )
}

function MethodSelect({
  session,
  t,
  onSelect,
}: {
  session: CashierSession
  t: (key: string, ...args: Array<number | string>) => string
  onSelect: (method: PaymentMethod) => void
}) {
  return (
    <div className="space-y-4">
      <TotalCard label={t('cash_total')} amount={session.invoice.total} />
      {(['cash', 'card', 'ewallet'] as PaymentMethod[]).map((method) => (
        <Button
          key={method}
          variant="secondary"
          className="h-auto w-full justify-start rounded-[var(--radius-xl)] border border-[var(--separator)] bg-[var(--material-regular)] p-4 text-left shadow-sm backdrop-blur-2xl"
          onClick={() => onSelect(method)}
        >
          <span className="flex size-11 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--surface-grouped)] text-lg">
            {method === 'cash' ? '₫' : method === 'card' ? '▰' : '▣'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold text-[var(--text)]">{t(`method_${method}`)}</span>
            <span className="block text-xs font-normal text-[var(--text-tertiary)]">{t(`method_${method}_hint`)}</span>
          </span>
          <span>›</span>
        </Button>
      ))}
    </div>
  )
}

function CashPayment({
  session,
  t,
  dispatch,
  onBack,
}: {
  session: CashierSession
  t: (key: string, ...args: Array<number | string>) => string
  dispatch: React.Dispatch<CashierAction>
  onBack: () => void
}) {
  const total = session.invoice.total
  const [tendered, setTendered] = useState(total)
  const change = tendered - total
  const suggestions = useMemo(() => {
    const denominations = [50000, 100000, 200000, 500000]
    return Array.from(new Set(denominations.map((value) => Math.ceil(total / value) * value))).filter((value) => value >= total)
  }, [total])

  return (
    <div className="space-y-4">
      <BackButton t={t} onBack={onBack} />
      <TotalCard label={t('cash_total')} amount={total} />
      <label className="block text-sm font-semibold text-[var(--text)]" htmlFor="cash-tendered">{t('cash_tendered')}</label>
      <Input
        id="cash-tendered"
        value={tendered.toString()}
        inputMode="numeric"
        className="h-12 rounded-[var(--radius-lg)] text-lg tabular-nums"
        onChange={(event) => setTendered(Number.parseInt(event.target.value.replace(/\D/g, ''), 10) || 0)}
      />
      <div className="grid grid-cols-2 gap-2">
        {suggestions.map((value) => (
          <Button key={value} variant="secondary" onClick={() => setTendered(value)}>{fmtVND(value)}</Button>
        ))}
      </div>
      <Card className="border border-[var(--separator)] bg-[var(--material-regular)] p-4">
        <div className="flex justify-between">
          <span className="text-[var(--text-secondary)]">{change < 0 ? t('cash_short') : t('cash_change')}</span>
          <span className={`font-bold tabular-nums ${change < 0 ? 'text-[var(--system-red)]' : 'text-[var(--system-green)]'}`}>
            {fmtVND(Math.abs(change))}
          </span>
        </div>
      </Card>
      <Button
        className="w-full rounded-[var(--radius-lg)]"
        size="lg"
        disabled={change < 0}
        onClick={() => {
          dispatch({
            type: 'completePayment',
            sessionId: session.id,
            method: 'cash',
            subMethod: 'cash',
            amountTendered: tendered,
            change: Math.max(0, change),
          })
        }}
      >
        {t('cash_confirm')}
      </Button>
    </div>
  )
}

function CardPayment({
  session,
  t,
  dispatch,
  onBack,
}: {
  session: CashierSession
  t: (key: string, ...args: Array<number | string>) => string
  dispatch: React.Dispatch<CashierAction>
  onBack: () => void
}) {
  const [form, setForm] = useState<CardForm>({ txn: `POS-${makeTxnId()}`, last4: '', bank: '' })
  const valid = form.txn.trim().length > 0 && /^\d{4}$/.test(form.last4)

  const setField = (key: keyof CardForm, value: string) => setForm((current) => ({ ...current, [key]: value }))

  return (
    <div className="space-y-4">
      <BackButton t={t} onBack={onBack} />
      <TotalCard label={t('card_total')} amount={session.invoice.total} />
      <Input value={form.txn} onChange={(event) => setField('txn', event.target.value)} placeholder={t('card_txn')} />
      <Input
        value={form.last4}
        inputMode="numeric"
        maxLength={4}
        onChange={(event) => setField('last4', event.target.value.replace(/\D/g, '').slice(0, 4))}
        placeholder={t('card_last4')}
      />
      <Input value={form.bank} onChange={(event) => setField('bank', event.target.value)} placeholder={t('card_bank')} />
      <p className="text-xs text-[var(--text-tertiary)]">{t('card_hint')}</p>
      <Button
        className="w-full rounded-[var(--radius-lg)]"
        size="lg"
        disabled={!valid}
        onClick={() => {
          dispatch({
            type: 'completePayment',
            sessionId: session.id,
            method: 'card',
            subMethod: 'card',
            transactionId: form.txn,
            last4: form.last4,
            bank: form.bank || null,
          })
        }}
      >
        {t('card_confirm')}
      </Button>
    </div>
  )
}

function EWalletPayment({
  session,
  t,
  dispatch,
  onBack,
}: {
  session: CashierSession
  t: (key: string, ...args: Array<number | string>) => string
  dispatch: React.Dispatch<CashierAction>
  onBack: () => void
}) {
  return (
    <div className="space-y-4">
      <BackButton t={t} onBack={onBack} />
      <TotalCard label={t('cash_total')} amount={session.invoice.total} />
      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">{t('ewallet_provider_pick')}</div>
      {providers.map((provider) => (
        <Button
          key={provider.id}
          variant="secondary"
          className={`h-auto w-full justify-start rounded-[var(--radius-xl)] border p-4 ${provider.accent}`}
          onClick={() => {
            dispatch({
              type: 'startPayment',
              sessionId: session.id,
              method: 'ewallet',
              subMethod: provider.id,
            })
          }}
        >
          <span className={`size-3 rounded-full ${provider.dot}`} />
          <span className="font-bold">{provider.name}</span>
          <span className="ml-auto">›</span>
        </Button>
      ))}
    </div>
  )
}

function EWalletPending({
  session,
  now,
  t,
  dispatch,
}: {
  session: CashierSession
  now: Date
  t: (key: string, ...args: Array<number | string>) => string
  dispatch: React.Dispatch<CashierAction>
}) {
  const payment = session.payment
  const provider = providers.find((item) => item.id === payment?.sub_method)

  useEffect(() => {
    if (!payment || payment.status !== 'pending') return undefined
    const id = window.setTimeout(() => {
      dispatch({ type: 'completePayment', sessionId: session.id })
    }, 6000)
    return () => window.clearTimeout(id)
  }, [dispatch, payment, session.id])

  if (!payment) return null
  const elapsed = Math.max(0, Math.floor((now.getTime() - payment.initiated_at.getTime()) / 1000))

  return (
    <div className="space-y-4">
      <Card className={`border-2 p-4 text-center ${provider?.accent ?? 'border-[var(--separator)]'}`}>
        <div className="text-xs font-bold uppercase tracking-wider">{providerName(payment.sub_method)}</div>
        <div className="mt-1 text-sm font-semibold">{t('ewallet_qr_title')}</div>
        <div className="mx-auto mt-4 grid size-44 grid-cols-8 gap-0.5 rounded-[var(--radius-lg)] bg-white p-3 shadow-sm">
          {Array.from({ length: 64 }, (_, index) => (
            <span key={index} className={(index + payment.transaction_id.length) % 4 === 0 ? 'bg-zinc-950' : 'bg-white'} />
          ))}
        </div>
        <div className="mt-4 text-3xl font-bold tabular-nums text-[var(--text)]">{fmtVND(session.invoice.total)}</div>
        <div className="mt-1 text-xs font-mono text-[var(--text-tertiary)]">{payment.transaction_id}</div>
      </Card>
      <Card className="border border-[var(--system-orange)]/30 bg-[var(--system-orange)]/10 p-4">
        <div className="font-bold text-[var(--system-orange)]">{t('ewallet_awaiting')}</div>
        <div className="text-xs font-mono tabular-nums text-[var(--text-tertiary)]">{fmtHMS(elapsed)}</div>
      </Card>
      <p className="text-xs leading-relaxed text-[var(--text-tertiary)]">{t('ewallet_pending_hint')}</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" onClick={() => dispatch({ type: 'failPayment', sessionId: session.id })}>{t('ewallet_cancel')}</Button>
        <Button variant="destructive" onClick={() => dispatch({ type: 'failPayment', sessionId: session.id })}>{t('retry')}</Button>
      </div>
    </div>
  )
}

function PaidView({
  session,
  payment,
  t,
  dispatch,
  onReceipt,
}: {
  session: CashierSession
  payment: NonNullable<CashierSession['payment']>
  t: (key: string, ...args: Array<number | string>) => string
  dispatch: React.Dispatch<CashierAction>
  onReceipt: (sessionId: string) => void
}) {
  return (
    <div className="space-y-4">
      <div className="py-3 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[var(--system-green)]/10 text-3xl text-[var(--system-green)]">✓</div>
        <div className="mt-3 font-bold text-[var(--text)]">{t('paid_title')}</div>
      </div>
      <Card className="border border-[var(--separator)] bg-[var(--material-regular)]">
        <CardContent className="space-y-3 p-4">
          <PaidRow label={t('paid_amount')} value={fmtVND(session.invoice.total)} />
          <PaidRow label={t('paid_method')} value={payment.method === 'ewallet' ? `${t('method_ewallet')} · ${providerName(payment.sub_method)}` : t(`method_${payment.method}`)} />
          <PaidRow label={t('paid_txn')} value={payment.transaction_id} />
          <PaidRow label={t('paid_time')} value={payment.completed_at ? fmtDateTime(payment.completed_at) : '—'} />
          {payment.method === 'cash' && payment.amount_tendered !== null ? <PaidRow label={t('cash_tendered')} value={fmtVND(payment.amount_tendered)} /> : null}
          {payment.method === 'cash' && payment.change !== null ? <PaidRow label={t('cash_change')} value={fmtVND(payment.change)} /> : null}
        </CardContent>
      </Card>
      <Separator />
      <Button className="w-full rounded-[var(--radius-lg)]" size="lg" onClick={() => onReceipt(session.id)}>{t('print_receipt')}</Button>
      <Button variant="secondary" className="w-full rounded-[var(--radius-lg)]" onClick={() => dispatch({ type: 'closeSession', sessionId: session.id })}>{t('close_session')}</Button>
      <Button variant="ghost" className="w-full rounded-[var(--radius-lg)]" disabled>{t('send_email_sms')}</Button>
    </div>
  )
}

function FailedView({
  t,
  onRetry,
  onChangeMethod,
}: {
  t: (key: string, ...args: Array<number | string>) => string
  onRetry: () => void
  onChangeMethod: () => void
}) {
  return (
    <div className="space-y-4 py-4 text-center">
      <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-[var(--system-red)]/10 text-3xl text-[var(--system-red)]">×</div>
      <div className="font-bold text-[var(--text)]">{t('failed_title')}</div>
      <p className="text-sm text-[var(--text-tertiary)]">{t('failed_reason_default')}</p>
      <Button className="w-full rounded-[var(--radius-lg)]" onClick={onRetry}>{t('retry')}</Button>
      <Button variant="secondary" className="w-full rounded-[var(--radius-lg)]" onClick={onChangeMethod}>{t('change_method')}</Button>
    </div>
  )
}

function TotalCard({ label, amount }: { label: string; amount: number }) {
  return (
    <Card className="border border-[var(--separator)] bg-[var(--material-regular)] p-4 shadow-sm backdrop-blur-2xl">
      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">{label}</div>
      <div className="mt-1 text-3xl font-bold tabular-nums text-[var(--system-orange)]">{fmtVND(amount)}</div>
    </Card>
  )
}

function BackButton({ t, onBack }: { t: (key: string, ...args: Array<number | string>) => string; onBack: () => void }) {
  return <Button variant="ghost" className="px-0" onClick={onBack}>← {t('back')}</Button>
}

function PaidRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className="text-right font-semibold tabular-nums text-[var(--text)]">{value}</span>
    </div>
  )
}

export default PaymentPanel
