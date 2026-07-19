import type { FC } from 'react'
import { Ban, Check, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { CancelRequestDTO } from '@/features/kitchen/api'
import { KDS_DICT } from '@/features/kitchen/data/i18n'

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
  return (
    <Card className="mb-4 border-amber-500/40 bg-amber-500/5">
      <CardContent className="py-4">
        <div className="mb-3 flex items-center gap-2 font-semibold">
          <Ban className="size-4 text-amber-600" />
          <span>{t('cancel_requests_title')}</span>
          {cancelRequests.length > 0 && (
            <Badge variant="warning" className="min-w-5 px-1.5 text-center tabular-nums">
              {cancelRequests.length}
            </Badge>
          )}
        </div>
        {cancelRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('no_cancel_requests')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {cancelRequests.map((cr) => (
              <li
                key={cr.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-card px-3 py-2"
              >
                <Badge variant="outline" className="font-mono">
                  {t('table')} {cr.table_code}
                </Badge>
                <span className="font-medium">
                  {cr.name_snapshot} × {cr.quantity}
                </span>
                {cr.reason && (
                  <span className="text-sm text-muted-foreground">
                    {t('cancel_reason')}: {cr.reason}
                  </span>
                )}
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="destructive" onClick={() => onReview(cr.id, 'approve')}>
                    <Check className="size-4" />
                    {t('cancel_approve')}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => onReview(cr.id, 'reject')}>
                    <X className="size-4" />
                    {t('cancel_reject')}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
