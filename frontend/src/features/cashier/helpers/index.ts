import type { CashierSession, Invoice, SubMethod } from '../types'

export function fmtVND(amount: number): string {
  const sign = amount < 0 ? '-' : ''
  const v = Math.abs(Math.round(amount)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return sign + v + 'đ'
}

export function fmtClock(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function fmtClockSec(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

function fmtDate(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export function fmtDateTime(d: Date): string {
  return fmtDate(d) + ' ' + fmtClock(d)
}

export function fmtHMS(seconds: number | null): string {
  if (seconds == null) return ''
  seconds = Math.max(0, Math.floor(seconds))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function makeTxnId(date: Date = new Date()): string {
  const d = date
  const ds = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const rand = Math.floor(1000 + Math.random() * 9000)
  return `TXN-${ds}-${rand}`
}

export function providerName(id: SubMethod): string {
  const names: Record<SubMethod, string> = {
    cash: 'Cash',
    card: 'Card',
    momo: 'Momo',
    zalopay: 'ZaloPay',
    vnpay: 'VNPay',
    mock: 'Mock Wallet',
  }
  return names[id] ?? id
}

export function activeInvoice(session: CashierSession): Invoice {
  return session.invoices.find((inv) => inv.id === session.activeInvoiceId) ?? session.invoices[0]
}

export function itemsCount(session: CashierSession): number {
  return session.invoices.reduce(
    (sum, inv) => sum + inv.orders.reduce((s, o) => s + o.items.reduce((s2, it) => s2 + it.qty, 0), 0),
    0,
  )
}

export function sessionTotal(session: CashierSession): number {
  return session.invoices.reduce((sum, inv) => sum + inv.total, 0)
}

export function paidCount(session: CashierSession): { paid: number; total: number } {
  return {
    paid: session.invoices.filter((inv) => inv.status === 'PAID').length,
    total: session.invoices.length,
  }
}


