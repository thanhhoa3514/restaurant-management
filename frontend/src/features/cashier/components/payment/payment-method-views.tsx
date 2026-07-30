import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import {
  METHOD_ICON,
  PAYMENT_INPUT,
  PAYMENT_METHOD_ROW,
  PAYMENT_PRIMARY_BUTTON,
  paymentProviders,
} from '@/features/cashier/components/payment/payment-config'
import {
  BackButton,
  PaymentField,
  type PaymentT,
  TotalCard,
} from '@/features/cashier/components/payment/payment-shared'
import { fmtVND, makeTxnId } from '@/features/cashier/helpers'
import type { CashierAction } from '@/features/cashier/hooks/use-cashier'
import type { CashierSession, Invoice, PaymentMethod } from '@/features/cashier/types'
import { cn } from '@/lib/utils'
import { ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'

interface PaymentViewProps {
  session: CashierSession
  invoice: Invoice
  t: PaymentT
  dispatch: React.Dispatch<CashierAction>
  onBack: () => void
}

interface CardForm {
  txn: string
  last4: string
  bank: string
}

export function MethodSelect({
  invoice,
  t,
  onSelect,
}: {
  invoice: Invoice
  t: PaymentT
  onSelect: (method: PaymentMethod) => void
}) {
  return (
    <div className="space-y-4">
      <TotalCard label={t('cash_total')} amount={invoice.total} />
      <div className="space-y-2" aria-label={t('payment')}>
        {(['cash', 'card', 'ewallet'] as PaymentMethod[]).map((method) => {
          const Icon = METHOD_ICON[method]
          return (
            <Button
              key={method}
              variant="ghost"
              className={PAYMENT_METHOD_ROW}
              onClick={() => onSelect(method)}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-foreground">{t(`method_${method}`)}</span>
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {t(`method_${method}_hint`)}
                </span>
              </span>
              <ChevronRight className="text-muted-foreground" />
            </Button>
          )
        })}
      </div>
    </div>
  )
}

export function CashPayment({ session, invoice, t, dispatch, onBack }: PaymentViewProps) {
  const total = invoice.total
  const [tendered, setTendered] = useState(total)
  const change = tendered - total
  const suggestions = useMemo(() => {
    const denominations = [50000, 100000, 200000, 500000]
    return Array.from(
      new Set(denominations.map((value) => Math.ceil(total / value) * value)),
    ).filter((value) => value >= total)
  }, [total])

  return (
    <div className="space-y-4">
      <BackButton t={t} onBack={onBack} />
      <TotalCard label={t('cash_total')} amount={total} />

      <PaymentField id="cash-tendered" label={t('cash_tendered')}>
        <InputGroup className="h-11 bg-background">
          <InputGroupInput
            id="cash-tendered"
            value={tendered.toString()}
            inputMode="numeric"
            className="h-11 text-lg tabular-nums"
            onChange={(event) =>
              setTendered(Number.parseInt(event.target.value.replace(/\D/g, ''), 10) || 0)
            }
          />
          <InputGroupAddon align="inline-end">₫</InputGroupAddon>
        </InputGroup>
      </PaymentField>

      <div className="grid grid-cols-2 gap-2">
        {suggestions.map((value) => (
          <Button
            key={value}
            variant="secondary"
            className="bg-secondary text-secondary-foreground transition-colors hover:bg-secondary/80"
            onClick={() => setTendered(value)}
          >
            {fmtVND(value)}
          </Button>
        ))}
      </div>

      <Card
        size="sm"
        className={cn(
          change < 0
            ? 'border-destructive/30 bg-destructive/5'
            : 'border-emerald-500/30 bg-emerald-500/5',
        )}
      >
        <CardContent className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">
            {change < 0 ? t('cash_short') : t('cash_change')}
          </span>
          <span
            className={cn(
              'font-semibold tabular-nums',
              change < 0 ? 'text-destructive' : 'text-emerald-700 dark:text-emerald-400',
            )}
          >
            {fmtVND(Math.abs(change))}
          </span>
        </CardContent>
      </Card>

      <Button
        className={cn(PAYMENT_PRIMARY_BUTTON, 'w-full')}
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

export function CardPayment({ session, invoice, t, dispatch, onBack }: PaymentViewProps) {
  const [form, setForm] = useState<CardForm>({
    txn: `POS-${makeTxnId()}`,
    last4: '',
    bank: '',
  })
  const valid = form.txn.trim().length > 0 && /^\d{4}$/.test(form.last4)
  const setField = (key: keyof CardForm, value: string) =>
    setForm((current) => ({ ...current, [key]: value }))

  return (
    <div className="space-y-4">
      <BackButton t={t} onBack={onBack} />
      <TotalCard label={t('card_total')} amount={invoice.total} />

      <PaymentField id="card-transaction" label={t('card_txn')}>
        <Input
          id="card-transaction"
          className={PAYMENT_INPUT}
          value={form.txn}
          onChange={(event) => setField('txn', event.target.value)}
        />
      </PaymentField>
      <PaymentField id="card-last-four" label={t('card_last4')}>
        <Input
          id="card-last-four"
          className={PAYMENT_INPUT}
          value={form.last4}
          inputMode="numeric"
          maxLength={4}
          aria-invalid={form.last4.length > 0 && !/^\d{4}$/.test(form.last4)}
          onChange={(event) => setField('last4', event.target.value.replace(/\D/g, '').slice(0, 4))}
        />
      </PaymentField>
      <PaymentField id="card-bank" label={t('card_bank')} hint={t('card_hint')}>
        <Input
          id="card-bank"
          className={PAYMENT_INPUT}
          value={form.bank}
          aria-describedby="card-bank-description"
          onChange={(event) => setField('bank', event.target.value)}
        />
      </PaymentField>

      <Button
        className={cn(PAYMENT_PRIMARY_BUTTON, 'w-full')}
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

export function EWalletPayment({ session, invoice, t, dispatch, onBack }: PaymentViewProps) {
  return (
    <div className="space-y-4">
      <BackButton t={t} onBack={onBack} />
      <TotalCard label={t('cash_total')} amount={invoice.total} />
      <p className="text-sm font-medium text-foreground">{t('ewallet_provider_pick')}</p>

      <div className="space-y-2">
        {paymentProviders.map((provider) => (
          <Button
            key={provider.id}
            variant="ghost"
            className={PAYMENT_METHOD_ROW}
            onClick={() => {
              const transactionId = makeTxnId()
              dispatch({
                type: 'startPayment',
                sessionId: session.id,
                method: 'ewallet',
                subMethod: provider.id,
                transactionId,
              })
              dispatch({
                type: 'completePayment',
                sessionId: session.id,
                method: 'ewallet',
                subMethod: provider.id,
                transactionId,
                amountTendered: null,
              })
            }}
          >
            <span className={cn('size-2.5 shrink-0 rounded-full', provider.dot)} />
            <span className="font-semibold text-foreground">{provider.name}</span>
            {provider.id === 'mock' ? (
              <Badge variant="outline" className="ml-1">
                DEV
              </Badge>
            ) : null}
            <ChevronRight className="ml-auto text-muted-foreground" />
          </Button>
        ))}
      </div>
    </div>
  )
}
