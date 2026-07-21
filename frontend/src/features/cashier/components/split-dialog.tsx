import { useMemo, useState, type FC } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { fmtVND } from '@/features/cashier/helpers'
import { cn } from '@/lib/utils'
import type { CashierSession, Lang, LineItem } from '@/features/cashier/types'

interface SplitDialogProps {
  open: boolean
  session: CashierSession | null
  lang: Lang
  t: (key: string, ...args: Array<number | string>) => string
  onOpenChange: (open: boolean) => void
  onConfirm: (groups: { label: string; order_item_ids: string[] }[]) => void
}

function billableItems(session: CashierSession | null): LineItem[] {
  if (!session) return []
  const seen = new Set<string>()
  const items: LineItem[] = []
  for (const invoice of session.invoices) {
    for (const item of invoice.items) {
      if (seen.has(item.id)) continue
      seen.add(item.id)
      items.push(item)
    }
  }
  return items
}

const GROUP_TONES = [
  'bg-[var(--system-blue)] text-white',
  'bg-[var(--system-orange)] text-white',
  'bg-[var(--system-green)] text-white',
  'bg-[var(--system-purple)] text-white',
  'bg-[var(--system-red)] text-white',
  'bg-[var(--system-pink)] text-white',
]

export const SplitDialog: FC<SplitDialogProps> = ({ open, session, lang, t, onOpenChange, onConfirm }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-full max-w-lg gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="gap-1 border-b border-[var(--separator)] p-5 pb-4">
          <DialogTitle className="text-lg font-bold text-[var(--text)]">
            {t('split_dialog_title')}
            {session ? <span className="ml-2 font-normal text-[var(--text-tertiary)]">· {t('table')} {session.table_label}</span> : null}
          </DialogTitle>
          <DialogDescription>{t('split_hint')}</DialogDescription>
        </DialogHeader>

        {open ? (
          <SplitDialogBody key={session?.id} session={session} lang={lang} t={t} onOpenChange={onOpenChange} onConfirm={onConfirm} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

const SplitDialogBody: FC<Omit<SplitDialogProps, 'open'>> = ({ session, lang, t, onOpenChange, onConfirm }) => {
  const items = useMemo(() => billableItems(session), [session])
  const [groupCount, setGroupCount] = useState(2)
  const [assignment, setAssignment] = useState<Record<string, number>>({})

  const groupLabels = Array.from({ length: groupCount }, (_, i) => t('split_group_label', i + 1))
  const groupOf = (itemId: string) => assignment[itemId] ?? 0
  const counts = groupLabels.map((_, idx) => items.filter((item) => groupOf(item.id) === idx).length)
  const valid = groupCount >= 2 && counts.every((c) => c > 0)

  return (
    <>
      <div className="max-h-[calc(85vh-9rem)] space-y-4 overflow-y-auto p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-[var(--text)]">{t('split_groups')}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="icon-sm"
              className="rounded-full"
              disabled={groupCount <= 2}
              onClick={() => {
                const removedIdx = groupCount - 1
                setAssignment((current) => {
                  const next = { ...current }
                  for (const [id, idx] of Object.entries(next)) {
                    if (idx === removedIdx) next[id] = 0
                  }
                  return next
                })
                setGroupCount((n) => n - 1)
              }}
            >
              −
            </Button>
            <span className="w-4 text-center text-sm font-bold tabular-nums text-[var(--text)]">{groupCount}</span>
            <Button
              variant="secondary"
              size="icon-sm"
              className="rounded-full"
              disabled={groupCount >= GROUP_TONES.length}
              onClick={() => setGroupCount((n) => n + 1)}
            >
              +
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {items.map((item) => {
            const active = groupOf(item.id)
            return (
              <div
                key={item.id}
                className="rounded-[var(--radius-lg)] border border-[var(--separator)] bg-[var(--material-regular)] p-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-[var(--text)]">
                    {lang === 'vi' ? item.name_snapshot_vi : item.name_snapshot_en}
                  </div>
                  <div className="text-xs text-[var(--text-tertiary)]">
                    {item.qty} × {fmtVND(item.unit_price_snapshot)}
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {groupLabels.map((label, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAssignment((current) => ({ ...current, [item.id]: idx }))}
                      className={cn(
                        'rounded-full px-3 py-1 text-xs font-semibold transition-colors',
                        idx === active
                          ? GROUP_TONES[idx % GROUP_TONES.length]
                          : 'bg-[var(--surface-grouped)] text-[var(--text-secondary)] hover:bg-[var(--surface-grouped)]/70',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          {items.length === 0 ? (
            <p className="p-3 text-center text-sm text-[var(--text-tertiary)]">{t('split_no_items')}</p>
          ) : null}
        </div>

        {!valid && items.length > 0 ? (
          <p className="text-xs text-[var(--system-red)]">{t('split_invalid_empty_group')}</p>
        ) : null}
      </div>

      <Separator />

      <div className="flex gap-2 p-5 pt-4">
        <Button variant="secondary" className="flex-1 rounded-[var(--radius-lg)]" onClick={() => onOpenChange(false)}>
          {t('cancel')}
        </Button>
        <Button
          className="flex-1 rounded-[var(--radius-lg)]"
          disabled={!valid || items.length === 0}
          onClick={() =>
            onConfirm(
              groupLabels.map((label, idx) => ({
                label,
                order_item_ids: items.filter((item) => groupOf(item.id) === idx).map((item) => item.id),
              })),
            )
          }
        >
          {t('split_confirm')}
        </Button>
      </div>
    </>
  )
}
