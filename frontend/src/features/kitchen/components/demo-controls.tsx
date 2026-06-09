import { type FC } from 'react'

import { Button } from '@/components/ui/button'
import { KDS_DICT } from '@/features/kitchen/data/i18n'

type KdsKey = keyof (typeof KDS_DICT)['vi']
type Translate = (key: KdsKey, ...args: Array<number | string>) => string

interface DemoControlsProps {
  open: boolean
  setOpen: (open: boolean) => void
  timeMultiplier: number
  setTimeMultiplier: (value: number) => void
  paused: boolean
  setPaused: (value: boolean | ((current: boolean) => boolean)) => void
  t: Translate
  onInject: () => void
}

const SPEEDS = [1, 10, 60]

export const DemoControls: FC<DemoControlsProps> = ({
  open,
  setOpen,
  timeMultiplier,
  setTimeMultiplier,
  paused,
  setPaused,
  t,
  onInject,
}) => {
  const cycleSpeed = () => {
    const index = SPEEDS.indexOf(timeMultiplier)
    setTimeMultiplier(SPEEDS[(index + 1) % SPEEDS.length])
  }

  return (
    <div
      className={`fixed bottom-5 right-5 z-[350] select-none font-mono transition-all ${open ? 'w-72' : 'w-auto'}`}
    >
      {open ? (
        <div className="overflow-hidden rounded-[18px] border border-zinc-800 bg-zinc-950 text-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
            <div>
              <div className="text-[13px] font-bold uppercase tracking-wider">
                {t('demo_title')}
              </div>
              <div className="mt-0.5 text-[10px] text-zinc-400">{t('demo_subtitle')}</div>
            </div>
            <button
              className="size-7 rounded-full text-zinc-400 transition hover:bg-zinc-850 hover:text-white"
              onClick={() => setOpen(false)}
              type="button"
            >
              −
            </button>
          </div>
          <div className="space-y-2 p-3">
            <button className="demo-row" onClick={onInject} type="button">
              <span>{t('demo_inject')}</span>
              <span>▶</span>
            </button>
            <button className="demo-row" onClick={cycleSpeed} type="button">
              <span>{t('demo_speed')}</span>
              <span className="rounded-md bg-zinc-800 px-2 py-0.5 font-bold tabular-nums">
                ×{timeMultiplier}
              </span>
            </button>
            <button
              className="demo-row"
              onClick={() => setPaused((current) => !current)}
              type="button"
            >
              <span>{paused ? t('demo_resume') : t('demo_pause')}</span>
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${paused ? 'bg-[var(--system-red)]' : 'bg-[var(--system-green)] text-black'}`}
              >
                {paused ? 'OFF' : 'ON'}
              </span>
            </button>
          </div>
        </div>
      ) : (
        <Button
          className="rounded-full border border-zinc-800 bg-zinc-950 px-4 font-mono text-xs uppercase tracking-wider text-zinc-100 shadow-lg hover:bg-zinc-900"
          onClick={() => setOpen(true)}
        >
          {t('demo_title')}
        </Button>
      )}
      <style>{`.demo-row{display:flex;width:100%;align-items:center;justify-content:space-between;border-radius:12px;background:#18181b;padding:10px 12px;text-align:left;font-size:13px;font-weight:700;transition:background .18s;border:1px solid #27272a;color:#f4f4f5}.demo-row:hover{background:#27272a}`}</style>
    </div>
  )
}


