import { useState, type FC } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet'
import { KDS_DICT } from '@/features/kitchen/data/i18n'
import { fmtTimestamp } from '@/features/kitchen/helpers'
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

const timelineTone: Record<ItemStatus, string> = {
  pending: 'bg-[var(--surface-grouped)] text-[var(--text-secondary)]',
  acknowledged: 'bg-[var(--system-blue)]/10 text-[var(--system-blue)]',
  preparing: 'bg-[var(--system-orange)]/10 text-[var(--system-orange)]',
  ready: 'bg-[var(--system-green)]/10 text-[var(--system-green)]',
  served: 'bg-[var(--surface-grouped)] text-[var(--text-tertiary)]',
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
      <SheetContent side="right" className="w-full max-w-3xl bg-[var(--bg-elevated)]/85" hideClose>
        {ticket && (
          <>
            <SheetHeader
              title={title}
              subtitle={`${lang === 'vi' ? ticket.area_name_vi : ticket.area_name_en} · ${fmtTimestamp(ticket.submitted_at)}`}
              className="pr-12"
            />
            <button
              className="absolute right-4 top-4 z-10 size-8 rounded-full bg-[var(--surface-grouped)] text-[var(--text-secondary)]"
              onClick={onClose}
              type="button"
            >
              ×
            </button>
            <Separator />
            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
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
            <div className="border-t border-[var(--separator)] bg-[var(--surface-grouped)]/60 px-5 py-3 text-right">
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
    <div className="overflow-hidden rounded-[16px] border border-[var(--separator)] bg-[var(--bg-elevated)]/80">
      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--text)] text-sm font-bold text-[var(--bg)] tabular-nums">
            ×{item.qty}
          </span>
          <div className="min-w-0">
            <div
              className={`text-[17px] font-semibold leading-tight ${complete ? 'text-[var(--text-tertiary)] line-through' : 'text-[var(--text)]'}`}
            >
              {name}
            </div>
            {options && (
              <div className="mt-0.5 text-sm text-[var(--text-secondary)]">{options}</div>
            )}
            {item.notes && (
              <div className="mt-1 text-[13px] italic text-[var(--system-orange)]">
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
        className="flex w-full items-center justify-between border-t border-[var(--separator)] px-4 py-2 text-left text-sm font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-grouped)]/70"
        onClick={onToggle}
        type="button"
      >
        <span>
          {t('dlg_timeline')} ({item.status_history.length})
        </span>
        <span className={`transition-transform ${expanded ? 'rotate-180' : ''}`}>⌄</span>
      </button>
      {expanded && <Timeline history={item.status_history} t={t} />}
    </div>
  )
}

const Timeline: FC<{ history: StatusHistoryEntry[]; t: Translate }> = ({ history, t }) => (
  <ol className="space-y-3 border-t border-[var(--separator)] bg-[var(--surface-grouped)]/45 px-4 py-4">
    {history.map((entry, index) => (
      <li
        key={`${entry.status}-${entry.timestamp.toISOString()}-${index}`}
        className="flex items-start gap-3"
      >
        <Badge
          className={`mt-0.5 size-7 justify-center rounded-full p-0 ${timelineTone[entry.status]}`}
        >
          {index + 1}
        </Badge>
        <div>
          <div className="font-mono text-[13px] tabular-nums text-[var(--text-secondary)]">
            {fmtTimestamp(entry.timestamp)}
          </div>
          <div className="text-[15px] font-semibold text-[var(--text)]">
            {t(`hist_${entry.status}` as KdsKey)}
          </div>
        </div>
      </li>
    ))}
  </ol>
)

export default ManageItemsDialog
