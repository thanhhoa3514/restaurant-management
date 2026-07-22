import { type FC } from 'react'
import { ArrowRight, Flame, List, MessageSquare, Printer } from 'lucide-react'

import { KDS_DICT } from '@/i18n'
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

const surface = {
  card: 'bg-white dark:bg-zinc-900',
  cardHover: 'bg-zinc-50 dark:bg-zinc-800',
  border: 'border-zinc-200 dark:border-zinc-800',
  divider: 'border-zinc-100 dark:border-zinc-800/50',
  textPrimary: 'text-zinc-900 dark:text-zinc-100',
  textMuted: 'text-zinc-500 dark:text-zinc-400',
  chipMuted: 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500',
}

const urgencyStyles: Record<
  Urgency,
  { timerText: string; labelText: string; pulse: boolean }
> = {
  green: {
    timerText: 'text-emerald-600 dark:text-emerald-500',
    labelText: 'text-emerald-600 dark:text-emerald-500',
    pulse: false,
  },
  amber: {
    timerText: 'text-amber-600 dark:text-amber-500',
    labelText: 'text-amber-600 dark:text-amber-500',
    pulse: false,
  },
  red: {
    timerText: 'text-red-600 dark:text-red-500',
    labelText: 'text-red-600 dark:text-red-500',
    pulse: true,
  },
}

const statusPillClass: Record<ItemStatus, string> = {
  placed: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  pending: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  cancelled: 'bg-zinc-100 text-zinc-400 line-through dark:bg-zinc-800 dark:text-zinc-500',
  acknowledged: 'bg-blue-500 text-white',
  preparing: 'bg-amber-500 text-white',
  ready: 'bg-emerald-500 text-white font-bold',
  served: 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500',
}

function formatWait(waitSec: number): string {
  const m = Math.floor(waitSec / 60)
  const s = waitSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
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
}) => (
  <span
    className={`rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${statusPillClass[status]}`}
  >
    {statusLabel(status, t)}
  </span>
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
  const uStyle = urgencyStyles[urgency]
  const liveItems = ticket.items.filter((item) => item.status !== 'served')
  const allServed = liveItems.length === 0
  const currentStatus = allServed ? 'served' : minStatus(liveItems)
  const actionLabel = primaryActionLabel(currentStatus, t)

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border ${surface.border} ${surface.card} ${surface.textPrimary} shadow-sm ${
        fading ? 'scale-95 opacity-0' : 'opacity-100'
      } transition-all duration-500`}
    >
      <div className="flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 pb-4">
          <div className="min-w-0">
            <div className="text-2xl font-black leading-none tracking-tight">
              {t('table' as KdsKey)} {ticket.table_number}
            </div>
            <div className={`mt-1.5 truncate text-[13px] font-medium ${surface.textMuted}`}>
              {lang === 'vi' ? ticket.area_name_vi : ticket.area_name_en}
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div
              className={`flex items-center justify-end gap-1 font-mono text-xl font-bold tabular-nums ${uStyle.timerText}`}
            >
              {urgency === 'red' && <Flame className="size-4" />}
              {formatWait(waitSec)}
            </div>
            <div
              className={`mt-1 text-[10px] font-bold uppercase tracking-widest ${uStyle.labelText}`}
            >
              {urgencyLabel(urgency, t)}
            </div>
          </div>
        </div>

        {/* Items */}
        <div className={`border-t ${surface.divider} bg-zinc-50/50 dark:bg-zinc-900/50`}>
          {ticket.items.map((item) => (
            <div key={item.id} className={`border-b ${surface.divider} last:border-b-0`}>
              <ItemRow item={item} lang={lang} t={t} />
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 p-4">
          <button
            type="button"
            disabled={allServed}
            onClick={onAdvanceAll}
            className="flex h-12 w-full items-center justify-center gap-1.5 rounded-xl bg-orange-500 text-sm font-bold text-white shadow-sm transition-colors duration-200 hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500"
          >
            {actionLabel}
            <ArrowRight className="size-4" />
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onOpenManage}
              className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border ${surface.border} text-[13px] font-semibold ${surface.textMuted} transition-colors duration-200 hover:${surface.cardHover} hover:text-zinc-900 dark:hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500`}
            >
              <List className="size-3.5" />
              {t('btn_manage' as KdsKey)}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border ${surface.border} text-[13px] font-semibold ${surface.textMuted} transition-colors duration-200 hover:${surface.cardHover} hover:text-zinc-900 dark:hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500`}
            >
              <Printer className="size-3.5" />
              {t('print_ticket' as KdsKey)}
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

const ItemRow: FC<{ item: KDSItem; lang: Lang; t: TicketCardProps['t'] }> = ({ item, lang, t }) => {
  const name = lang === 'vi' ? item.name_vi : item.name_en
  const options = lang === 'vi' ? item.options_text_vi : item.options_text_en
  const served = item.status === 'served'

  return (
    <div className="flex items-start justify-between gap-3 px-5 py-3.5">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={`mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg font-mono text-[13px] font-bold tabular-nums ${
            served ? surface.chipMuted : 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
          }`}
        >
          {item.qty}
        </span>
        <div className="min-w-0">
          <div
            className={`text-[15px] font-bold leading-tight ${
              served ? `line-through ${surface.textMuted}` : surface.textPrimary
            }`}
          >
            {name}
          </div>
          {options && (
            <div className={`mt-1 text-[13px] font-medium leading-snug ${surface.textMuted}`}>{options}</div>
          )}
          {item.notes && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[12px] font-semibold italic text-amber-600 dark:text-amber-500">
              <MessageSquare className="size-3.5 shrink-0" />
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
