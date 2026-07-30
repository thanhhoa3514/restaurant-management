import { ChevronRight, Clock } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import {
  METHOD_ICON,
  PAYMENT_INPUT,
  PAYMENT_METHOD_ROW,
  PAYMENT_PRIMARY_BUTTON,
  PAYMENT_SECONDARY_BUTTON,
} from '@/features/cashier/components/payment/payment-config'
import {
  BackButton,
  PaymentField,
  type PaymentT,
} from '@/features/cashier/components/payment/payment-shared'
import { fmtVND, makeTxnId } from '@/features/cashier/helpers'
import type { CashierAction } from '@/features/cashier/hooks/use-cashier'
import type { CashierSession, Invoice, PaymentMethod } from '@/features/cashier/types'
import { cn } from '@/lib/utils'

export function PartialPaymentView({
  session,
  invoice,
  remaining,
  mode,
  t,
  dispatch,
  onSelect,
  onBack,
}: {
  session: CashierSession
  invoice: Invoice
  remaining: number
  mode: PaymentMethod | 'select'
  t: PaymentT
  dispatch: React.Dispatch<CashierAction>
  onSelect: (method: PaymentMethod) => void
  onBack: () => void
}) {
  return (
    <div className="space-y-4">
      <Card size="sm" className="border-amber-500/30 bg-amber-500/5">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Clock className="size-4 text-amber-700 dark:text-amber-400" />
              {t('partial_payment_title')}
            </CardTitle>
            <Badge variant="warning">{fmtVND(remaining)}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{t('partial_paid')}</span>
            <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
              {fmtVND(invoice.paid_amount)}
            </span>
          </div>
          {(invoice.payments ?? []).length > 0 ? (
            <div className="space-y-2 border-t border-border pt-3">
              {(invoice.payments ?? []).map((payment, index) => (
                <div
                  key={payment.id ?? `${payment.transaction_id}-${index}`}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="text-muted-foreground">
                    {payment.sub_method === 'cash'
                      ? t('method_cash')
                      : payment.sub_method === 'card'
                        ? t('method_card')
                        : t('method_ewallet')}
                  </span>
                  <span className="font-medium tabular-nums text-foreground">
                    {fmtVND(payment.amount_tendered ?? 0)}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {remaining > 0 ? (
        mode === 'cash' ? (
          <PartialCashPayment
            session={session}
            remaining={remaining}
            t={t}
            dispatch={dispatch}
            onBack={onBack}
          />
        ) : mode === 'card' ? (
          <PartialCardPayment
            session={session}
            remaining={remaining}
            t={t}
            dispatch={dispatch}
            onBack={onBack}
          />
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">{t('partial_add_method')}</p>
            {(['cash', 'card'] as PaymentMethod[]).map((method) => {
              const Icon = METHOD_ICON[method]
              return (
                <Button
                  key={method}
                  variant="ghost"
                  className={PAYMENT_METHOD_ROW}
                  onClick={() => onSelect(method)}
                >
                  <Icon className="text-muted-foreground" />
                  <span className="font-semibold text-foreground">{t(`method_${method}`)}</span>
                  <ChevronRight className="ml-auto text-muted-foreground" />
                </Button>
              )
            })}
            <p className="pt-2 text-xs text-muted-foreground">{t('partial_ewallet_hint')}</p>
          </div>
        )
      ) : null}
    </div>
  )
}

function PartialCashPayment({
  session,
  remaining,
  t,
  dispatch,
  onBack,
}: {
  session: CashierSession
  remaining: number
  t: PaymentT
  dispatch: React.Dispatch<CashierAction>
  onBack: () => void
}) {
  const [amount, setAmount] = useState(remaining)
  const change = Math.max(0, amount - remaining)
  const suggestions = useMemo(() => {
    const denominations = [50000, 100000, 200000, 500000]
    return Array.from(
      new Set(denominations.map((value) => Math.ceil(remaining / value) * value)),
    ).filter((value) => value >= remaining)
  }, [remaining])

  return (
    <div className="space-y-4">
      <BackButton t={t} onBack={onBack} />
      <PaymentField id="partial-cash-amount" label={t('partial_enter_amount')}>
        <InputGroup className="h-11 bg-background">
          <InputGroupInput
            id="partial-cash-amount"
            value={amount.toString()}
            inputMode="numeric"
            className="h-11 text-lg tabular-nums"
            onChange={(event) =>
              setAmount(Number.parseInt(event.target.value.replace(/\D/g, ''), 10) || 0)
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
            className={PAYMENT_SECONDARY_BUTTON}
            onClick={() => setAmount(value)}
          >
            {fmtVND(value)}
          </Button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{t('partial_remaining_after')}</span>
        <span className="font-semibold tabular-nums text-foreground">
          {fmtVND(Math.max(0, remaining - amount))}
        </span>
      </div>

      {change > 0 ? (
        <Card size="sm" className="border-emerald-500/30 bg-emerald-500/5">
          <CardContent className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">{t('cash_change')}</span>
              <span className="font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                {fmtVND(change)}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{t('partial_cash_change_hint')}</p>
          </CardContent>
        </Card>
      ) : null}

      <Button
        className={cn(PAYMENT_PRIMARY_BUTTON, 'w-full')}
        size="lg"
        disabled={amount <= 0}
        onClick={() => {
          dispatch({
            type: 'addPartialPayment',
            sessionId: session.id,
            method: 'cash',
            subMethod: 'cash',
            amount,
            transactionId: makeTxnId(),
          })
        }}
      >
        {t('partial_confirm_cash', fmtVND(amount))}
      </Button>
    </div>
  )
}

function PartialCardPayment({
  session,
  remaining,
  t,
  dispatch,
  onBack,
}: {
  session: CashierSession
  remaining: number
  t: PaymentT
  dispatch: React.Dispatch<CashierAction>
  onBack: () => void
}) {
  const [amount, setAmount] = useState(remaining)
  const [transactionID, setTransactionID] = useState(`POS-${makeTxnId()}`)
  const exceedsRemaining = amount > remaining

  return (
    <div className="space-y-4">
      <BackButton t={t} onBack={onBack} />
      <PaymentField
        id="partial-card-amount"
        label={t('partial_enter_amount')}
        error={exceedsRemaining ? t('partial_card_overpayment_error') : undefined}
        reserveMessage
      >
        <InputGroup
          className={cn(
            'h-11 bg-background',
            exceedsRemaining && 'border-destructive ring-3 ring-destructive/20',
          )}
        >
          <InputGroupInput
            id="partial-card-amount"
            value={amount.toString()}
            inputMode="numeric"
            max={remaining}
            aria-invalid={exceedsRemaining}
            aria-describedby="partial-card-amount-description"
            className="h-11 text-lg tabular-nums"
            onChange={(event) =>
              setAmount(Number.parseInt(event.target.value.replace(/\D/g, ''), 10) || 0)
            }
          />
          <InputGroupAddon align="inline-end">₫</InputGroupAddon>
        </InputGroup>
      </PaymentField>

      <PaymentField id="partial-card-transaction" label={t('card_txn')}>
        <Input
          id="partial-card-transaction"
          className={PAYMENT_INPUT}
          value={transactionID}
          onChange={(event) => setTransactionID(event.target.value)}
        />
      </PaymentField>

      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-muted-foreground">{t('partial_remaining_after')}</span>
        <span
          className={cn(
            'font-semibold tabular-nums',
            exceedsRemaining ? 'text-destructive' : 'text-foreground',
          )}
        >
          {fmtVND(Math.max(0, remaining - amount))}
        </span>
      </div>

      <Button
        className={cn(PAYMENT_PRIMARY_BUTTON, 'w-full')}
        size="lg"
        disabled={amount <= 0 || exceedsRemaining || !transactionID.trim()}
        onClick={() => {
          dispatch({
            type: 'addPartialPayment',
            sessionId: session.id,
            method: 'card',
            subMethod: 'card',
            amount,
            transactionId: transactionID,
          })
        }}
      >
        {t('partial_confirm_card', fmtVND(amount))}
      </Button>
    </div>
  )
}
