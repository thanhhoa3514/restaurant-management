import { useMemo, useState, type FC } from 'react'
import { Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fmtClock, fmtHMS, fmtVND, itemsCount, providerName, sessionTotal } from '@/features/cashier/helpers'
import type { CashierSession, Lang, SessionStatus } from '@/features/cashier/types'

type SortMode = 'newest' | 'bill'

interface SessionListProps {
  sessions: CashierSession[]
  selectedId: string | null
  now: Date
  lang: Lang
  t: (key: string, ...args: Array<number | string>) => string
  onSelect: (id: string) => void
}

const statusTone: Record<SessionStatus, string> = {
  dining: 'bg-[var(--surface-grouped)] text-[var(--text-secondary)]',
  bill_requested: 'bg-[var(--system-red)]/10 text-[var(--system-red)]',
  in_payment: 'bg-[var(--system-orange)]/10 text-[var(--system-orange)]',
  paid: 'bg-[var(--system-green)]/10 text-[var(--system-green)]',
  closed: 'bg-[var(--surface-grouped)] text-[var(--text-tertiary)]',
  voided: 'bg-[var(--system-red)]/10 text-[var(--system-red)]',
}

export const SessionList: FC<SessionListProps> = ({ sessions, selectedId, now, lang, t, onSelect }) => {
  const [search, setSearch] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('newest')

  const filteredSessions = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = sessions.filter((session) => {
      if (!query) return true
      return String(session.table_number).includes(query)
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
      <div className="space-y-3 border-b border-[var(--separator)] p-4 sm:p-6 bg-[var(--background)] z-10 sticky top-0 shadow-sm">
        <div className="relative group">
          <Search className="absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-[var(--text-tertiary)] transition-colors group-focus-within:text-[var(--system-orange)]" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('search_placeholder')}
            className="h-12 w-full rounded-2xl border-[var(--separator)] bg-[var(--surface-grouped)] pl-11 text-base font-medium shadow-sm transition-all hover:border-[var(--system-orange)]/40 focus-visible:border-[var(--system-orange)] focus-visible:ring-2 focus-visible:ring-[var(--system-orange)]/20"
          />
        </div>
        <Tabs value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)} className="w-full">
          <TabsList className="w-full bg-[var(--surface-grouped)]">
            <TabsTrigger value="newest" className="flex-1">{t('sort_newest')}</TabsTrigger>
            <TabsTrigger value="bill" className="flex-1">{t('sort_bill')}</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-[var(--surface-grouped)]">
        {filteredSessions.length === 0 ? (
          <Card className="border border-[var(--separator)] bg-[var(--material-regular)] p-10 text-center text-base text-[var(--text-tertiary)]">
            {t('no_sessions')}
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
  const elapsedMinutes = Math.max(0, Math.round((now.getTime() - session.started_at.getTime()) / 60000))
  const billAgoSeconds = session.bill_requested_at
    ? Math.max(0, Math.floor((now.getTime() - session.bill_requested_at.getTime()) / 1000))
    : null
  const pendingInvoice = session.invoices.find((inv) => inv.payment?.status === 'pending')

  return (
    <Button
      variant="secondary"
      className={`h-full w-full justify-start rounded-2xl border p-0 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-md ${
        selected
          ? 'border-[var(--system-blue)] bg-[var(--system-blue)]/10 ring-2 ring-[var(--system-blue)]/20'
          : 'border-[var(--separator)] bg-[var(--background)] hover:border-[var(--system-orange)]/40'
      }`}
      onClick={onSelect}
    >
      <div className="w-full p-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-bold text-[var(--text)]">{t('table')} {session.table_number}</div>
            <div className="mt-0.5 text-xs font-normal text-[var(--text-tertiary)]">
              {lang === 'vi' ? session.area_name_vi : session.area_name_en} · {t('guests', session.guest_count)}
              {session.guest_name && <span> · {session.guest_name}</span>}
            </div>
          </div>
          <span className="text-[var(--text-tertiary)]">›</span>
        </div>
        <div className="mt-3 flex items-center justify-between text-xs font-normal text-[var(--text-tertiary)]">
          <span>{fmtClock(session.started_at)} · {t('elapsed_min', elapsedMinutes)}</span>
          <span>{t('items_count', itemsCount(session))}</span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <Badge className={`rounded-full border-0 ${statusTone[session.status]}`}>{t(`status_${session.status}`)}</Badge>
          <span className="font-bold tabular-nums text-[var(--text)]">{fmtVND(sessionTotal(session))}</span>
        </div>
        {billAgoSeconds !== null && session.status === 'bill_requested' ? (
          <div className="mt-2 text-xs font-normal text-[var(--system-red)]">
            {t('bill_requested_ago', fmtHMS(billAgoSeconds))}
          </div>
        ) : null}
        {pendingInvoice?.payment ? (
          <div className="mt-2 text-xs font-normal text-[var(--system-orange)]">
            {providerName(pendingInvoice.payment.sub_method)} · pending
          </div>
        ) : null}
      </div>
    </Button>
  )
}


