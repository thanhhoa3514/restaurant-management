import { useMemo, useState, type FC, type ReactNode } from 'react'
import { BellRing, ChevronRight, Clock, Search, Users, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LIST_CARD, STATUS_VARIANT, WARN_TEXT } from '@/features/cashier/components/panel-styles'
import {
  fmtClock,
  fmtHMS,
  fmtVND,
  itemsCount,
  providerName,
  sessionTotal,
} from '@/features/cashier/helpers'
import type { CashierSession, Lang, SessionStatus } from '@/features/cashier/types'

type SortMode = 'newest' | 'bill'

interface SessionListProps {
  sessions: CashierSession[]
  selectedId: string | null
  now: Date
  lang: Lang
  t: (key: string, ...args: Array<number | string>) => string
  onSelect: (id: string) => void
  /* page-level actions parked in the toolbar so they sit with search/sort instead of the shell header */
  actions?: ReactNode
}

export const SessionList: FC<SessionListProps> = ({
  sessions,
  selectedId,
  now,
  lang,
  t,
  onSelect,
  actions,
}) => {
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('newest')
  const billRequestedCount = sessions.filter(
    (session) => session.status === 'bill_requested',
  ).length

  const filteredSessions = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = sessions.filter((session) => {
      if (!query) return true
      return String(session.table_label).includes(query)
    })

    return filtered.toSorted((a, b) => {
      if (sortMode === 'bill') {
        const aBill = a.status === 'bill_requested' && a.bill_requested_at
        const bBill = b.status === 'bill_requested' && b.bill_requested_at
        if (aBill && bBill) return aBill.getTime() - bBill.getTime()
        if (aBill) return -1
        if (bBill) return 1
      }
      const rank: Record<SessionStatus, number> = {
        bill_requested: 0,
        in_payment: 1,
        dining: 2,
        paid: 3,
        closed: 4,
        voided: 5,
      }
      const rankDiff = rank[a.status] - rank[b.status]
      return rankDiff || b.started_at.getTime() - a.started_at.getTime()
    })
  }, [search, sessions, sortMode])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="sticky top-0 z-10 border-b border-[var(--separator)] bg-[var(--background)] p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative sm:max-w-xs sm:flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('search_placeholder')}
              className="pl-9 pr-9"
            />
            {search ? (
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('search_clear')}
                className="absolute right-1 top-1/2 size-8 -translate-y-1/2 rounded-full text-[var(--text-tertiary)]"
                onClick={() => setSearch('')}
              >
                <X className="size-4" />
              </Button>
            ) : null}
          </div>
          <Tabs
            value={sortMode}
            onValueChange={(value) => setSortMode(value as SortMode)}
            className="shrink-0"
          >
            {/* same variant prefix as the base h-8 so tailwind-merge actually drops it */}
            <TabsList className="group-data-horizontal/tabs:h-10 p-1">
              <TabsTrigger value="newest" className="px-3">
                <Clock />
                {t('sort_newest')}
              </TabsTrigger>
              <TabsTrigger value="bill" className="px-3">
                <BellRing />
                {t('sort_bill')}
                {billRequestedCount > 0 ? (
                  <Badge variant="warning" className="px-1.5 tabular-nums">
                    {billRequestedCount}
                  </Badge>
                ) : null}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {actions ? <div className="sm:ml-auto">{actions}</div> : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[var(--surface-grouped)]">
        {filteredSessions.length === 0 ? (
          <Card
            className={`border border-[var(--separator)] ${LIST_CARD} p-10 text-center text-base text-[var(--text-tertiary)]`}
          >
            <Users className="mx-auto size-6" />
            <p className="mt-3">{t('no_sessions')}</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                selected={session.id === selectedId}
                now={now}
                lang={lang}
                t={t}
                onSelect={() => onSelect(session.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SessionCard({
  session,
  selected,
  now,
  lang,
  t,
  onSelect,
}: {
  session: CashierSession
  selected: boolean
  now: Date
  lang: Lang
  t: (key: string, ...args: Array<number | string>) => string
  onSelect: () => void
}) {
  const elapsedMinutes = Math.max(
    0,
    Math.round((now.getTime() - session.started_at.getTime()) / 60000),
  )
  const billAgoSeconds = session.bill_requested_at
    ? Math.max(0, Math.floor((now.getTime() - session.bill_requested_at.getTime()) / 1000))
    : null
  const pendingInvoice = session.invoices.find((inv) => inv.payment?.status === 'pending')

  return (
    <Button
      variant="secondary"
      className={`h-full w-full justify-start rounded-[var(--radius-xl)] border p-0 text-left transition-shadow ${LIST_CARD} ${
        selected
          ? 'border-[var(--text-secondary)] ring-2 ring-[var(--text)]/20'
          : /* hover must move away from the list's --surface-grouped background, not onto it */
            'border-[var(--separator)] hover:ring-1 hover:ring-[var(--text)]/15'
      }`}
      onClick={onSelect}
    >
      <div className="w-full p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-bold text-[var(--text)]">
              {t('table')} {session.table_label}
            </div>
            <div className="mt-0.5 text-xs font-normal text-[var(--text-tertiary)]">
              {lang === 'vi' ? session.area_name_vi : session.area_name_en} ·{' '}
              {t('guests', session.guest_count)}
              {session.guest_name && <span> · {session.guest_name}</span>}
            </div>
          </div>
          <ChevronRight className="size-4 shrink-0 text-[var(--text-tertiary)]" />
        </div>
        <div className="mt-3 flex items-center justify-between text-xs font-normal text-[var(--text-tertiary)]">
          <span>
            {fmtClock(session.started_at)} · {t('elapsed_min', elapsedMinutes)}
          </span>
          <span>{t('items_count', itemsCount(session))}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <Badge variant={STATUS_VARIANT[session.status]}>{t(`status_${session.status}`)}</Badge>
          <span className="font-bold tabular-nums text-[var(--text)]">
            {fmtVND(sessionTotal(session))}
          </span>
        </div>
        {/* amber to match the bill_requested badge above — red is reserved for voided */}
        {billAgoSeconds !== null && session.status === 'bill_requested' ? (
          <div className={`mt-2 text-xs font-normal ${WARN_TEXT}`}>
            {t('bill_requested_ago', fmtHMS(billAgoSeconds))}
          </div>
        ) : null}
        {pendingInvoice?.payment ? (
          <div className={`mt-2 text-xs font-normal ${WARN_TEXT}`}>
            {providerName(pendingInvoice.payment.sub_method)} · pending
          </div>
        ) : null}
      </div>
    </Button>
  )
}
