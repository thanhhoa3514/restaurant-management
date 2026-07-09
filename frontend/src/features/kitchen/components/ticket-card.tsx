import { type FC } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { KDS_DICT } from '@/features/kitchen/data/i18n'
import { fmtHMS, minStatus, urgencyFor } from '@/features/kitchen/helpers'
import type { ItemStatus, KDSItem, Lang, Ticket, Urgency } from '@/features/kitchen/types'

type KdsKey = keyof (typeof KDS_DICT)['vi']
type Translate = (key: KdsKey, ...args: Array<number | string>) => string

interface TicketCardProps {
  ticket: Ticket
  lang: Lang
  now: Date
  fading: boolean
  t: Translate
  onAdvanceAll: () => void
  onOpenManage: () => void
}

const urgencyClasses: Record<Urgency, string> = {
  green: 'border-t-[var(--system-green)]',
  amber: 'border-t-[var(--system-orange)]',
  red: 'border-t-[var(--system-red)]',
}

const urgencyPills: Record<Urgency, string> = {
  green: 'bg-[var(--system-green)]/10 text-[var(--system-green)]',
  amber: 'bg-[var(--system-orange)]/10 text-[var(--system-orange)]',
  red: 'bg-[var(--system-red)]/10 text-[var(--system-red)]',
}

const statusClasses: Record<ItemStatus, string> = {
  pending: 'bg-[var(--surface-grouped)] text-[var(--text-secondary)]',
  acknowledged: 'bg-[var(--system-blue)]/10 text-[var(--system-blue)]',
  preparing: 'bg-[var(--system-orange)]/10 text-[var(--system-orange)]',
  ready: 'bg-[var(--system-green)]/10 text-[var(--system-green)]',
  served: 'bg-[var(--surface-grouped)] text-[var(--text-tertiary)]',
}

function urgencyLabel(urgency: Urgency, t: TicketCardProps['t']): string {
  if (urgency === 'green') return t('urg_new' as KdsKey)
  if (urgency === 'amber') return t('urg_normal' as KdsKey)
  return t('urg_urgent' as KdsKey)
}

function statusLabel(status: ItemStatus, t: TicketCardProps['t']): string {
  return t(`status_${status}` as KdsKey)
}

function primaryAction(status: ItemStatus, t: TicketCardProps['t']) {
  if (status === 'pending')
    return { label: t('btn_acknowledge' as KdsKey), variant: 'default' as const }
  if (status === 'acknowledged')
    return { label: t('btn_start' as KdsKey), variant: 'secondary' as const }
  if (status === 'preparing')
    return { label: t('btn_ready' as KdsKey), variant: 'default' as const }
  return { label: t('btn_served' as KdsKey), variant: 'default' as const }
}

export const ColoredBadge: FC<{ status: ItemStatus; t: TicketCardProps['t'] }> = ({
  status,
  t,
}) => (
  <Badge className={`rounded-full text-[11px] font-semibold ${statusClasses[status]}`}>
    {statusLabel(status, t)}
  </Badge>
)

export const TicketCard: FC<TicketCardProps> = ({
  ticket,
  lang,
  now,
  fading,
  t,
  onAdvanceAll,
  onOpenManage,
}) => {
  const waitSec = Math.max(0, Math.floor((now.getTime() - ticket.submitted_at.getTime()) / 1_000))
  const urgency = urgencyFor(waitSec)
  const liveItems = ticket.items.filter((item) => item.status !== 'served')
  const allServed = liveItems.length === 0
  const currentStatus = allServed ? 'served' : minStatus(liveItems)
  const action = primaryAction(currentStatus, t)

  return (
    <Card
      className={`overflow-hidden border border-[var(--separator)] border-t-4 bg-[var(--bg-elevated)]/80 shadow-[0_20px_70px_rgba(0,0,0,0.08)] backdrop-blur-xl transition-all duration-500 ${urgencyClasses[urgency]} ${
        fading ? 'scale-95 opacity-0' : 'opacity-100'
      }`}
    >
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <div className="text-[30px] font-bold leading-none tracking-tight text-[var(--text)]">
            {t('table' as KdsKey)} {ticket.table_number}
          </div>
          <div className="mt-1 truncate text-sm text-[var(--text-secondary)]">
            {t('area' as KdsKey)}: {lang === 'vi' ? ticket.area_name_vi : ticket.area_name_en}
          </div>
          <div className="mt-3 font-mono text-[17px] font-semibold tabular-nums text-[var(--text)]">
            {fmtHMS(waitSec)}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge
            className={`rounded-full ${urgencyPills[urgency]} ${urgency === 'red' ? 'animate-pulse' : ''}`}
          >
            {urgencyLabel(urgency, t)}
          </Badge>
          <span className="rounded-full bg-[var(--surface-grouped)] px-2 py-1 font-mono text-[11px] text-[var(--text-tertiary)]">
            {ticket.order_id}
          </span>
        </div>
      </div>

      <div className="px-5 pb-3">
        {ticket.items.map((item, index) => (
          <div key={item.id}>
            {index > 0 && <Separator className="my-2" />}
            <ItemRow item={item} lang={lang} t={t} />
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-[var(--separator)] px-4 py-4">
        <Button
          className="h-12 w-full rounded-[14px]"
          disabled={allServed}
          variant={action.variant}
          onClick={onAdvanceAll}
        >
          {action.label}
        </Button>
        <Button
          variant="link"
          className="w-full rounded-xl py-1.5 text-sm font-medium"
          onClick={onOpenManage}
        >
          {t('btn_manage' as KdsKey)} →
        </Button>
      </div>
    </Card>
  )
}

const ItemRow: FC<{ item: KDSItem; lang: Lang; t: TicketCardProps['t'] }> = ({ item, lang, t }) => {
  const name = lang === 'vi' ? item.name_vi : item.name_en
  const options = lang === 'vi' ? item.options_text_vi : item.options_text_en
  const served = item.status === 'served'

  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--text)] text-sm font-bold text-[var(--bg)] tabular-nums">
          ×{item.qty}
        </span>
        <div className="min-w-0">
          <div
            className={`text-[17px] font-semibold leading-tight ${served ? 'text-[var(--text-tertiary)] line-through' : 'text-[var(--text)]'}`}
          >
            {name}
          </div>
          {options && (
            <div className="mt-0.5 text-sm leading-snug text-[var(--text-secondary)]">
              {options}
            </div>
          )}
          {item.notes && (
            <div className="mt-1 text-[13px] italic text-[var(--system-orange)]">
              ※ {item.notes}
            </div>
          )}
        </div>
      </div>
      <div className="shrink-0 pt-0.5">
        <ColoredBadge status={item.status} t={t} />
      </div>
    </div>
  )
}


