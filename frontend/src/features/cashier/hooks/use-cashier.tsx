import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'

import {
  adjustInvoice,
  createInvoice,
  processPayment,
  type BillingInvoiceDTO,
  type BillingPaymentDTO,
} from '@/features/billing/api'
import { CS_DICT } from '@/features/cashier/data/i18n'
import { makeTxnId } from '@/features/cashier/helpers'
import { closeDiningSession } from '@/features/dining/api'
import { fetchStaffTables } from '@/features/staff/api'
import { toCashierSessions } from '@/features/staff/mappers'
import type {
  CashierSession,
  DiscountRecord,
  Lang,
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
  | {
      type: 'replaceInvoice'
      sessionId: string
      invoice: BillingInvoiceDTO
      discountAction?: 'applied' | 'removed'
      at?: Date
    }
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

function subMethodFromCode(code: string): SubMethod {
  return (['cash', 'card', 'momo', 'zalopay', 'vnpay'].includes(code) ? code : 'momo') as SubMethod
}

function paymentFromDTO(payment: BillingPaymentDTO | null, previous: PaymentRecord | null): PaymentRecord | null {
  if (!payment) return previous?.status === 'pending' ? previous : null
  const method: PaymentMethod =
    payment.method_code === 'cash' ? 'cash' : payment.method_code === 'card' ? 'card' : 'ewallet'
  return {
    method,
    sub_method: subMethodFromCode(payment.method_code),
    status: payment.status.toLowerCase() as PaymentRecord['status'],
    transaction_id: payment.reference_code || payment.payment_number,
    initiated_at: previous?.initiated_at ?? (payment.processed_at ? new Date(payment.processed_at) : new Date()),
    completed_at: payment.processed_at ? new Date(payment.processed_at) : null,
    amount_tendered: payment.received_amount_vnd,
    change: payment.change_amount_vnd,
    last4: previous?.last4 ?? null,
    bank: previous?.bank ?? null,
  }
}

function applyInvoiceDTO(
  session: CashierSession,
  invoice: BillingInvoiceDTO,
  discountAction: 'applied' | 'removed' | undefined,
  at: Date,
): CashierSession {
  const priorDiscount = session.invoice.discount
  const discount: DiscountRecord | null =
    invoice.discount_amount_vnd > 0
      ? {
          amount: invoice.discount_amount_vnd,
          reason: invoice.discount_reason ?? '',
          applied_by: String(CS_DICT.vi.cashier_name),
          applied_at: at,
          action: 'applied',
        }
      : null
  const discountHistory = [...session.invoice.discount_history]
  if (discountAction === 'applied' && discount) discountHistory.push(discount)
  if (discountAction === 'removed' && priorDiscount) {
    discountHistory.push({ ...priorDiscount, action: 'removed', applied_at: at })
  }
  const payment = paymentFromDTO(invoice.payment, session.payment)
  return {
    ...session,
    status: invoice.status === 'PAID' ? 'paid' : session.status === 'closed' ? 'closed' : 'bill_requested',
    payment,
    invoice: {
      ...session.invoice,
      id: invoice.id,
      number: invoice.invoice_number,
      status: invoice.status,
      subtotal: invoice.subtotal_vnd,
      service_charge_amount: invoice.service_charge_amount_vnd,
      service_charge_basis_points: invoice.service_charge_basis_points,
      vat_amount: invoice.vat_amount_vnd,
      vat_basis_points: invoice.vat_basis_points,
      discount,
      total: invoice.total_amount_vnd,
      paid_amount: invoice.paid_amount_vnd,
      change_amount: invoice.change_amount_vnd,
      discount_history: discountHistory,
    },
  }
}

function cashierReducer(state: CashierState, action: CashierAction): CashierState {
  switch (action.type) {
    case 'replaceSessions':
      return {
        ...state,
        sessions: action.sessions.map((incoming) => {
          const existing = state.sessions.find((session) => session.id === incoming.id)
          return existing?.invoice.id
            ? { ...incoming, invoice: existing.invoice, payment: existing.payment, status: existing.status }
            : incoming
        }),
        selectedSessionId: action.sessions.some((session) => session.id === state.selectedSessionId)
          ? state.selectedSessionId
          : (action.sessions[0]?.id ?? null),
      }

    case 'selectSession':
      return { ...state, selectedSessionId: action.sessionId }

    case 'replaceInvoice':
      return {
        ...state,
        sessions: updateSession(state.sessions, action.sessionId, (session) =>
          applyInvoiceDTO(session, action.invoice, action.discountAction, action.at ?? state.now),
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
      return state

    case 'startPayment': {
      const at = action.at ?? state.now
      return {
        ...state,
        sessions: updateSession(state.sessions, action.sessionId, (session) => ({
          ...session,
          status: 'in_payment',
          payment: {
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
          },
        })),
      }
    }

    case 'failPayment':
      return {
        ...state,
        sessions: updateSession(state.sessions, action.sessionId, (session) => {
          if (!session.payment) return session
          return {
            ...session,
            status: 'bill_requested',
            payment: {
              ...session.payment,
              status: 'failed',
              completed_at: action.at ?? state.now,
            },
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
  const staffTablesQuery = useQuery({
    queryKey: STAFF_TABLES_QUERY_KEY,
    queryFn: fetchStaffTables,
    refetchInterval: 8_000,
  })

  useEffect(() => {
    if (staffTablesQuery.data) {
      baseDispatch({
        type: 'replaceSessions',
        sessions: toCashierSessions(staffTablesQuery.data.tables),
      })
    }
  }, [staffTablesQuery.data])

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
            const invoice = currentSession.invoice.id
              ? { id: currentSession.invoice.id }
              : await createInvoice(currentSession.id).then((response) => response.invoice)
            const response = await adjustInvoice(invoice.id, action.amount, action.reason)
            baseDispatch({
              type: 'replaceInvoice',
              sessionId: currentSession.id,
              invoice: response.invoice,
              discountAction: 'applied',
              at: action.at,
            })
            break
          }
          case 'removeDiscount': {
            if (!currentSession) return
            const invoice = currentSession.invoice.id
              ? { id: currentSession.invoice.id }
              : await createInvoice(currentSession.id).then((response) => response.invoice)
            const response = await adjustInvoice(invoice.id, 0, '')
            baseDispatch({
              type: 'replaceInvoice',
              sessionId: currentSession.id,
              invoice: response.invoice,
              discountAction: 'removed',
              at: action.at,
            })
            break
          }
          case 'completePayment': {
            if (!currentSession) return
            const invoice = currentSession.invoice.id
              ? { id: currentSession.invoice.id }
              : await createInvoice(currentSession.id).then((response) => response.invoice)
            const methodCode = action.subMethod ?? currentSession.payment?.sub_method ?? 'cash'
            const received = action.amountTendered ?? currentSession.payment?.amount_tendered ?? currentSession.invoice.total
            const response = await processPayment({
              invoiceId: invoice.id,
              paymentMethodCode: methodCode,
              receivedAmountVND: received,
              referenceCode: action.transactionId ?? currentSession.payment?.transaction_id,
            })
            baseDispatch({ type: 'replaceInvoice', sessionId: currentSession.id, invoice: response.invoice })
            void queryClient.invalidateQueries({ queryKey: STAFF_TABLES_QUERY_KEY })
            break
          }
          case 'closeSession': {
            if (!currentSession) return
            await closeDiningSession(currentSession.id)
            baseDispatch(action)
            void queryClient.invalidateQueries({ queryKey: STAFF_TABLES_QUERY_KEY })
            break
          }
          default:
            baseDispatch(action)
        }
      }
      void run().catch((error) => {
        console.error('cashier action failed', error)
        if (action.type === 'completePayment') baseDispatch({ type: 'failPayment', sessionId: action.sessionId })
      })
    },
    [queryClient, state.sessions],
  )

  useEffect(() => {
    if (!selectedSession || selectedSession.invoice.id || selectedSession.status === 'closed') return
    const id = selectedSession.id
    void createInvoice(id)
      .then((response) => baseDispatch({ type: 'replaceInvoice', sessionId: id, invoice: response.invoice }))
      .catch((error) => console.error('invoice load failed', error))
  }, [selectedSession])

  const t = useMemo<TFunction>(() => {
    return (key, ...args) => {
      const value: DictValue | undefined = CS_DICT[state.lang][key]
      if (typeof value === 'function') {
        return (value as (...values: Array<number | string>) => string)(...args)
      }
      return value ?? key
    }
  }, [state.lang])

  const value = useMemo(
    () => ({ state, dispatch, selectedSession, t }),
    [state, dispatch, selectedSession, t],
  )

  return <CashierContext.Provider value={value}>{children}</CashierContext.Provider>
}

export function useCashier(): CashierContextValue {
  const context = useContext(CashierContext)
  if (!context) throw new Error('useCashier must be used within CashierProvider')
  return context
}
