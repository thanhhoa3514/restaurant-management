import { useEffect, useMemo } from 'react'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import type { CashierSession } from '@/features/cashier/types'
import { activeInvoice } from '@/features/cashier/helpers'
import { errorMessage } from '@/lib/api'
import { InvoicePDF } from './invoice-pdf'

interface LazyPDFLinkProps {
  session: CashierSession
  t: (key: string, ...args: Array<number | string>) => string
  lang: 'vi' | 'en'
}

export default function LazyPDFLink({ session, t, lang }: LazyPDFLinkProps) {
  const invoice = activeInvoice(session)
  const document = useMemo(
    () => <InvoicePDF session={session} t={t} lang={lang} />,
    [session, t, lang],
  )
  return (
    <PDFDownloadLink
      document={document}
      fileName={`Hoa_Don_${invoice.number}.pdf`}
      className="flex-1"
    >
      {({ loading, error }) => <PDFDownloadState loading={loading} error={error} t={t} />}
    </PDFDownloadLink>
  )
}

function PDFDownloadState({
  loading,
  error,
  t,
}: {
  loading: boolean
  error: Error | null
  t: LazyPDFLinkProps['t']
}) {
  useEffect(() => {
    if (!error) return
    toast.error(errorMessage(error, t('toast_pdf_failed')), {
      id: 'cashier-pdf-error',
    })
  }, [error, t])

  return (
    <Button
      className="w-full rounded-[var(--radius-lg)] cursor-pointer"
      disabled={loading || !!error}
    >
      {loading ? (
        <span className="flex items-center justify-center">
          <Loader2 className="animate-spin mr-2 h-4 w-4 text-current" />
          {t('loading_pdf', 'Đang tải...')}
        </span>
      ) : (
        t('export_pdf', 'Xuất PDF')
      )}
    </Button>
  )
}
