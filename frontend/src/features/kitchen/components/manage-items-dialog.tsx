import { useState, type FC } from 'react'
import { ChevronDown, History } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { KDS_DICT } from '@/i18n'

import type {
  ItemStatus,
  KDSItem,
  Lang,
  StatusHistoryEntry,
  Ticket,
} from '@/features/kitchen/types'

import { ColoredBadge } from './ticket-card'

type KdsKey = keyof (typeof KDS_DICT)['vi']
type Translate = (key: KdsKey, ...args: Array<number | string>) => string

interface ManageItemsDialogProps {
  open: boolean
  ticket: Ticket | undefined
  lang: Lang
  t: Translate
  onClose: () => void
  onAdvanceItem: (itemId: string) => void
}

const timelineBadgeStyle: Record<ItemStatus, string> = {
  placed: 'bg-secondary text-secondary-foreground',
  cancelled: 'bg-muted text-muted-foreground',
  pending: 'bg-secondary text-secondary-foreground',
  acknowledged:
    'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-400',
  preparing: 'bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400',
  ready: 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  served: 'bg-muted text-muted-foreground',
}

export const ManageItemsDialog: FC<ManageItemsDialogProps> = ({
  open,
  ticket,
  lang,
  t,
  onClose,
  onAdvanceItem,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const toggle = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const titleValue = ticket ? KDS_DICT[lang].dlg_title : undefined
  const title =
    ticket && typeof titleValue === 'function'
      ? (titleValue as unknown as (table: number, oid: string) => string)(
          ticket.table_number,
          ticket.order_id,
        )
      : ''

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="flex max-w-xl flex-col gap-0 p-0">
        {ticket && (
          <>
            <SheetHeader
              title={title}
              subtitle={
                <>
                  {lang === 'vi' ? ticket.area_name_vi : ticket.area_name_en}
                  <span className="mx-1.5">·</span>
                </>
              }
              className="pr-12"
            />
            <Separator />
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {ticket.items.map((item) => (
                <ManagedItem
                  key={item.id}
                  expanded={expanded.has(item.id)}
                  item={item}
                  lang={lang}
                  t={t}
                  onAdvance={() => onAdvanceItem(item.id)}
                  onToggle={() => toggle(item.id)}
                />
              ))}
            </div>
            <div className="flex items-center justify-end border-t bg-muted/30 px-4 py-3">
              <Button variant="outline" onClick={onClose}>
                {lang === 'vi' ? 'Đóng' : 'Close'}
              </Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

const ManagedItem: FC<{
  item: KDSItem
  expanded: boolean
  lang: Lang
  t: Translate
  onAdvance: () => void
  onToggle: () => void
}> = ({ item, expanded, lang, t, onAdvance, onToggle }) => {
  const complete = item.status === 'served'
  const name = lang === 'vi' ? item.name_vi : item.name_en
  const options = lang === 'vi' ? item.options_text_vi : item.options_text_en

  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-sm font-bold tabular-nums ${
              complete ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'
            }`}
          >
            {item.qty}
          </span>
          <div className="min-w-0">
            <div
              className={`text-base font-semibold leading-tight ${
                complete ? 'text-muted-foreground line-through' : 'text-foreground'
              }`}
            >
              {name}
              {item.is_takeaway ? (
                <Badge variant="warning" className="ml-2 rounded-full align-middle text-[10px]">
                  {t('takeaway_badge')}
                </Badge>
              ) : null}
            </div>
            {options && <div className="mt-0.5 text-sm text-muted-foreground">{options}</div>}
            {item.notes && (
              <div className="mt-1 text-[13px] italic text-amber-600 dark:text-amber-400">
                ※ {item.notes}
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
          <ColoredBadge status={item.status} t={t} />
          <Button
            size="sm"
            variant={complete ? 'secondary' : 'default'}
            disabled={complete}
            onClick={onAdvance}
          >
            {complete ? t('dlg_no_advance') : t('dlg_advance')}
          </Button>
        </div>
      </div>

      <button
        className="flex w-full cursor-pointer items-center justify-between border-t px-4 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/50"
        onClick={onToggle}
        type="button"
      >
        <span className="flex items-center gap-1.5">
          <History className="size-4" />
          {t('dlg_timeline')} ({item.status_history.length})
        </span>
        <ChevronDown className={`size-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && <Timeline history={item.status_history} lang={lang} t={t} />}
    </div>
  )
}

function historyStatusLabel(status: ItemStatus, t: Translate): string {
  return t(`hist_${status}` as KdsKey)
}

function historyRoleLabel(role: string, lang: Lang): string {
  const labels: Record<string, { vi: string; en: string }> = {
    ADMIN: { vi: 'Quản trị', en: 'Admin' },
    CASHIER: { vi: 'Thu ngân', en: 'Cashier' },
    GUEST: { vi: 'Khách', en: 'Guest' },
    KITCHEN: { vi: 'Bếp', en: 'Kitchen' },
    MANAGER: { vi: 'Quản lý', en: 'Manager' },
    STAFF: { vi: 'Nhân viên', en: 'Staff' },
    SYSTEM: { vi: 'Hệ thống', en: 'System' },
    WAITER: { vi: 'Phục vụ', en: 'Waiter' },
  }
  return labels[role.toUpperCase()]?.[lang] ?? role
}

function historyTimestamp(timestamp: Date, lang: Lang): string {
  if (Number.isNaN(timestamp.getTime())) return '—'
  return new Intl.DateTimeFormat(lang === 'vi' ? 'vi-VN' : 'en-US', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(timestamp)
}

const Timeline: FC<{
  history: StatusHistoryEntry[]
  lang: Lang
  t: Translate
}> = ({ history, lang, t }) => (
  <ol className="space-y-3 border-t bg-muted/30 px-4 py-4">
    {history.map((entry, index) => {
      const fromStatus = entry.from_status
      const toStatus = entry.to_status ?? entry.status
      const timestampISO = Number.isNaN(entry.timestamp.getTime())
        ? undefined
        : entry.timestamp.toISOString()
      const actor = [
        entry.changed_by_name,
        entry.changed_by_role && historyRoleLabel(entry.changed_by_role, lang),
      ]
        .filter(Boolean)
        .join(' · ')

      return (
        <li
          key={`${toStatus}-${timestampISO ?? 'invalid'}-${index}`}
          className="flex items-start gap-3"
        >
          <Badge
            className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full p-0 ${timelineBadgeStyle[toStatus]}`}
          >
            {index + 1}
          </Badge>
          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="text-sm font-semibold text-foreground">
                {fromStatus && fromStatus !== toStatus ? (
                  <>
                    {historyStatusLabel(fromStatus, t)}
                    <span className="mx-1.5 text-muted-foreground" aria-hidden="true">
                      →
                    </span>
                    {historyStatusLabel(toStatus, t)}
                  </>
                ) : (
                  historyStatusLabel(toStatus, t)
                )}
              </div>
              <time
                className="shrink-0 text-xs tabular-nums text-muted-foreground"
                dateTime={timestampISO}
              >
                {historyTimestamp(entry.timestamp, lang)}
              </time>
            </div>
            {actor && <div className="mt-1 break-words text-xs text-muted-foreground">{actor}</div>}
            {entry.reason && (
              <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <span className="font-semibold">{t('timeline_reason')}:</span> {entry.reason}
              </div>
            )}
            {entry.note && entry.note !== entry.reason && (
              <div className="mt-1.5 break-words text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{t('timeline_note')}:</span>{' '}
                {entry.note}
              </div>
            )}
          </div>
        </li>
      )
    })}
  </ol>
)
