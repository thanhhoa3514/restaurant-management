import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export function DemoControls({
  open,
  setOpen,
  paused,
  multiplier,
  hasPendingPayment,
  t,
  onInjectBill,
  onForceSuccess,
  onForceFail,
  onReset,
  onPauseChange,
  onMultiplierChange,
}: {
  open: boolean
  setOpen: (open: boolean) => void
  paused: boolean
  multiplier: number
  hasPendingPayment: boolean
  t: (key: string, ...args: Array<number | string>) => string
  onInjectBill: () => void
  onForceSuccess: () => void
  onForceFail: () => void
  onReset: () => void
  onPauseChange: (paused: boolean) => void
  onMultiplierChange: (value: number) => void
}) {
  if (!open) {
    return (
      <Button
        className="fixed bottom-5 right-5 z-[var(--z-modal)] rounded-full shadow-2xl"
        onClick={() => setOpen(true)}
      >
        {t('demo_title')}
      </Button>
    )
  }

  return (
    <Card className="fixed bottom-5 right-5 z-[var(--z-modal)] w-72 border border-[var(--separator)] bg-zinc-950 p-3 text-white shadow-2xl">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider">{t('demo_title')}</div>
          <div className="text-[10px] text-zinc-400">{t('demo_subtitle')}</div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="h-7 rounded-full px-2"
          onClick={() => setOpen(false)}
        >
          −
        </Button>
      </div>
      <div className="space-y-2">
        <Button
          variant="secondary"
          className="w-full justify-between rounded-[var(--radius-lg)]"
          onClick={onInjectBill}
        >
          {t('demo_inject_bill')}
          <span>▶</span>
        </Button>
        <Button
          variant="secondary"
          className="w-full justify-between rounded-[var(--radius-lg)]"
          disabled={!hasPendingPayment}
          onClick={onForceSuccess}
        >
          {t('demo_force_success')}
          <span>▶</span>
        </Button>
        <Button
          variant="secondary"
          className="w-full justify-between rounded-[var(--radius-lg)]"
          disabled={!hasPendingPayment}
          onClick={onForceFail}
        >
          {t('demo_force_fail')}
          <span>▶</span>
        </Button>
        <Button
          variant="secondary"
          className="w-full justify-between rounded-[var(--radius-lg)]"
          onClick={onReset}
        >
          {t('demo_reset')}
          <span>↺</span>
        </Button>
        <Button
          variant={paused ? 'default' : 'secondary'}
          className="w-full justify-between rounded-[var(--radius-lg)]"
          onClick={() => onPauseChange(!paused)}
        >
          {t('demo_pause')}
          <span>{paused ? 'ON' : 'OFF'}</span>
        </Button>
        <label className="block text-xs font-semibold text-zinc-300" htmlFor="cashier-speed">
          Speed multiplier
        </label>
        <Input
          id="cashier-speed"
          type="number"
          min={1}
          max={60}
          value={multiplier}
          className="bg-zinc-900 text-white"
          onChange={(event) => onMultiplierChange(Number(event.target.value) || 1)}
        />
      </div>
    </Card>
  )
}
