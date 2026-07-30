/* Hallmark · component: payment panel · genre: modern-minimal · theme: semantic-shadcn
 * states: default · hover · focus · active · disabled · loading · error · success
 * pre-emit critique: P4 H4 E4 S5 R5 V4
 */
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { PAYMENT_GHOST_BUTTON } from '@/features/cashier/components/payment/payment-config'
import { fmtVND } from '@/features/cashier/helpers'
import { cn } from '@/lib/utils'

export type PaymentT = (key: string, ...args: Array<number | string>) => string

export function PaymentField({
  id,
  label,
  hint,
  error,
  reserveMessage = false,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  reserveMessage?: boolean
  children: ReactNode
}) {
  const showMessage = reserveMessage || Boolean(hint) || Boolean(error)
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {showMessage ? (
        <p
          id={`${id}-description`}
          className={cn(
            'min-h-[1lh] text-xs',
            error ? 'font-medium text-destructive' : 'text-muted-foreground',
          )}
        >
          {error ?? hint ?? ''}
        </p>
      ) : null}
    </div>
  )
}

export function TotalCard({ label, amount }: { label: string; amount: number }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tabular-nums text-card-foreground">
          {fmtVND(amount)}
        </div>
      </CardContent>
    </Card>
  )
}

export function BackButton({ t, onBack }: { t: PaymentT; onBack: () => void }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(PAYMENT_GHOST_BUTTON, '-ml-2')}
      onClick={onBack}
    >
      <ArrowLeft />
      {t('back')}
    </Button>
  )
}

export function PaidRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right font-medium tabular-nums text-foreground">
        {value}
      </span>
    </div>
  )
}
