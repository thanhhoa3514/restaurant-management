import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, use, useEffect, useMemo, useReducer, type ReactNode } from 'react'
import { toast } from 'sonner'

import {
  listSessionInvoices,
  type BillingInvoiceDTO,
  type BillingPaymentDTO,
} from '@/features/billing/api'
import { CS_DICT } from '@/i18n'
import { activeInvoice, fmtVND, makeTxnId } from '@/features/cashier/helpers'
import { fetchStaffTables } from '@/features/waiter/api'
import { useCreateInvoice } from '@/features/cashier/mutations/useCreateInvoice'
import { useAdjustInvoice } from '@/features/cashier/mutations/useAdjustInvoice'
import { useProcessPayment } from '@/features/cashier/mutations/useProcessPayment'
import { useProcessPartialPayment } from '@/features/cashier/mutations/useProcessPartialPayment'
import { useSplitInvoice } from '@/features/cashier/mutations/useSplitInvoice'
import { useVoidInvoice } from '@/features/cashier/mutations/useVoidInvoice'
import { useCloseDiningSession } from '@/features/cashier/mutations/useCloseDiningSession'
import { toCashierSessions, toInvoiceItem } from '@/features/cashier/helpers/mappers'
import type {
  CashierSession,
  DiscountRecord,
  Invoice,
  Lang,
  Order,
  PaymentMethod,
  PaymentRecord,
  SubMethod,
} from '@/features/cashier/types'

export interface CashierState {
  sessions: CashierSession[]
  selectedSessionId: string | null
  now: Date
  timeMultiplier: number
  paused: boolean
  lang: Lang
}

export type CashierAction =
  | { type: 'replaceSessions'; sessions: CashierSession[] }
  | { type: 'selectSession'; sessionId: string | null }
  | { type: 'selectInvoice'; sessionId: string; invoiceId: string }
  | {
      type: 'replaceInvoice'
      sessionId: string
      invoice: BillingInvoiceDTO
      discountAction?: 'applied' | 'removed'
      at?: Date
    }
  | { type: 'replaceInvoices'; sessionId: string; invoices: BillingInvoiceDTO[]; at?: Date }
  | { type: 'injectBill'; sessionId?: string; at?: Date }
  | { type: 'resetAll'; now?: Date }
  | { type: 'applyDiscount'; sessionId: string; amount: number; reason: string; at?: Date }
  | { type: 'removeDiscount'; sessionId: string; at?: Date }
  | {
      type: 'startPayment'
      sessionId: string
      method: PaymentMethod
      subMethod: SubMethod
      transactionId?: string
      at?: Date
    }
  | {
      type: 'completePayment'
      sessionId: string
      method?: PaymentMethod
      subMethod?: SubMethod
      transactionId?: string
      amountTendered?: number | null
      change?: number | null
      last4?: string | null
      bank?: string | null
      at?: Date
    }
  | { type: 'failPayment'; sessionId: string; at?: Date }
  | { type: 'closeSession'; sessionId: string }
  | { type: 'splitSession'; sessionId: string; groups: { label: string; order_item_ids: string[] }[] }
  | {
      type: 'addPartialPayment'
      sessionId: string
      method: PaymentMethod
      subMethod: SubMethod
      amount: number
      transactionId?: string
      at?: Date
    }
  | { type: 'tick'; seconds: number }
  | { type: 'setPaused'; paused: boolean }
  | { type: 'setTimeMultiplier'; value: number }
  | { type: 'setLang'; lang: Lang }

type DictValue = string | ((...args: never[]) => string)
type TFunction = (key: string, ...args: Array<number | string>) => string

interface CashierContextValue {
  state: CashierState
  dispatch: React.Dispatch<CashierAction>
  selectedSession: CashierSession | null
  t: TFunction
}

const CASHIER_QUERY_KEY = ['cashier', 'sessions'] as const
const STAFF_TABLES_QUERY_KEY = ['staff', 'tables'] as const

const initialNow = new Date()

function createInitialState(now: Date = initialNow): CashierState {
  return {
    sessions: [],
    selectedSessionId: null,
    now,
    timeMultiplier: 1,
    paused: true,
    lang: (localStorage.getItem('rest_lang_cashier') as Lang) || 'vi',
  }
}

function updateSession(
  sessions: CashierSession[],
  sessionId: string,
  updater: (session: CashierSession) => CashierSession,
): CashierSession[] {
  return sessions.map((session) => (session.id === sessionId ? updater(session) : session))
}

function updateActiveInvoice(
  session: CashierSession,
  updater: (invoice: Invoice) => Invoice,
): CashierSession {
  const invoice = activeInvoice(session)
  if (!invoice) return session
  return {
    ...session,
    invoices: session.invoices.map((inv) => (inv === invoice ? updater(inv) : inv)),
  }
}

function subMethodFromCode(code: string): SubMethod {
  return (['cash', 'card', 'momo', 'zalopay', 'vnpay', 'mock'].includes(code) ? code : 'momo') as SubMethod
}

function paymentRecordFromDTO(payment: BillingPaymentDTO, previous?: PaymentRecord | null): PaymentRecord {
  const method: PaymentMethod =
    payment.method_code === 'cash' ? 'cash' : payment.method_code === 'card' ? 'card' : 'ewallet'
  return {
    method,
    sub_method: subMethodFromCode(payment.method_code),
    status: payment.status.toLowerCase() as PaymentRecord['status'],
    transaction_id: payment.reference_code || payment.payment_number,
    initiated_at:
      previous?.initiated_at ??
      (payment.processed_at ? new Date(payment.processed_at) : new Date()),
    completed_at: payment.processed_at ? new Date(payment.processed_at) : null,
    amount_tendered: payment.received_amount_vnd,
    change: payment.change_amount_vnd,
    last4: previous?.last4 ?? null,
    bank: previous?.bank ?? null,
    pay_url: payment.pay_url,
    deeplink: payment.deeplink,
    qr_code_url: payment.qr_code_url,
  }
}

function paymentFromDTO(
  payment: BillingPaymentDTO | null,
  previous: PaymentRecord | null,
): PaymentRecord | null {
  if (!payment) return previous?.status === 'pending' ? previous : null
  return paymentRecordFromDTO(payment, previous)
}

function discountFromDTO(invoice: BillingInvoiceDTO, at: Date): DiscountRecord | null {
  if (invoice.discount_amount_vnd <= 0) return null
  return {
    amount: invoice.discount_amount_vnd,
    reason: invoice.discount_reason ?? '',
    applied_by: String(CS_DICT.vi.cashier_name),
    applied_at: at,
    action: 'applied',
  }
}

// isSplit: once a session has >1 invoice, each invoice's items/orders come straight from its
// own DTO (server already partitioned them). While there's only 1 invoice we keep the existing
// mapper-derived items/orders untouched — zero behavior change for the common unsplit case.
function mergeInvoiceDTO(
  existing: Invoice | undefined,
  dto: BillingInvoiceDTO,
  discount: DiscountRecord | null,
  discountHistory: DiscountRecord[],
  isSplit: boolean,
  at: Date,
): Invoice {
  const items = isSplit ? dto.items.map(toInvoiceItem) : (existing?.items ?? [])
  const orders: Order[] = isSplit
    ? [{ id: dto.id, submitted_at: existing?.created_at ?? at, items }]
    : (existing?.orders ?? [])
  const allPayments: PaymentRecord[] = (dto.payments ?? []).map((p) => paymentRecordFromDTO(p))
  const paidAmount = dto.paid_amount_vnd
  const remaining = Math.max(0, dto.total_amount_vnd - paidAmount)
  return {
    id: dto.id,
    number: dto.invoice_number,
    created_at: existing?.created_at ?? at,
    items,
    orders,
    status: dto.status,
    subtotal: dto.subtotal_vnd,
    service_charge_amount: dto.service_charge_amount_vnd,
    service_charge_basis_points: dto.service_charge_basis_points,
    vat_amount: dto.vat_amount_vnd,
    vat_basis_points: dto.vat_basis_points,
    discount,
    total: dto.total_amount_vnd,
    paid_amount: paidAmount,
    change_amount: dto.change_amount_vnd,
    discount_history: discountHistory,
    payment: paymentFromDTO(dto.payment, existing?.payment ?? null),
    payments: allPayments,
    remaining,
  }
}

function statusFromInvoice(invoice: Invoice, priorStatus: CashierSession['status']): CashierSession['status'] {
  if (invoice.status === 'PAID') return 'paid'
  if (invoice.status === 'PARTIALLY_PAID') return 'in_payment'
  if (priorStatus === 'closed') return 'closed'
  if (invoice.payment?.status === 'processing' || invoice.payment?.status === 'pending') return 'in_payment'
  return 'bill_requested'
}

function applyInvoiceDTO(
  session: CashierSession,
  dto: BillingInvoiceDTO,
  discountAction: 'applied' | 'removed' | undefined,
  at: Date,
): CashierSession {
  // The seed invoice from the mapper has no id yet — the first real DTO replaces it in place
  // rather than appending, so a single-invoice session stays a single-invoice session.
  let idx = session.invoices.findIndex((inv) => inv.id === dto.id)
  if (idx === -1 && session.invoices.length === 1 && !session.invoices[0].id) idx = 0
  const existing = idx >= 0 ? session.invoices[idx] : undefined

  const priorDiscount = existing?.discount ?? null
  const discount = discountFromDTO(dto, at)
  const discountHistory = [...(existing?.discount_history ?? [])]
  if (discountAction === 'applied' && discount) discountHistory.push(discount)
  if (discountAction === 'removed' && priorDiscount) {
    discountHistory.push({ ...priorDiscount, action: 'removed', applied_at: at })
  }

  const newLength = idx === -1 ? session.invoices.length + 1 : session.invoices.length
  const merged = mergeInvoiceDTO(existing, dto, discount, discountHistory, newLength > 1, at)
  const invoices =
    idx === -1
      ? [...session.invoices, merged]
      : session.invoices.map((inv, i) => (i === idx ? merged : inv))

  return {
    ...session,
    status: statusFromInvoice(merged, session.status),
    invoices,
    activeInvoiceId: merged.id ?? null,
  }
}

function replaceInvoicesInSession(
  session: CashierSession,
  dtos: BillingInvoiceDTO[],
  at: Date,
): CashierSession {
  if (dtos.length === 0) return session
  const isSplit = dtos.length > 1
  const invoices = dtos.map((dto) => {
    const existing = session.invoices.find((inv) => inv.id === dto.id)
    return mergeInvoiceDTO(existing, dto, discountFromDTO(dto, at), existing?.discount_history ?? [], isSplit, at)
  })
  const activeInvoiceId = invoices.some((inv) => inv.id === session.activeInvoiceId)
    ? session.activeInvoiceId
    : (invoices[0]?.id ?? null)
  const active = invoices.find((inv) => inv.id === activeInvoiceId) ?? invoices[0]
  return {
    ...session,
    status: statusFromInvoice(active, session.status),
    invoices,
    activeInvoiceId,
  }
}

function cashierReducer(state: CashierState, action: CashierAction): CashierState {
  switch (action.type) {
    case 'replaceSessions':
      return {
        ...state,
        sessions: action.sessions.map((incoming) => {
          const existing = state.sessions.find((session) => session.id === incoming.id)
          const hasRealInvoice = existing?.invoices.some((inv) => inv.id)
          return hasRealInvoice
            ? {
                ...incoming,
                invoices: existing!.invoices,
                activeInvoiceId: existing!.activeInvoiceId,
                status: existing!.status,
              }
            : incoming
        }),
        selectedSessionId: action.sessions.some((session) => session.id === state.selectedSessionId)
          ? state.selectedSessionId
          : null,
      }

    case 'selectSession':
      return { ...state, selectedSessionId: action.sessionId }

    case 'selectInvoice':
      return {
        ...state,
        sessions: updateSession(state.sessions, action.sessionId, (session) => {
          const invoice = session.invoices.find((inv) => inv.id === action.invoiceId)
          if (!invoice) return session
          return { ...session, activeInvoiceId: action.invoiceId, status: statusFromInvoice(invoice, session.status) }
        }),
      }

    case 'replaceInvoice':
      return {
        ...state,
        sessions: updateSession(state.sessions, action.sessionId, (session) =>
          applyInvoiceDTO(session, action.invoice, action.discountAction, action.at ?? state.now),
        ),
      }

    case 'replaceInvoices':
      return {
        ...state,
        sessions: updateSession(state.sessions, action.sessionId, (session) =>
          replaceInvoicesInSession(session, action.invoices, action.at ?? state.now),
        ),
      }

    case 'injectBill': {
      const candidates = state.sessions.filter(
        (session) =>
          session.status === 'dining' && (!action.sessionId || session.id === action.sessionId),
      )
      const picked = candidates[Math.floor(Math.random() * candidates.length)]
      if (!picked) return state
      const at = action.at ?? state.now
      return {
        ...state,
        selectedSessionId: state.selectedSessionId ?? picked.id,
        sessions: updateSession(state.sessions, picked.id, (session) => ({
          ...session,
          bill_requested_at: at,
          status: 'bill_requested',
        })),
      }
    }

    case 'resetAll':
      return { ...createInitialState(action.now ?? new Date()), lang: state.lang }

    case 'applyDiscount':
    case 'removeDiscount':
    case 'completePayment':
    case 'addPartialPayment':
    case 'splitSession':
      return state

    case 'startPayment': {
      const at = action.at ?? state.now
      const payment: PaymentRecord = {
        method: action.method,
        sub_method: action.subMethod,
        status: 'pending',
        transaction_id: action.transactionId ?? makeTxnId(at),
        initiated_at: at,
        completed_at: null,
        amount_tendered: null,
        change: null,
        last4: null,
        bank: null,
      }
      return {
        ...state,
        sessions: updateSession(state.sessions, action.sessionId, (session) => ({
          ...updateActiveInvoice(session, (inv) => ({ ...inv, payment })),
          status: 'in_payment',
        })),
      }
    }

    case 'failPayment':
      return {
        ...state,
        sessions: updateSession(state.sessions, action.sessionId, (session) => {
          const invoice = activeInvoice(session)
          if (!invoice?.payment) return session
          return {
            ...updateActiveInvoice(session, (inv) => ({
              ...inv,
              payment: inv.payment ? { ...inv.payment, status: 'failed', completed_at: action.at ?? state.now } : null,
            })),
            status: 'bill_requested',
          }
        }),
      }

    case 'closeSession':
      return {
        ...state,
        selectedSessionId:
          state.selectedSessionId === action.sessionId ? null : state.selectedSessionId,
        sessions: updateSession(state.sessions, action.sessionId, (session) => ({
          ...session,
          status: 'closed',
        })),
      }

    case 'tick':
      return { ...state, now: new Date(state.now.getTime() + action.seconds * 1000) }

    case 'setPaused':
      return { ...state, paused: action.paused }

    case 'setTimeMultiplier':
      return { ...state, timeMultiplier: Math.max(1, Math.min(60, Math.round(action.value))) }

    case 'setLang':
      localStorage.setItem('rest_lang_cashier', action.lang)
      return { ...state, lang: action.lang }

    default:
      return state
  }
}

const CashierContext = createContext<CashierContextValue | null>(null)

export function CashierProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [state, baseDispatch] = useReducer(cashierReducer, undefined, () => createInitialState())
  const createInvoiceMutation = useCreateInvoice()
  const adjustInvoiceMutation = useAdjustInvoice()
  const processPaymentMutation = useProcessPayment()
  const processPartialPaymentMutation = useProcessPartialPayment()
  const splitInvoiceMutation = useSplitInvoice()
  const voidInvoiceMutation = useVoidInvoice()
  const closeDiningSessionMutation = useCloseDiningSession()
  const { data: staffTablesData } = useQuery({
    queryKey: STAFF_TABLES_QUERY_KEY,
    queryFn: fetchStaffTables,
    refetchInterval: 8_000,
  })

  useEffect(() => {
    if (staffTablesData) {
      baseDispatch({
        type: 'replaceSessions',
        sessions: toCashierSessions(staffTablesData.tables),
      })
    }
  }, [staffTablesData])

  useEffect(() => {
    queryClient.setQueryData(CASHIER_QUERY_KEY, state.sessions)
  }, [queryClient, state.sessions])

  useEffect(() => {
    const id = window.setInterval(() => {
      baseDispatch({ type: 'tick', seconds: state.timeMultiplier })
    }, 1000)
    return () => window.clearInterval(id)
  }, [state.timeMultiplier])

  const selectedSession = useMemo(
    () => state.sessions.find((session) => session.id === state.selectedSessionId) ?? null,
    [state.sessions, state.selectedSessionId],
  )

  const t = useMemo<TFunction>(() => {
    return (key, ...args) => {
      const value: DictValue | undefined = CS_DICT[state.lang][key]
      if (typeof value === 'function') {
        return (value as (...values: Array<number | string>) => string)(...args)
      }
      return value ?? key
    }
  }, [state.lang])

  const dispatch = useMemo<React.Dispatch<CashierAction>>(
    () => (action) => {
      const run = async () => {
        const currentSession =
          'sessionId' in action && action.sessionId
            ? state.sessions.find((session) => session.id === action.sessionId)
            : null
        switch (action.type) {
          case 'applyDiscount': {
            if (!currentSession) return
            const active = activeInvoice(currentSession)
            const invoiceId: string = active?.id ?? (await createInvoiceMutation.mutateAsync(currentSession.id)).invoice.id
            const response = await adjustInvoiceMutation.mutateAsync({
              invoiceId,
              discountAmountVND: action.amount,
              discountReason: action.reason,
            })
            baseDispatch({
              type: 'replaceInvoice',
              sessionId: currentSession.id,
              invoice: response.invoice,
              discountAction: 'applied',
              at: action.at,
            })
            toast(t('toast_discount_applied'))
            break
          }
          case 'removeDiscount': {
            if (!currentSession) return
            const active = activeInvoice(currentSession)
            const invoiceId: string = active?.id ?? (await createInvoiceMutation.mutateAsync(currentSession.id)).invoice.id
            const response = await adjustInvoiceMutation.mutateAsync({
              invoiceId,
              discountAmountVND: 0,
              discountReason: '',
            })
            baseDispatch({
              type: 'replaceInvoice',
              sessionId: currentSession.id,
              invoice: response.invoice,
              discountAction: 'removed',
              at: action.at,
            })
            toast(t('toast_discount_removed'))
            break
          }
          case 'completePayment': {
            if (!currentSession) return
            const active = activeInvoice(currentSession)
            const invoiceId: string = active?.id ?? (await createInvoiceMutation.mutateAsync(currentSession.id)).invoice.id
            const methodCode = action.subMethod ?? active?.payment?.sub_method ?? 'cash'
            const received =
              action.amountTendered ??
              active?.payment?.amount_tendered ??
              active?.total ??
              0
            const response = await processPaymentMutation.mutateAsync({
              invoiceId,
              paymentMethodCode: methodCode,
              receivedAmountVND: received,
              referenceCode: action.transactionId ?? active?.payment?.transaction_id,
            })
            baseDispatch({
              type: 'replaceInvoice',
              sessionId: currentSession.id,
              invoice: response.invoice,
            })
            void queryClient.invalidateQueries({ queryKey: STAFF_TABLES_QUERY_KEY })

            if (methodCode === 'cash') toast(t('toast_cash_received'))
            else if (methodCode === 'card') toast(t('toast_card_received'))
            else toast(t('toast_ewallet_paid', currentSession.table_label))

            break
          }
          case 'addPartialPayment': {
            if (!currentSession) return
            const active = activeInvoice(currentSession)
            const invoiceId = active?.id
            if (!invoiceId) {
              toast.error(t('toast_no_invoice'))
              break
            }
            const methodCode = action.subMethod ?? 'cash'
            const response = await processPartialPaymentMutation.mutateAsync({
              invoiceId,
              paymentMethodCode: methodCode,
              receivedAmountVND: action.amount,
              referenceCode: action.transactionId ?? '',
            })
            baseDispatch({
              type: 'replaceInvoice',
              sessionId: currentSession.id,
              invoice: response.invoice,
            })
            void queryClient.invalidateQueries({ queryKey: STAFF_TABLES_QUERY_KEY })
            toast(t('toast_payment_partial', fmtVND(action.amount)))
            break
          }
          case 'splitSession': {
            if (!currentSession) return
            const response = await splitInvoiceMutation.mutateAsync({
              diningSessionId: currentSession.id,
              groups: action.groups,
            })
            baseDispatch({
              type: 'replaceInvoices',
              sessionId: currentSession.id,
              invoices: response.invoices,
            })
            toast(t('toast_split_done'))
            break
          }
          case 'closeSession': {
            if (!currentSession) return
            let voided = false
            for (const invoice of currentSession.invoices) {
              if (invoice.id && invoice.status !== 'PAID' && invoice.status !== 'VOID') {
                await voidInvoiceMutation.mutateAsync({ invoiceId: invoice.id, voidReason: 'void_session' })
                voided = true
              }
            }
            await closeDiningSessionMutation.mutateAsync(currentSession.id)
            baseDispatch(action)
            void queryClient.invalidateQueries({ queryKey: STAFF_TABLES_QUERY_KEY })

            if (voided) toast(t('toast_session_voided', currentSession.table_label))
            else toast(t('toast_session_closed', currentSession.table_label))

            break
          }
          default:
            baseDispatch(action)
        }
      }
      void run().catch(() => {
        if (action.type === 'completePayment') {
          toast(t('toast_ewallet_failed'))
          baseDispatch({ type: 'failPayment', sessionId: action.sessionId })
        } else if (action.type === 'splitSession') {
          toast.error(t('toast_split_failed'))
        }
      })
    },
    [queryClient, state.sessions, t, createInvoiceMutation, adjustInvoiceMutation, processPaymentMutation, processPartialPaymentMutation, splitInvoiceMutation, voidInvoiceMutation, closeDiningSessionMutation],
  )

  useEffect(() => {
    if (!selectedSession || selectedSession.status === 'closed') return
    if (selectedSession.invoices.some((inv) => inv.id)) return
    const id = selectedSession.id
    // Only load an invoice that already exists — building one here would flip the
    // session to AWAITING_PAYMENT (payment lock) just from viewing the table.
    void listSessionInvoices(id)
      .then((response) => {
        if (response.invoices.length > 0) {
          baseDispatch({ type: 'replaceInvoices', sessionId: id, invoices: response.invoices })
        }
      })
      .catch(() => toast.error('Không thể tải hóa đơn'))
  }, [selectedSession])

  const value = useMemo(
    () => ({ state, dispatch, selectedSession, t }),
    [state, dispatch, selectedSession, t],
  )

  return <CashierContext.Provider value={value}>{children}</CashierContext.Provider>
}

export function useCashier(): CashierContextValue {
  const context = use(CashierContext)
  if (!context) throw new Error('useCashier must be used within CashierProvider')
  return context
}
