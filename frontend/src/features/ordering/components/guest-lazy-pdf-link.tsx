/* eslint-disable react-doctor/prefer-dynamic-import */
import { useMemo } from 'react'
import { PDFDownloadLink, Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { Download } from 'lucide-react'
import { formatVND } from '../helpers'

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
            <Text style={{ fontSize: 12, color: '#6b7280' }}>Hóa đơn điện tử thông minh</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={pdfStyles.invoiceTitle}>{lang === 'vi' ? 'HÓA ĐƠN ĐIỆN TỬ' : 'E-INVOICE'}</Text>
            <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>#{invoiceNumber}</Text>
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

          {items.map((item) => (
            <View key={item.name} style={pdfStyles.tableRow}>
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
          <Text style={{ fontSize: 12, color: '#d1d5db', marginTop: 4 }}>Powered by Smart Restaurant QR System</Text>
        </View>
      </Page>
    </Document>
  );
};

export default function GuestLazyPDFLink({ pdfProps }: { pdfProps: GuestPDFProps }) {
  const documentProps = useMemo(() => <GuestInvoicePDF {...pdfProps} />, [pdfProps]);
  return (
    <PDFDownloadLink
      document={documentProps}
      fileName={`Hoa_Don_Dien_Tu_Ban_${pdfProps.tableName}.pdf`}
    >
      {({ loading }) => (
        <Button className="w-full h-14 rounded-xl font-bold flex items-center justify-center cursor-pointer shadow-lg" disabled={loading}>
          {loading ? (
            <span className="flex items-center justify-center">
              <Loader2 className="animate-spin mr-2 h-5 w-5 text-current" />
              {pdfProps.lang === 'vi' ? 'Đang chuẩn bị PDF...' : 'Preparing PDF...'}
            </span>
          ) : (
            <>
              <Download size={20} className="mr-2" />
              {pdfProps.lang === 'vi' ? 'Tải Hóa Đơn Điện Tử (A5 PDF)' : 'Download E-Invoice (A5 PDF)'}
            </>
          )}
        </Button>
      )}
    </PDFDownloadLink>
  )
}
