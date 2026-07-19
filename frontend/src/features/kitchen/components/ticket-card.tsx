import { type FC } from 'react'
import { ArrowRight, List, MessageSquare, Printer, Timer } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { KDS_DICT } from '@/features/kitchen/data/i18n'
import { minStatus, urgencyFor } from '@/features/kitchen/helpers'

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

const urgencyBorder: Record<Urgency, string> = {
  green: 'border-l-emerald-500',
  amber: 'border-l-amber-500',
  red: 'border-l-red-500 bg-red-50/40 dark:bg-red-950/20',
}

const urgencyBadgeVariant: Record<Urgency, 'success' | 'warning' | 'destructive'> = {
  green: 'success',
  amber: 'warning',
  red: 'destructive',
}

const statusBadgeClass: Record<ItemStatus, string> = {
  pending: 'bg-secondary text-secondary-foreground',
  acknowledged:
    'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-400',
  preparing: 'bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  ready: 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  served: 'border-transparent bg-muted text-muted-foreground',
}

function urgencyLabel(urgency: Urgency, t: TicketCardProps['t']): string {
  if (urgency === 'green') return t('urg_new' as KdsKey)
  if (urgency === 'amber') return t('urg_normal' as KdsKey)
  return t('urg_urgent' as KdsKey)
}

function statusLabel(status: ItemStatus, t: TicketCardProps['t']): string {
  return t(`status_${status}` as KdsKey)
}

function primaryActionLabel(status: ItemStatus, t: TicketCardProps['t']): string {
  if (status === 'pending') return t('btn_acknowledge' as KdsKey)
  if (status === 'acknowledged') return t('btn_start' as KdsKey)
  if (status === 'preparing') return t('btn_ready' as KdsKey)
  return t('btn_served' as KdsKey)
}

export const ColoredBadge: FC<{ status: ItemStatus; t: TicketCardProps['t'] }> = ({
  status,
  t,
}) => <Badge className={statusBadgeClass[status]}>{statusLabel(status, t)}</Badge>

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
  const actionLabel = primaryActionLabel(currentStatus, t)

  return (
    <Card
      className={`border-l-4 ${urgencyBorder[urgency]} ${
        fading ? 'scale-95 opacity-0' : 'opacity-100'
      } transition-all duration-500`}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-0">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold tracking-tight">
              {t('table' as KdsKey)} {ticket.table_number}
            </span>
          </div>
          <div className="truncate text-sm text-muted-foreground">
            {lang === 'vi' ? ticket.area_name_vi : ticket.area_name_en}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Badge variant={urgencyBadgeVariant[urgency]}>
            {urgency === 'red' && <Timer className="mr-1 size-3 animate-pulse" />}
            {urgencyLabel(urgency, t)}
          </Badge>
          <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground/60">
            {ticket.order_id.slice(0, 8)}
          </span>
        </div>
      </CardHeader>

      <CardContent className="pb-0 pt-3">
        {/* Items */}
        <div className="space-y-0">
          {ticket.items.map((item, index) => (
            <div key={item.id}>
              {index > 0 && <Separator className="my-1.5" />}
              <ItemRow item={item} lang={lang} t={t} />
            </div>
          ))}
        </div>
      </CardContent>

      <CardFooter className="flex-col gap-2">
        <Button
          className="h-11 w-full"
          disabled={allServed}
          variant={currentStatus === 'acknowledged' ? 'secondary' : 'default'}
          onClick={onAdvanceAll}
        >
          {actionLabel}
          <ArrowRight className="ml-1 size-4" />
        </Button>
        <Button variant="outline" className="w-full" size="sm" onClick={onOpenManage}>
          <List className="mr-1.5 size-4" />
          {t('btn_manage' as KdsKey)}
        </Button>
        <Button variant="ghost" className="w-full" size="sm" onClick={() => window.print()}>
          <Printer className="mr-1.5 size-4" />
          {t('print_ticket' as KdsKey)}
        </Button>
      </CardFooter>
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
        <span
          className={`mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-sm font-bold tabular-nums ${
            served ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'
          }`}
        >
          {item.qty}
        </span>
        <div className="min-w-0">
          <div
            className={`text-base font-semibold leading-tight ${
              served ? 'text-muted-foreground line-through' : 'text-foreground'
            }`}
          >
            {name}
          </div>
          {options && (
            <div className="mt-0.5 text-sm leading-snug text-muted-foreground">{options}</div>
          )}
          {item.notes && (
            <div className="mt-1 flex items-center gap-1 text-[13px] italic text-amber-600 dark:text-amber-400">
              <MessageSquare className="size-3 shrink-0" />
              {item.notes}
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

export default TicketCard
