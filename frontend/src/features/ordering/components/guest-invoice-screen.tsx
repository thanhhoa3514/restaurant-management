import { type FC, useMemo } from 'react'
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'

import { useOrdering } from '../hooks/use-ordering'
import { DICT } from '../data/i18n'
import { getMenuItem } from '../data/menu'
import { formatVND } from '../helpers'
import { Button } from '../../../components/ui/button'
import { Card } from '../../../components/ui/card'
import { Separator } from '../../../components/ui/separator'

// Register Roboto fonts for Vietnamese A5 PDF rendering
Font.register({
  family: 'Roboto',
  src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/Roboto-Regular.ttf',
});
Font.register({
  family: 'Roboto-Bold',
  src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/Roboto-Bold.ttf',
});

const pdfStyles = StyleSheet.create({
  page: {
    fontFamily: 'Roboto',
    padding: 30,
    fontSize: 10,
    color: '#374151',
    lineHeight: 1.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1.5,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 15,
    marginBottom: 20,
  },
  restaurantName: {
    fontFamily: 'Roboto-Bold',
    fontSize: 16,
    color: '#dc2626',
  },
  invoiceTitle: {
    fontFamily: 'Roboto-Bold',
    fontSize: 16,
    textAlign: 'right',
    color: '#111827',
  },
  metaSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    fontSize: 9,
    color: '#4b5563',
  },
  metaCol: {
    flexDirection: 'column',
    gap: 2,
  },
  table: {
    width: 'auto',
    marginVertical: 10,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    paddingVertical: 6,
    alignItems: 'center',
  },
  tableRowHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#374151',
    paddingVertical: 6,
    fontFamily: 'Roboto-Bold',
    backgroundColor: '#f9fafb',
  },
  colName: { width: '45%', textAlign: 'left' },
  colQty: { width: '15%', textAlign: 'center' },
  colPrice: { width: '20%', textAlign: 'right' },
  colTotal: { width: '20%', textAlign: 'right' },
  totalsSection: {
    marginTop: 20,
    alignSelf: 'flex-end',
    width: '45%',
    borderTopWidth: 1.5,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
    gap: 4,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  grandTotal: {
    fontFamily: 'Roboto-Bold',
    fontSize: 13,
    color: '#dc2626',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 10,
  },
});

interface GuestPDFProps {
  restaurantName: string;
  tableName: string;
  date: string;
  items: Array<{ name: string; qty: number; price: number }>;
  total: number;
  vat: number;
  grandTotal: number;
  lang: 'vi' | 'en';
  invoiceNumber: number;
}

const GuestInvoicePDF = ({
  restaurantName,
  tableName,
  date,
  items,
  total,
  vat,
  grandTotal,
  lang,
  invoiceNumber,
}: GuestPDFProps) => {
  return (
    <Document>
      <Page size="A5" style={pdfStyles.page}>
        <View style={pdfStyles.header}>
          <View>
            <Text style={pdfStyles.restaurantName}>{restaurantName}</Text>
            <Text style={{ fontSize: 7, color: '#6b7280' }}>Hóa đơn điện tử thông minh</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={pdfStyles.invoiceTitle}>{lang === 'vi' ? 'HÓA ĐƠN ĐIỆN TỬ' : 'E-INVOICE'}</Text>
            <Text style={{ fontSize: 7, color: '#6b7280', marginTop: 2 }}>#{invoiceNumber}</Text>
          </View>
        </View>

        <View style={pdfStyles.metaSection}>
          <View style={pdfStyles.metaCol}>
            <Text style={{ fontFamily: 'Roboto-Bold' }}>{lang === 'vi' ? 'Bàn ăn:' : 'Table:'} {tableName}</Text>
            <Text>{lang === 'vi' ? 'Phương thức: Chuyển khoản' : 'Method: Bank Transfer'}</Text>
          </View>
          <View style={[pdfStyles.metaCol, { alignItems: 'flex-end' }]}>
            <Text>{lang === 'vi' ? 'Thời gian xuất:' : 'Issued Date:'} {date}</Text>
            <Text>{lang === 'vi' ? 'Trạng thái: Đã thanh toán' : 'Status: Paid'}</Text>
          </View>
        </View>

        <View style={pdfStyles.table}>
          <View style={pdfStyles.tableRowHeader}>
            <Text style={[pdfStyles.colName, { paddingLeft: 4 }]}>{lang === 'vi' ? 'Món ăn' : 'Item'}</Text>
            <Text style={pdfStyles.colQty}>{lang === 'vi' ? 'SL' : 'Qty'}</Text>
            <Text style={pdfStyles.colPrice}>{lang === 'vi' ? 'Đơn giá' : 'Price'}</Text>
            <Text style={[pdfStyles.colTotal, { paddingRight: 4 }]}>{lang === 'vi' ? 'Thành tiền' : 'Total'}</Text>
          </View>

          {items.map((item, index) => (
            <View key={index} style={pdfStyles.tableRow}>
              <Text style={[pdfStyles.colName, { paddingLeft: 4, fontFamily: 'Roboto-Bold' }]}>{item.name}</Text>
              <Text style={pdfStyles.colQty}>{item.qty}</Text>
              <Text style={pdfStyles.colPrice}>{formatVND(item.price)}</Text>
              <Text style={[pdfStyles.colTotal, { paddingRight: 4, fontFamily: 'Roboto-Bold' }]}>{formatVND(item.price * item.qty)}</Text>
            </View>
          ))}
        </View>

        <View style={pdfStyles.totalsSection}>
          <View style={pdfStyles.totalRow}>
            <Text style={{ color: '#4b5563' }}>{lang === 'vi' ? 'Tạm tính' : 'Subtotal'}:</Text>
            <Text style={{ fontFamily: 'Roboto-Bold' }}>{formatVND(total)}</Text>
          </View>
          <View style={pdfStyles.totalRow}>
            <Text style={{ color: '#4b5563' }}>{lang === 'vi' ? 'Thuế VAT (10%)' : 'VAT (10%)'}:</Text>
            <Text style={{ fontFamily: 'Roboto-Bold' }}>{formatVND(vat)}</Text>
          </View>
          <View style={[pdfStyles.totalRow, { borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 6, marginTop: 4 }]}>
            <Text style={{ fontFamily: 'Roboto-Bold', color: '#111827' }}>{lang === 'vi' ? 'TỔNG CỘNG' : 'GRAND TOTAL'}:</Text>
            <Text style={pdfStyles.grandTotal}>{formatVND(grandTotal)}</Text>
          </View>
        </View>

        <View style={pdfStyles.footer}>
          <Text>{lang === 'vi' ? 'Cảm ơn quý khách và Hẹn gặp lại!' : 'Thank you and See you again!'}</Text>
          <Text style={{ fontSize: 5, color: '#d1d5db', marginTop: 4 }}>Powered by Smart Restaurant QR System</Text>
        </View>
      </Page>
    </Document>
  );
};

export const GuestInvoiceScreen: FC = () => {
  const { state, dispatch } = useOrdering()
  const t = DICT[state.lang]

  const { total, vat, grandTotal, invoiceItems } = useMemo(() => {
    let subtotal = 0
    const itemsList: Array<{ name: string; qty: number; price: number }> = []

    state.orders.forEach((order) => {
      order.items.forEach((item) => {
        const menuItem = getMenuItem(item.itemId)
        if (menuItem) {
          const name = state.lang === 'vi' ? menuItem.name.vi : menuItem.name.en
          subtotal += item.unitPrice * item.qty
          itemsList.push({
            name,
            qty: item.qty,
            price: item.unitPrice,
          })
        }
      })
    })

    return {
      total: subtotal,
      vat: subtotal * 0.1,
      grandTotal: subtotal * 1.1,
      invoiceItems: itemsList,
    }
  }, [state.orders, state.lang])

  const handleFinish = () => {
    // Clear cart and session, then redirect to landing page
    dispatch({ type: 'CLEAR_CART' })
    dispatch({ type: 'SET_SCREEN', payload: 'qr' })
  }

  const currentDateString = useMemo(() => fmtDateTime(new Date()), [])
  const invoiceNumber = useMemo(() => Math.floor(100000 + Math.random() * 900000), [])

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--material-thick)]/30">
      <header className="sticky top-0 z-sticky bg-background/80 backdrop-blur-xl border-b border-separator px-4 pt-4 pb-3 text-center">
        <h1 className="text-lg font-bold text-system-green">
          {state.lang === 'vi' ? 'Thanh Toán Thành Công!' : 'Payment Successful!'}
        </h1>
        <p className="text-xs text-tertiary mt-0.5">
          {state.lang === 'vi' ? 'Hóa đơn điện tử của bạn đã sẵn sàng' : 'Your e-invoice is ready'}
        </p>
      </header>

      <div className="flex-1 px-4 py-6 flex flex-col gap-5 overflow-y-auto">
        {/* Success Visual Card */}
        <Card className="border border-separator bg-elevated/70 shadow-lg p-5 text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-system-green/10 text-2xl text-system-green animate-bounce">
            ✓
          </div>
          <h2 className="mt-3 text-base font-bold text-primary">
            {state.lang === 'vi' ? 'Hóa Đơn Số Bàn' : 'Table Bill'} {state.session?.table}
          </h2>
          <p className="text-xs text-tertiary mt-1">
            {state.lang === 'vi' ? 'Cảm ơn quý khách đã tin dùng và lựa chọn nhà hàng chúng tôi.' : 'Thank you for choosing our restaurant.'}
          </p>
        </Card>

        {/* Invoice Summary Details */}
        <Card className="border border-separator bg-elevated/70 shadow-lg p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-tertiary mb-3">
            {state.lang === 'vi' ? 'TÓM TẮT HÓA ĐƠN' : 'BILL SUMMARY'}
          </h3>
          <div className="space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-secondary">{t.subtotal}</span>
              <span className="font-semibold text-primary tabular-nums">{formatVND(total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-secondary">{t.vat}</span>
              <span className="font-semibold text-primary tabular-nums">{formatVND(vat)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-base font-bold">
              <span className="text-primary">{t.total.toUpperCase()}</span>
              <span className="text-system-blue tabular-nums">{formatVND(grandTotal)}</span>
            </div>
          </div>
        </Card>

        {/* PDF Download Section */}
        <PDFDownloadLink
          document={
            <GuestInvoicePDF
              restaurantName={state.lang === 'vi' ? 'QUÁN CƠM TẤM SÀI GÒN' : 'SAIGON BROKEN RICE'}
              tableName={`${state.session?.table}`}
              date={currentDateString}
              items={invoiceItems}
              total={total}
              vat={vat}
              grandTotal={grandTotal}
              lang={state.lang}
              invoiceNumber={invoiceNumber}
            />
          }
          fileName={`Hoa_Don_Dien_Tu_Ban_${state.session?.table}.pdf`}
        >
          {({ loading }) => (
            <Button className="w-full h-14 rounded-xl font-bold flex items-center justify-center cursor-pointer shadow-lg" disabled={loading}>
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="mr-2 h-5 w-5 animate-spin text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  {state.lang === 'vi' ? 'Đang chuẩn bị PDF...' : 'Preparing PDF...'}
                </span>
              ) : (
                <>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="mr-2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                  </svg>
                  {state.lang === 'vi' ? 'Tải Hóa Đơn Điện Tử (A5 PDF)' : 'Download E-Invoice (A5 PDF)'}
                </>
              )}
            </Button>
          )}
        </PDFDownloadLink>
      </div>

      <div className="sticky bottom-0 px-4 py-4 bg-background/80 backdrop-blur-xl border-t border-separator">
        <Button variant="secondary" className="w-full h-12 rounded-xl font-bold cursor-pointer" onClick={handleFinish}>
          {state.lang === 'vi' ? 'Hoàn Tất dùng bữa' : 'Finish Session'}
        </Button>
      </div>
    </div>
  )
}

function fmtDateTime(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default GuestInvoiceScreen
