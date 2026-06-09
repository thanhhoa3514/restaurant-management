import { type Dispatch, type FC, type SetStateAction } from 'react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

interface DemoControlsProps {
  open: boolean
  t: (key: string, ...args: Array<string | number>) => string
  autoOn: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
  setAutoOn: Dispatch<SetStateAction<boolean>>
  timeMultiplier: number
  setTimeMultiplier: Dispatch<SetStateAction<number>>
  onInjectReady: () => void
  onInjectCall: () => void
  onInjectBill: () => void
  onInjectSession: () => void
}

const SPEEDS = [1, 10, 60]

export const DemoControls: FC<DemoControlsProps> = ({
  open,
  t,
  autoOn,
  setOpen,
  setAutoOn,
  timeMultiplier,
  setTimeMultiplier,
  onInjectReady,
  onInjectCall,
  onInjectBill,
  onInjectSession,
}) => {
  const cycleSpeed = () => {
    const index = SPEEDS.indexOf(timeMultiplier)
    setTimeMultiplier(SPEEDS[(index + 1) % SPEEDS.length] ?? 1)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-[350] inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-100 shadow-xl"
      >
        <span className="size-2 rounded-full bg-emerald-500" />
        {t('demo_title')}
      </button>
    )
  }

  return (
    <Card className="fixed bottom-5 right-5 z-[350] w-72 overflow-hidden rounded-[24px] border border-zinc-800 bg-zinc-950 text-zinc-100 shadow-xl">
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.18em]">{t('demo_title')}</div>
          <div className="mt-0.5 text-[11px] text-zinc-400">{t('demo_subtitle')}</div>
        </div>
        <button type="button" className="rounded-full px-2 text-xl leading-none text-zinc-400 hover:bg-zinc-850" onClick={() => setOpen(false)}>
          −
        </button>
      </div>
      <Separator className="bg-zinc-800" />
      <div className="space-y-2 p-3">
        <DemoButton color="bg-emerald-500" label={t('demo_inject_ready')} onClick={onInjectReady} />
        <DemoButton color="bg-red-500" label={t('demo_inject_call')} onClick={onInjectCall} />
        <DemoButton color="bg-blue-500" label={t('demo_inject_bill')} onClick={onInjectBill} />
        <DemoButton color="bg-amber-500" label={t('demo_inject_session')} onClick={onInjectSession} />
        <Separator className="bg-zinc-800" />
        <Button variant="secondary" className="w-full justify-between rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-100 hover:bg-zinc-850" onClick={() => setAutoOn((value) => !value)}>
          <span className="inline-flex items-center gap-2">
            <span className={cn('size-2 rounded-full', autoOn ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600')} />
            {t('demo_auto')}
          </span>
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', autoOn ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-800 text-zinc-300')}>
            {autoOn ? 'ON' : 'OFF'}
          </span>
        </Button>
        <Button variant="secondary" className="w-full justify-between rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-100 hover:bg-zinc-850" onClick={cycleSpeed}>
          <span className="inline-flex items-center gap-2">
            <span className="size-2 rounded-full bg-zinc-400" />
            {t('demo_speed')}
          </span>
          <span className="rounded-full bg-white px-2 py-0.5 font-mono text-xs font-bold text-zinc-950">×{timeMultiplier}</span>
        </Button>
      </div>
    </Card>
  )
}

interface DemoButtonProps {
  color: string
  label: string
  onClick: () => void
}

const DemoButton: FC<DemoButtonProps> = ({ color, label, onClick }) => (
  <Button variant="secondary" className="w-full justify-between rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-100 hover:bg-zinc-850" onClick={onClick}>
    <span className="inline-flex items-center gap-2">
      <span className={cn('size-2 rounded-full', color)} />
      {label}
    </span>
    <span className="text-[10px] text-zinc-400">▶</span>
  </Button>
)


