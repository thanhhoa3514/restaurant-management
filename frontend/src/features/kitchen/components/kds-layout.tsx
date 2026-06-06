import { type FC, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { LanguageLoader } from '@/components/ui/language-loader'
import { useShellConfig } from '@/components/staff-shell'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { fmtClock } from '@/features/kitchen/helpers'
import { useKds } from '@/features/kitchen/hooks/use-kds'
import type { Lang } from '@/features/kitchen/types'

import { DemoControls } from './demo-controls'
import { ManageItemsDialog } from './manage-items-dialog'
import { TicketCard } from './ticket-card'

export const KdsLayout: FC = () => {
  const kds = useKds()
  const [changingLang, setChangingLang] = useState<Lang | null>(null)

  useShellConfig({
    title: kds.t('kitchen_display'),
    subtitle: kds.t('restaurant'),
    headerCenter: (
      <div className="rounded-[18px] bg-[var(--surface-grouped)] px-5 py-2 font-mono text-3xl font-bold tracking-tight tabular-nums">
        {fmtClock(kds.now)}
      </div>
    ),
    headerActions: (
      <>
        <StatPill label={kds.t('pending_count')} value={kds.stats.pending} tone="orange" />
        <StatPill label={kds.t('preparing_count')} value={kds.stats.preparing} tone="blue" />
        <StatPill label={kds.t('ready_count')} value={kds.stats.ready} tone="green" />
        <LanguageSwitcher
          currentLang={kds.lang}
          onLangChange={(newLang) => {
            setChangingLang(newLang)
            setTimeout(() => {
              kds.setLang(newLang)
              setChangingLang(null)
            }, 750)
          }}
        />
        <Button
          size="sm"
          variant={kds.soundOn ? 'default' : 'secondary'}
          onClick={() => kds.setSoundOn((current) => !current)}
        >
          {kds.soundOn ? 'Sound on' : 'Muted'}
        </Button>
      </>
    ),
    contentClassName: "p-0"
  })

  return (
    <>
      {kds.lastMessage && (
        <div className="pointer-events-none fixed left-1/2 top-24 z-[360] -translate-x-1/2 rounded-full bg-[var(--text)] px-4 py-2 text-sm font-semibold text-[var(--bg)] shadow-2xl">
          {kds.lastMessage}
        </div>
      )}

      <main className="mx-auto max-w-[1800px] px-4 py-6 lg:px-6">
        {kds.sortedTickets.length === 0 ? (
          <EmptyState title={kds.t('empty_title')} hint={kds.t('empty_hint')} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {kds.sortedTickets.map((ticket) => (
              <TicketCard
                key={ticket.order_id}
                fading={kds.fadingIds.has(ticket.order_id)}
                lang={kds.lang}
                now={kds.now}
                ticket={ticket}
                t={kds.t}
                onAdvanceAll={() => kds.advanceAll(ticket.order_id)}
                onOpenManage={() => kds.setManageOrderId(ticket.order_id)}
              />
            ))}
          </div>
        )}
      </main>

      <DemoControls
        open={kds.demoOpen}
        paused={kds.paused}
        setOpen={kds.setDemoOpen}
        setPaused={kds.setPaused}
        setTimeMultiplier={kds.setTimeMultiplier}
        t={kds.t}
        timeMultiplier={kds.timeMultiplier}
        onInject={kds.injectNewTicket}
      />

      <LanguageLoader open={changingLang !== null} targetLang={changingLang || kds.lang} />

      <ManageItemsDialog
        lang={kds.lang}
        open={Boolean(kds.manageTicket)}
        ticket={kds.manageTicket}
        t={kds.t}
        onAdvanceItem={(itemId) => {
          if (kds.manageTicket) kds.advanceItem(kds.manageTicket.order_id, itemId)
        }}
        onClose={() => kds.setManageOrderId(null)}
      />
    </>
  )
}

const StatPill: FC<{ label: string; value: number; tone: 'orange' | 'blue' | 'green' }> = ({
  label,
  value,
  tone,
}) => {
  const dot = {
    orange: 'bg-[var(--system-orange)]',
    blue: 'bg-[var(--system-blue)]',
    green: 'bg-[var(--system-green)]',
  }[tone]

  return (
    <Badge variant="outline" className="gap-2 rounded-full bg-[var(--bg-elevated)] px-3 py-1.5">
      <span className={`size-2.5 rounded-full ${dot}`} />
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className="text-base font-bold tabular-nums text-[var(--text)]">{value}</span>
    </Badge>
  )
}

const EmptyState: FC<{ title: string; hint: string }> = ({ title, hint }) => (
  <Card className="mx-auto mt-16 flex max-w-xl flex-col items-center justify-center border border-[var(--separator)] bg-[var(--bg-elevated)]/65 px-8 py-16 text-center backdrop-blur-xl">
    <div className="flex size-24 items-center justify-center rounded-[28px] bg-[var(--surface-grouped)] text-5xl text-[var(--text-tertiary)]">
      ♨
    </div>
    <h2 className="mt-6 text-2xl font-bold text-[var(--text)]">{title}</h2>
    <p className="mt-2 text-base text-[var(--text-secondary)]">{hint}</p>
    <div className="mt-8 grid w-full grid-cols-3 gap-3">
      <Skeleton className="h-3" />
      <Skeleton className="h-3" />
      <Skeleton className="h-3" />
    </div>
  </Card>
)

export default KdsLayout
