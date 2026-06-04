import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react'

import { CS_DICT } from '@/features/cashier/data/i18n'
import { calcInvoice, makeTxnId } from '@/features/cashier/helpers'
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
    paused: false,
    lang: (localStorage.getItem('rest_lang_cashier') as Lang) || 'vi',
  }
}

function withInvoiceTotals(
  session: CashierSession,
  discount: DiscountRecord | null,
): CashierSession {
  const totals = calcInvoice(session.invoice.orders, discount)
  const items = session.invoice.orders.flatMap((order) =>
    order.items.map((item) => ({
      ...item,
      _order_id: order.id,
      _order_submitted_at: order.submitted_at,
    })),
  )

  return {
    ...session,
    invoice: {
      ...session.invoice,
      items,
      discount,
      subtotal: totals.subtotal,
      vat_amount: totals.vat_amount,
      total: totals.total,
    },
  }
}

function updateSession(
  sessions: CashierSession[],
  sessionId: string,
  updater: (session: CashierSession) => CashierSession,
): CashierSession[] {
  return sessions.map((session) => (session.id === sessionId ? updater(session) : session))
}

function paymentRecordFromAction(
  session: CashierSession,
  action: Extract<CashierAction, { type: 'completePayment' }>,
): PaymentRecord {
  const now = action.at ?? new Date()
  const method = action.method ?? session.payment?.method ?? 'cash'
  const fallbackSubMethod: SubMethod =
    method === 'cash' ? 'cash' : method === 'card' ? 'card' : 'momo'
  const subMethod = action.subMethod ?? session.payment?.sub_method ?? fallbackSubMethod
  const amountTendered = action.amountTendered ?? session.payment?.amount_tendered ?? null

  return {
    method,
    sub_method: subMethod,
    status: 'completed',
    transaction_id: action.transactionId ?? session.payment?.transaction_id ?? makeTxnId(now),
    initiated_at: session.payment?.initiated_at ?? now,
    completed_at: now,
    amount_tendered: amountTendered,
    change: action.change ?? session.payment?.change ?? null,
    last4: action.last4 ?? session.payment?.last4 ?? null,
    bank: action.bank ?? session.payment?.bank ?? null,
  }
}

function cashierReducer(state: CashierState, action: CashierAction): CashierState {
  switch (action.type) {
    case 'replaceSessions':
      return {
        ...state,
        sessions: action.sessions,
        selectedSessionId: action.sessions.some((session) => session.id === state.selectedSessionId)
          ? state.selectedSessionId
          : (action.sessions[0]?.id ?? null),
      }

    case 'selectSession':
      return { ...state, selectedSessionId: action.sessionId }

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
      return createInitialState(action.now ?? new Date())

    case 'applyDiscount': {
      const at = action.at ?? state.now
      return {
        ...state,
        sessions: updateSession(state.sessions, action.sessionId, (session) => {
          const discount: DiscountRecord = {
            amount: Math.min(50000, Math.max(0, Math.round(action.amount))),
            reason: action.reason,
            applied_by: String(CS_DICT[state.lang].cashier_name),
            applied_at: at,
            action: 'applied',
          }
          const next = withInvoiceTotals(session, discount)
          return {
            ...next,
            invoice: {
              ...next.invoice,
              discount_history: [...session.invoice.discount_history, discount],
            },
          }
        }),
      }
    }

    case 'removeDiscount': {
      const at = action.at ?? state.now
      return {
        ...state,
        sessions: updateSession(state.sessions, action.sessionId, (session) => {
          if (!session.invoice.discount) return session
          const removed: DiscountRecord = {
            ...session.invoice.discount,
            applied_by: String(CS_DICT[state.lang].cashier_name),
            applied_at: at,
            action: 'removed',
          }
          const next = withInvoiceTotals(session, null)
          return {
            ...next,
            invoice: {
              ...next.invoice,
              discount_history: [...session.invoice.discount_history, removed],
            },
          }
        }),
      }
    }

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

    case 'completePayment':
      return {
        ...state,
        sessions: updateSession(state.sessions, action.sessionId, (session) => ({
          ...session,
          status: 'paid',
          payment: paymentRecordFromAction(session, action),
        })),
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
  const [state, dispatch] = useReducer(cashierReducer, undefined, () => createInitialState())
  const staffTablesQuery = useQuery({
    queryKey: STAFF_TABLES_QUERY_KEY,
    queryFn: fetchStaffTables,
    refetchInterval: 8_000,
  })

  useEffect(() => {
    if (staffTablesQuery.data) {
      dispatch({
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
      dispatch({ type: 'tick', seconds: state.timeMultiplier })
    }, 1000)
    return () => window.clearInterval(id)
  }, [state.timeMultiplier])

  useEffect(() => {
    if (state.paused) return undefined
    const delay = 15000 + Math.random() * 10000
    const id = window.setTimeout(() => {
      dispatch({ type: 'injectBill', at: state.now })
    }, delay)
    return () => window.clearTimeout(id)
  }, [state.paused, state.sessions, state.now])

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

  const value = useMemo(
    () => ({ state, dispatch, selectedSession, t }),
    [state, selectedSession, t],
  )

  return <CashierContext.Provider value={value}>{children}</CashierContext.Provider>
}

export function useCashier(): CashierContextValue {
  const context = useContext(CashierContext)
  if (!context) throw new Error('useCashier must be used within CashierProvider')
  return context
}
