/* eslint-disable react-doctor/prefer-dynamic-import */
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import type { Ticket } from '@/features/kitchen/types'
import { fmtHMS } from '@/features/kitchen/helpers'

Font.register({
  family: 'Roboto',
  src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/Roboto-Regular.ttf',
})
Font.register({
  family: 'Roboto-Bold',
  src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/Roboto-Bold.ttf',
})

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Roboto',
    padding: 20,
    fontSize: 10,
    color: '#1f2937',
    lineHeight: 1.4,
  },
  header: {
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#111827',
    paddingBottom: 10,
    marginBottom: 12,
  },
  restaurantName: {
    fontFamily: 'Roboto-Bold',
    fontSize: 14,
    color: '#dc2626',
  },
  ticketTitle: {
    fontFamily: 'Roboto-Bold',
    fontSize: 13,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    fontSize: 9,
    color: '#4b5563',
  },
  tableInfo: {
    fontFamily: 'Roboto-Bold',
    fontSize: 12,
    color: '#111827',
    marginBottom: 8,
  },
  dashed: {
    borderBottomWidth: 1,
    borderBottomColor: '#9ca3af',
    borderStyle: 'dashed',
    marginVertical: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  itemQty: {
    width: '10%',
    fontFamily: 'Roboto-Bold',
    fontSize: 11,
  },
  itemName: {
    width: '60%',
    fontSize: 10,
  },
  itemStatus: {
    width: '30%',
    fontSize: 8,
    textAlign: 'right',
    color: '#6b7280',
  },
  notes: {
    fontSize: 9,
    color: '#d97706',
    marginTop: 2,
    paddingLeft: '10%',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 8,
  },
})

interface KitchenTicketPDFProps {
  ticket: Ticket
  now: Date
  lang: 'vi' | 'en'
}

export function KitchenTicketPDF({ ticket, now, lang }: KitchenTicketPDFProps) {
  const waitSec = Math.max(0, Math.floor((now.getTime() - ticket.submitted_at.getTime()) / 1_000))
  const areaName = lang === 'vi' ? ticket.area_name_vi : ticket.area_name_en
  const submittedStr = ticket.submitted_at.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US')

  return (
    <Document>
      <Page size="A5" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.restaurantName}>LẨU NƯỚNG MEN</Text>
          <Text style={styles.ticketTitle}>Kitchen Ticket</Text>
        </View>

        <View style={styles.metaRow}>
          <Text>Table: {ticket.table_number}</Text>
          <Text>{areaName}</Text>
        </View>

        <View style={styles.metaRow}>
          <Text>Order: {ticket.order_id.slice(0, 8)}</Text>
          <Text>Wait: {fmtHMS(waitSec)}</Text>
        </View>

        <Text style={{ fontSize: 8, color: '#6b7280', marginBottom: 4 }}>{submittedStr}</Text>

        <View style={styles.dashed} />

        {ticket.items.map((item) => {
          const name = lang === 'vi' ? item.name_vi : item.name_en
          const options = lang === 'vi' ? item.options_text_vi : item.options_text_en
          return (
            <View key={item.id}>
              <View style={styles.itemRow}>
                <Text style={styles.itemQty}>x{item.qty}</Text>
                <Text style={styles.itemName}>{name}</Text>
                <Text style={styles.itemStatus}>{item.status}</Text>
              </View>
              {options ? (
                <Text
                  style={{ fontSize: 8, color: '#6b7280', paddingLeft: '10%', paddingBottom: 2 }}
                >
                  {options}
                </Text>
              ) : null}
              {item.notes ? <Text style={styles.notes}>Note: {item.notes}</Text> : null}
            </View>
          )
        })}

        <View style={styles.dashed} />
        <Text style={{ fontSize: 9, textAlign: 'center', marginTop: 8, color: '#6b7280' }}>
          {ticket.items.length} item(s)
        </Text>

        <Text style={styles.footer}>LẨU NƯỚNG MEN - Kitchen Ticket</Text>
      </Page>
    </Document>
  )
}
