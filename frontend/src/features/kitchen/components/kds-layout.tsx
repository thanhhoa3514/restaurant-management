import { type FC, useState } from 'react'
import { ChefHat, Clock, Volume2, VolumeX } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { LanguageLoader } from '@/components/ui/language-loader'
import { useShellConfig, ShellHeaderCenter, ShellHeaderActions } from '@/components/admin-shell'
import { LanguageSwitcher } from '@/components/ui/language-switcher'
import { fmtClock } from '@/features/kitchen/helpers'
import { useKds } from '@/features/kitchen/hooks/use-kds'
import type { Lang } from '@/features/kitchen/types'

import { CancelRequestsPanel } from './cancel-requests-panel'
import { ManageItemsDialog } from './manage-items-dialog'
import { TicketCard } from './ticket-card'

export const KdsLayout: FC = () => {
  const kds = useKds()
  const [changingLang, setChangingLang] = useState<Lang | null>(null)

  useShellConfig({
    title: kds.t('kitchen_display'),
    subtitle: kds.t('restaurant'),
  })

  return (
    <>
      <ShellHeaderCenter>
        <div className="flex items-center gap-3 font-mono text-2xl font-bold tabular-nums tracking-tight">
          <Clock className="size-6 text-muted-foreground" />
          <span>{fmtClock(kds.now)}</span>
        </div>
      </ShellHeaderCenter>

      <ShellHeaderActions>
        <StatPill label={kds.t('pending_count')} value={kds.stats.pending} variant="warning" />
        <StatPill label={kds.t('preparing_count')} value={kds.stats.preparing} variant="secondary" />
        <StatPill label={kds.t('ready_count')} value={kds.stats.ready} variant="success" />
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
          {kds.soundOn ? (
            <>
              <Volume2 className="size-4" />
              Sound on
            </>
          ) : (
            <>
              <VolumeX className="size-4" />
              Muted
            </>
          )}
        </Button>
      </ShellHeaderActions>

      {kds.lastMessage && (
        <div className="pointer-events-none fixed left-1/2 top-24 z-[360] -translate-x-1/2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background shadow-lg">
          {kds.lastMessage}
        </div>
      )}

      <main className="mx-auto max-w-[1800px] px-4 py-6 lg:px-6">
        <CancelRequestsPanel
          cancelRequests={kds.cancelRequests}
          t={kds.t}
          onReview={kds.reviewCancel}
        />
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

const StatPill: FC<{
  label: string
  value: number
  variant: 'warning' | 'secondary' | 'success'
}> = ({ label, value, variant }) => (
  <Badge variant="outline" className="gap-2 px-3 py-1.5">
    <span className="text-muted-foreground">{label}</span>
    <Badge variant={variant} className="min-w-5 px-1.5 text-center text-xs font-bold tabular-nums">
      {value}
    </Badge>
  </Badge>
)

const EmptyState: FC<{ title: string; hint: string }> = ({ title, hint }) => (
  <Card className="mx-auto mt-16 max-w-md border-dashed">
    <CardContent className="flex flex-col items-center py-16 text-center">
      <div className="mb-4 flex size-20 items-center justify-center rounded-2xl bg-muted">
        <ChefHat className="size-10 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">{hint}</p>
      <div className="mt-8 grid w-48 grid-cols-3 gap-3">
        <Skeleton className="h-2.5" />
        <Skeleton className="h-2.5" />
        <Skeleton className="h-2.5" />
      </div>
    </CardContent>
  </Card>
)

export default KdsLayout
