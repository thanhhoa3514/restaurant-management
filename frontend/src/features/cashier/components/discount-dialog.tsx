import { useState, type FC } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { activeInvoice } from '@/features/cashier/helpers'
import type { CashierSession } from '@/features/cashier/types'

type DiscountReason = 'promo' | 'regular' | 'complaint'

interface DiscountDialogProps {
  open: boolean
  session: CashierSession | null
  t: (key: string, ...args: Array<number | string>) => string
  onOpenChange: (open: boolean) => void
  onApply: (amount: number, reason: DiscountReason) => void
  onRemove: () => void
}

const reasons: DiscountReason[] = ['promo', 'regular', 'complaint']

export const DiscountDialog: FC<DiscountDialogProps> = ({
  open,
  session,
  t,
  onOpenChange,
  onApply,
  onRemove,
}) => {
  const invoice = session ? activeInvoice(session) : null
  const [amount, setAmount] = useState(invoice?.discount?.amount.toString() ?? '')
  const [reason, setReason] = useState<DiscountReason>(
    (invoice?.discount?.reason as DiscountReason | undefined) ?? 'promo',
  )

  const parsedAmount = Number.parseInt(amount, 10) || 0
  const valid = parsedAmount > 0 && parsedAmount <= 50000

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md bg-[var(--material-thick)]" hideClose>
        <SheetHeader title={t('discount_dialog_title')} subtitle={invoice?.number} />
        <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-5">
          <Card className="border border-[var(--separator)] bg-[var(--material-regular)] p-4 shadow-sm backdrop-blur-2xl">
            <label className="text-sm font-semibold text-[var(--text)]" htmlFor="discount-amount">
              {t('discount_amount')}
            </label>
            <Input
              id="discount-amount"
              className="mt-2 h-12 rounded-[var(--radius-lg)] text-lg tabular-nums"
              inputMode="numeric"
              value={amount}
              placeholder="0"
              onChange={(event) => setAmount(event.target.value.replace(/\D/g, '').slice(0, 5))}
            />
            <p className="mt-2 text-xs text-[var(--text-tertiary)]">{t('discount_max_hint')}</p>
          </Card>

          <Card className="border border-[var(--separator)] bg-[var(--material-regular)] p-4 shadow-sm backdrop-blur-2xl">
            <div className="text-sm font-semibold text-[var(--text)]">{t('discount_reason')}</div>
            <div className="mt-3 grid grid-cols-1 gap-2">
              {reasons.map((item) => (
                <Button
                  key={item}
                  type="button"
                  variant={reason === item ? 'default' : 'secondary'}
                  className="justify-start rounded-[var(--radius-lg)]"
                  onClick={() => setReason(item)}
                >
                  {t(`discount_reason_${item}`)}
                </Button>
              ))}
            </div>
          </Card>

          <Separator />

          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1 rounded-[var(--radius-lg)]" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
            <Button className="flex-1 rounded-[var(--radius-lg)]" disabled={!valid} onClick={() => onApply(parsedAmount, reason)}>
              {t('discount_apply')}
            </Button>
          </div>

          {invoice?.discount ? (
            <Button variant="destructive" className="w-full rounded-[var(--radius-lg)]" onClick={onRemove}>
              {t('remove_discount')}
            </Button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  )
}


