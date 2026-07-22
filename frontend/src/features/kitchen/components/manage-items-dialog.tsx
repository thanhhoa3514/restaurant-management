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
      {expanded && <Timeline history={item.status_history} t={t} />}
    </div>
  )
}

const Timeline: FC<{ history: StatusHistoryEntry[]; t: Translate }> = ({ history, t }) => (
  <ol className="space-y-3 border-t bg-muted/30 px-4 py-4">
    {history.map((entry, index) => (
      <li
        key={`${entry.status}-${entry.timestamp.toISOString()}-${index}`}
        className="flex items-start gap-3"
      >
        <Badge
          className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full p-0 ${timelineBadgeStyle[entry.status]}`}
        >
          {index + 1}
        </Badge>
        <div>
          <div className="text-sm font-semibold text-foreground">
            {t(`hist_${entry.status}` as KdsKey)}
          </div>
        </div>
      </li>
    ))}
  </ol>
)
