import { type FC, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LanguageLoader } from '@/components/ui/language-loader'
import { StaffShell } from '@/components/staff-shell'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { wfFmtClock } from '@/features/waiter/helpers'
import { useWaiter, type WaiterView } from '@/features/waiter/hooks/use-waiter'
import { cn } from '@/lib/utils'
import { DemoControls } from './demo-controls'
import { FloorPlan } from './floor-plan'
import { GridView } from './grid-view'
import { TableSheet } from './table-sheet'

export const WaiterLayout: FC = () => {
  const { state, actions, counts, selectedTable, t } = useWaiter()
  const [changingLang, setChangingLang] = useState<'vi' | 'en' | null>(null)

  return (
    <StaffShell
      role="waiter"
      activeView="waiter"
      brandName={t('restaurant')}
      title={t('floor_view')}
      subtitle={`${t('restaurant')} · ${t('shift')}`}
      headerCenter={
        <div className="flex items-center justify-center gap-4">
          <div className="font-mono text-2xl font-bold tabular-nums tracking-tight text-[var(--text)]">
            {wfFmtClock(state.now)}
          </div>
          <Separator orientation="vertical" className="h-7" />
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--text-tertiary)]">
            {t('shift')}
          </div>
        </div>
      }
      headerActions={
        <>
          <CounterPill tone="red" label={t('calls')} value={counts.calls} />
          <CounterPill tone="emerald" label={t('ready')} value={counts.ready} />
          <CounterPill tone="blue" label={t('bills')} value={counts.bills} />
          <LanguageSwitcher
            currentLang={state.lang}
            onLangChange={(newLang) => {
              setChangingLang(newLang)
              setTimeout(() => {
                actions.setLang(newLang)
                setChangingLang(null)
              }, 750)
            }}
            className="hidden sm:inline-flex"
          />
          <Button
            variant={state.soundOn ? 'default' : 'secondary'}
            size="sm"
            className="hidden rounded-full text-xs uppercase tracking-[0.12em] lg:inline-flex"
            onClick={() => actions.setSoundOn((value) => !value)}
          >
            <span
              className={cn(
                'size-2 rounded-full',
                state.soundOn ? 'bg-emerald-300' : 'bg-[var(--text-tertiary)]',
              )}
            />
            Sound
          </Button>
        </>
      }
      contentClassName="p-0"
    >
      <div className="sticky top-0 z-[240] border-b border-[var(--separator)] bg-[var(--material-regular)] backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-5 lg:px-8">
          <Tabs value={state.view} onValueChange={(value) => actions.setView(value as WaiterView)}>
            <TabsList className="rounded-[18px]">
              <TabsTrigger value="plan" className="rounded-[15px] px-5">
                {t('view_plan')}
              </TabsTrigger>
              <TabsTrigger value="grid" className="rounded-[15px] px-5">
                {t('view_grid')}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Badge
            variant="secondary"
            className="rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums"
          >
            {t('occupied_summary', counts.occupied, counts.total)}
          </Badge>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[1600px] px-5 py-5 lg:px-8">
        {state.view === 'plan' ? (
          <FloorPlan
            tables={state.tables}
            now={state.now}
            lang={state.lang}
            t={t}
            onSelectTable={actions.selectTable}
            justChangedIds={state.justChangedIds}
          />
        ) : (
          <GridView
            tables={state.tables}
            now={state.now}
            lang={state.lang}
            t={t}
            onSelectTable={actions.selectTable}
            justChangedIds={state.justChangedIds}
          />
        )}
      </main>

      <TableSheet
        open={selectedTable !== null}
        table={selectedTable}
        now={state.now}
        lang={state.lang}
        t={t}
        onClose={() => actions.selectTable(null)}
        onAcknowledgeCall={actions.acknowledgeCall}
        onNotifyCashier={actions.notifyCashier}
        onMarkItemServed={actions.markItemServed}
        onMarkAllServed={actions.markAllServed}
        onRequestBill={actions.requestBill}
        onOpenSession={actions.openSession}
      />

      <LanguageLoader open={changingLang !== null} targetLang={changingLang || state.lang} />

      <DemoControls
        open={state.demoOpen}
        t={t}
        autoOn={state.autoOn}
        setOpen={actions.setDemoOpen}
        setAutoOn={actions.setAutoOn}
        timeMultiplier={state.timeMultiplier}
        setTimeMultiplier={actions.setTimeMultiplier}
        onInjectReady={actions.injectItemReady}
        onInjectCall={actions.injectCall}
        onInjectBill={actions.injectBill}
        onInjectSession={actions.injectNewSession}
      />
    </StaffShell>
  )
}

interface CounterPillProps {
  tone: 'red' | 'emerald' | 'blue'
  label: string
  value: number
}

const CounterPill: FC<CounterPillProps> = ({ tone, label, value }) => {
  if (value === 0) return null
  const toneClass: Record<CounterPillProps['tone'], string> = {
    red: 'bg-red-500 text-white shadow-red-500/20',
    emerald: 'bg-emerald-500 text-white shadow-emerald-500/20',
    blue: 'bg-blue-500 text-white shadow-blue-500/20',
  }
  return (
    <div
      className={cn(
        'hidden items-center gap-2 rounded-full py-1 pl-3 pr-1 text-sm font-bold shadow-lg sm:inline-flex',
        toneClass[tone],
      )}
    >
      <span>{label}</span>
      <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-white/25 px-2 tabular-nums">
        {value}
      </span>
    </div>
  )
}

export default WaiterLayout
