/* eslint-disable react-doctor/prefer-dynamic-import */
import { lazy, Suspense, useMemo } from 'react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { Button } from '@/components/ui/button'
import { Printer } from 'lucide-react'
import type { Ticket } from '@/features/kitchen/types'
import type { KDS_DICT } from '@/features/kitchen/data/i18n'

type KdsKey = keyof (typeof KDS_DICT)['vi']
type Translate = (key: KdsKey, ...args: Array<number | string>) => string

const LazyKitchenPDF = lazy(() => import('./kitchen-ticket-pdf').then((m) => ({ default: m.KitchenTicketPDF })))

interface TicketPrintButtonProps {
  ticket: Ticket
  now: Date
  lang: 'vi' | 'en'
  t: Translate
}

export function TicketPrintButton({ ticket, now, lang, t }: TicketPrintButtonProps) {
  const document = useMemo(
    () => (
      <Suspense fallback={null}>
        <LazyKitchenPDF ticket={ticket} now={now} lang={lang} />
      </Suspense>
    ),
    [ticket, now, lang],
  )

  return (
    <PDFDownloadLink document={document} fileName={`kitchen-ticket-${ticket.order_id.slice(0, 8)}.pdf`}>
      {({ loading }) => (
        <Button variant="outline" className="w-full" size="sm" disabled={loading}>
          <Printer className="mr-1.5 size-4" />
          {loading ? '...' : t('print_ticket' as KdsKey)}
        </Button>
      )}
    </PDFDownloadLink>
  )
}
