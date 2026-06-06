import { PDFDownloadLink } from '@react-pdf/renderer'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import type { CashierSession } from '@/features/cashier/types'
import { InvoicePDF } from './invoice-pdf'

interface LazyPDFLinkProps {
  session: CashierSession
  t: (key: string, ...args: Array<number | string>) => string
  lang: 'vi' | 'en'
}

export default function LazyPDFLink({ session, t, lang }: LazyPDFLinkProps) {
  const invoice = session.invoice
  return (
    <PDFDownloadLink
      document={<InvoicePDF session={session} t={t} lang={lang} />}
      fileName={`Hoa_Don_${invoice.number}.pdf`}
      className="flex-1"
    >
      {({ loading }) => (
        <Button className="w-full rounded-[var(--radius-lg)] cursor-pointer" disabled={loading}>
          {loading ? (
            <span className="flex items-center justify-center">
              <Spinner className="mr-2 h-4 w-4 text-current" />
              {t('loading_pdf', 'Đang tải...')}
            </span>
          ) : (
            t('export_pdf', 'Xuất PDF')
          )}
        </Button>
      )}
    </PDFDownloadLink>
  )
}
