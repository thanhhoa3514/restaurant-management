import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import type { CashierSession } from '@/features/cashier/types';
import { fmtDateTime, fmtVND, providerName } from '@/features/cashier/helpers';

// Register fonts to support Vietnamese characters
Font.register({
  family: 'Roboto',
  src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/Roboto-Regular.ttf',
});
Font.register({
  family: 'Roboto-Bold',
  src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/Roboto-Bold.ttf',
});

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Roboto',
    padding: 30,
    fontSize: 10,
    color: '#1f2937', // zinc-800
    lineHeight: 1.5,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1.5,
    borderBottomColor: '#e5e7eb', // zinc-200
    paddingBottom: 15,
    marginBottom: 20,
  },
  restaurantName: {
    fontFamily: 'Roboto-Bold',
    fontSize: 16,
    color: '#dc2626', // red-600
  },
  invoiceTitle: {
    fontFamily: 'Roboto-Bold',
    fontSize: 16,
    textAlign: 'right',
    color: '#111827', // zinc-900
  },
  metaSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    fontSize: 9,
    color: '#4b5563', // zinc-600
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
    borderBottomColor: '#f3f4f6', // zinc-100
    paddingVertical: 6,
    alignItems: 'center',
  },
  tableRowHeader: {
    flexDirection: 'row',
    borderBottomWidth: 2,
    borderBottomColor: '#374151', // zinc-700
    paddingVertical: 6,
    fontFamily: 'Roboto-Bold',
    backgroundColor: '#f9fafb', // zinc-50
  },
  colName: { width: '40%', textAlign: 'left' },
  colQty: { width: '15%', textAlign: 'center' },
  colPrice: { width: '22%', textAlign: 'right' },
  colTotal: { width: '23%', textAlign: 'right' },
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
    color: '#dc2626', // red-600
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    color: '#9ca3af', // zinc-400
    fontSize: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 10,
  },
});

interface InvoicePDFProps {
  session: CashierSession;
  t: (key: string, ...args: Array<number | string>) => string;
  lang: 'vi' | 'en';
}

export const InvoicePDF = ({ session, t, lang }: InvoicePDFProps) => {
  const invoice = session.invoice;

  const methodLabel = (() => {
    const payment = session.payment;
    if (!payment) return '—';
    if (payment.method === 'cash') return t('method_cash');
    if (payment.method === 'card') return `${t('method_card')}${payment.last4 ? ` · •••• ${payment.last4}` : ''}`;
    return `${t('method_ewallet')} · ${providerName(payment.sub_method)}`;
  })();

  return (
    <Document>
      <Page size="A5" style={styles.page}>
        {/* Restaurant Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.restaurantName}>{t('restaurant')}</Text>
            <Text style={{ fontSize: 8, color: '#6b7280' }}>{t('restaurant_address')}</Text>
            <Text style={{ fontSize: 8, color: '#6b7280' }}>{t('restaurant_phone')}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={styles.invoiceTitle}>{t('receipt_title').toUpperCase()}</Text>
            <Text style={{ fontSize: 8, color: '#6b7280', marginTop: 2 }}>{invoice.number}</Text>
          </View>
        </View>

        {/* Bill Metadata */}
        <View style={styles.metaSection}>
          <View style={styles.metaCol}>
            <Text>
              <Text style={{ fontFamily: 'Roboto-Bold' }}>{t('receipt_table')}: </Text>
              {session.table_number} · {lang === 'vi' ? session.area_name_vi : session.area_name_en}
            </Text>
            <Text>
              <Text style={{ fontFamily: 'Roboto-Bold' }}>{t('receipt_cashier')}: </Text>
              {t('cashier_name')}
            </Text>
          </View>
          <View style={[styles.metaCol, { alignItems: 'flex-end' }]}>
            <Text>
              <Text style={{ fontFamily: 'Roboto-Bold' }}>{t('receipt_date')}: </Text>
              {fmtDateTime(session.payment?.completed_at ?? new Date())}
            </Text>
            <Text>
              <Text style={{ fontFamily: 'Roboto-Bold' }}>{t('receipt_method')}: </Text>
              {methodLabel}
            </Text>
          </View>
        </View>

        {/* Invoice Item Table */}
        <View style={styles.table}>
          <View style={styles.tableRowHeader}>
            <Text style={[styles.colName, { paddingLeft: 4 }]}>{t('invoice_item_name', 'Món ăn')}</Text>
            <Text style={styles.colQty}>{t('invoice_item_qty', 'SL')}</Text>
            <Text style={styles.colPrice}>{t('invoice_item_price', 'Đơn giá')}</Text>
            <Text style={[styles.colTotal, { paddingRight: 4 }]}>{t('invoice_item_total', 'Thành tiền')}</Text>
          </View>

          {invoice.items.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={[styles.colName, { paddingLeft: 4, fontFamily: 'Roboto-Bold' }]}>
                {lang === 'vi' ? item.name_snapshot_vi : item.name_snapshot_en}
              </Text>
              <Text style={styles.colQty}>{item.qty}</Text>
              <Text style={styles.colPrice}>{fmtVND(item.unit_price_snapshot)}</Text>
              <Text style={[styles.colTotal, { paddingRight: 4, fontFamily: 'Roboto-Bold' }]}>
                {fmtVND(item.line_total)}
              </Text>
            </View>
          ))}
        </View>

        {/* Summary Totals */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={{ color: '#4b5563' }}>{t('subtotal')}:</Text>
            <Text style={{ fontFamily: 'Roboto-Bold' }}>{fmtVND(invoice.subtotal)}</Text>
          </View>

          {invoice.discount ? (
            <View style={styles.totalRow}>
              <Text style={{ color: '#4b5563' }}>{t('discount')}:</Text>
              <Text style={{ color: '#dc2626', fontFamily: 'Roboto-Bold' }}>-{fmtVND(invoice.discount.amount)}</Text>
            </View>
          ) : null}

          {invoice.vat_amount > 0 ? (
            <View style={styles.totalRow}>
              <Text style={{ color: '#4b5563' }}>{t('vat')}:</Text>
              <Text style={{ fontFamily: 'Roboto-Bold' }}>{fmtVND(invoice.vat_amount)}</Text>
            </View>
          ) : null}

          <View style={[styles.totalRow, { borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 6, marginTop: 4 }]}>
            <Text style={{ fontFamily: 'Roboto-Bold', color: '#111827' }}>{t('total').toUpperCase()}:</Text>
            <Text style={styles.grandTotal}>{fmtVND(invoice.total)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>{t('receipt_thanks')}</Text>
          <Text style={{ fontSize: 6, color: '#d1d5db', marginTop: 4 }}>Powered by Smart QR System</Text>
        </View>
      </Page>
    </Document>
  );
};

export default InvoicePDF;
