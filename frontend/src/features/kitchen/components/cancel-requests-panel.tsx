import type { FC } from 'react'
import { AlertTriangle, Ban, Check, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { CancelRequestDTO } from '@/features/kitchen/api'
import { KDS_DICT } from '@/i18n'

type KdsKey = keyof (typeof KDS_DICT)['vi']
type Translate = (key: KdsKey, ...args: Array<number | string>) => string

interface CancelRequestsPanelProps {
  cancelRequests: CancelRequestDTO[]
  t: Translate
  onReview: (cancelRequestId: string, action: 'approve' | 'reject') => void
}

export const CancelRequestsPanel: FC<CancelRequestsPanelProps> = ({
  cancelRequests,
  t,
  onReview,
}) => {
  if (cancelRequests.length === 0) return null

  return (
    <Card className="mb-4 border-border/50 bg-background shadow-sm">
      <CardContent className="p-4 sm:p-5">
        {/* Header Section */}
        <div className="mb-4 flex items-center gap-3 sm:mb-5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-600 dark:bg-amber-500/20">
            <Ban className="size-4" />
          </div>
          <h2 className="text-base font-bold uppercase tracking-wide text-foreground sm:text-lg">
            {t('cancel_requests_title')}
          </h2>
          <Badge
            variant="warning"
            className="ml-1 flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-sm font-medium"
          >
            <AlertTriangle className="size-3.5" />
            {cancelRequests.length}
          </Badge>
        </div>

        {/* List Section */}
        <ul className="flex flex-col gap-3 sm:gap-4">
          {cancelRequests.map((cr) => (
            <li
              key={cr.id}
              className="flex flex-col gap-4 rounded-xl border border-border/40 bg-card p-3.5 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between sm:p-4"
            >
              {/* Item Info */}
              <div className="flex flex-col gap-1.5">
                <Badge
                  variant="outline"
                  className="w-fit bg-muted/50 font-mono text-xs text-muted-foreground"
                >
                  {t('table')} {cr.table_code}
                </Badge>
                <div className="text-base font-semibold text-foreground">
                  {cr.name_snapshot} <span className="text-muted-foreground">× {cr.quantity}</span>
                </div>
                {cr.reason && (
                  <div className="text-sm text-muted-foreground">
                    {t('cancel_reason')}: <span className="italic">{cr.reason}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons (Tối ưu Mobile) */}
              <div className="mt-1 flex w-full gap-2 sm:mt-0 sm:w-auto sm:shrink-0">
                <Button
                  size="sm"
                  variant="destructive"
                  className="flex-1 font-medium shadow-sm sm:flex-none"
                  onClick={() => onReview(cr.id, 'approve')}
                >
                  <Check className="mr-1.5 size-4" />
                  {t('cancel_approve')}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="flex-1 font-medium shadow-sm sm:flex-none"
                  onClick={() => onReview(cr.id, 'reject')}
                >
                  <X className="mr-1.5 size-4" />
                  {t('cancel_reject')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
