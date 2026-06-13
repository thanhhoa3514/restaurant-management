import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

import { openDiningSession } from '@/features/dining/api'
import { WF_DICT } from '@/features/waiter/data/i18n'
import {
  fetchStaffTables,
  requestSessionBill,
  updateStaffOrderItemStatus,
} from '@/features/staff/api'
import { toWaiterTables } from '@/features/staff/mappers'
import type { Lang, WFCounts, WFTable } from '@/features/waiter/types'

export type WaiterView = 'plan' | 'grid'

type DictArgs = Array<string | number>

export interface WaiterState {
  tables: WFTable[]
  now: Date
  timeMultiplier: number
  autoOn: boolean
  lang: Lang
  soundOn: boolean
  view: WaiterView
  selectedTableId: string | null
  justChangedIds: Set<string>
  demoOpen: boolean
}

export interface WaiterActions {
  selectTable: (tableId: string | null) => void
  acknowledgeCall: (tableId: string) => void
  notifyCashier: (tableId: string) => void
  markItemServed: (tableId: string, itemId: string) => void
  markAllServed: (tableId: string) => void
  requestBill: (tableId: string) => void
  openSession: (tableId: string, guestCount: number, notes: string) => void
  injectItemReady: () => void
  injectCall: () => void
  injectBill: () => void
  injectNewSession: () => void
  setAutoOn: Dispatch<SetStateAction<boolean>>
  setTimeMultiplier: Dispatch<SetStateAction<number>>
  setLang: (lang: Lang) => void
  setSoundOn: Dispatch<SetStateAction<boolean>>
  setView: Dispatch<SetStateAction<WaiterView>>
  setDemoOpen: Dispatch<SetStateAction<boolean>>
}

export interface UseWaiterValue {
  state: WaiterState
  actions: WaiterActions
  counts: WFCounts
  selectedTable: WFTable | null
  t: (key: string, ...args: DictArgs) => string
}

const STAFF_TABLES_QUERY_KEY = ['staff', 'tables'] as const

export function useWaiter(): UseWaiterValue {
  const [now, setNow] = useState<Date>(() => new Date())
  const [timeMultiplier, setTimeMultiplier] = useState(1)
  const [autoOn, setAutoOn] = useState(false)
  const [lang, setLangState] = useState<Lang>(
    () => (localStorage.getItem('rest_lang_waiter') as Lang) || 'vi',
  )
  const [soundOn, setSoundOn] = useState(true)
  const [view, setView] = useState<WaiterView>('plan')
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [justChangedIds, setJustChangedIds] = useState<Set<string>>(() => new Set())
  const [demoOpen, setDemoOpen] = useState(false)

  const { data: tablesData, refetch: refetchTablesQuery } = useQuery({
    queryKey: STAFF_TABLES_QUERY_KEY,
    queryFn: fetchStaffTables,
    refetchInterval: 8_000,
  })

  const tables = useMemo(() => toWaiterTables(tablesData?.tables ?? []), [tablesData])

  const setLang = useCallback((newLang: Lang) => {
    localStorage.setItem('rest_lang_waiter', newLang)
    setLangState(newLang)
  }, [])

  const t = useCallback(
    (key: string, ...args: DictArgs): string => {
      const value = WF_DICT[lang][key]
      if (typeof value === 'function') return value(...(args as never[]))
      return value ?? key
    },
    [lang],
  )

  const markJustChanged = useCallback((tableId: string) => {
    setJustChangedIds((current) => new Set(current).add(tableId))
    window.setTimeout(() => {
      setJustChangedIds((current) => {
        const next = new Set(current)
        next.delete(tableId)
        return next
      })
    }, 500)
  }, [])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow((current) => new Date(current.getTime() + 1000 * timeMultiplier))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [timeMultiplier])

  const refetchTables = useCallback(() => {
    void refetchTablesQuery()
  }, [refetchTablesQuery])

  const selectTable = useCallback((tableId: string | null) => {
    setSelectedTableId(tableId)
  }, [])

  const acknowledgeCall = useCallback(
    (tableId: string) => {
      const table = tables.find((item) => item.id === tableId)
      if (table) toast(t('toast_acknowledged', table.code))
      refetchTables()
    },
    [refetchTables, t, tables],
  )

  const notifyCashier = useCallback(
    (tableId: string) => {
      toast(t('toast_bill_sent'))
      refetchTables()
    },
    [refetchTables, t],
  )

  const markItemServed = useCallback(
    (tableId: string, itemId: string) => {
      const table = tables.find((item) => item.id === tableId)
      const item = table?.session?.orders
        .flatMap((order) => order.items)
        .find((i) => i.id === itemId)
      const itemName = item ? (lang === 'vi' ? item.name_snapshot_vi : item.name_snapshot_en) : ''
      void updateStaffOrderItemStatus(itemId, 'SERVED').then(() => {
        markJustChanged(tableId)
        if (table) toast(t('toast_served', itemName, table.code))
        refetchTables()
      })
    },
    [markJustChanged, refetchTables, tables, t, lang],
  )

  const markAllServed = useCallback(
    (tableId: string) => {
      const table = tables.find((item) => item.id === tableId)
      const readyItems =
        table?.session?.orders.flatMap((order) =>
          order.items.filter((item) => item.status === 'ready'),
        ) ?? []
      void Promise.all(
        readyItems.map((item) => updateStaffOrderItemStatus(item.id, 'SERVED')),
      ).then(() => {
        markJustChanged(tableId)
        if (table) toast(t('toast_all_served', table.code))
        refetchTables()
      })
    },
    [markJustChanged, refetchTables, tables, t],
  )

  const requestBill = useCallback(
    (tableId: string) => {
      const table = tables.find((t) => t.id === tableId)
      const sessionId = table?.session?.id
      if (!sessionId) return
      void requestSessionBill(sessionId).then(() => {
        markJustChanged(tableId)
        toast(t('toast_bill_sent'))
        refetchTables()
      })
    },
    [markJustChanged, refetchTables, tables, t],
  )

  const openSession = useCallback(
    (tableId: string) => {
      const table = tables.find((t) => t.id === tableId)
      void openDiningSession(tableId).then(() => {
        markJustChanged(tableId)
        if (table) toast(t('toast_session_opened', table.code))
        refetchTables()
      })
    },
    [markJustChanged, refetchTables, tables, t],
  )

  const counts = useMemo<WFCounts>(() => {
    return tables.reduce(
      (acc, table) => {
        if (table.status === 'occupied' && table.session) {
          acc.occupied += 1
          if (table.session.waiter_called_at) acc.calls += 1
          if (table.session.bill_requested_at) acc.bills += 1
          acc.ready += table.session.orders.reduce(
            (sum, order) => sum + order.items.filter((item) => item.status === 'ready').length,
            0,
          )
        }
        return acc
      },
      { calls: 0, ready: 0, bills: 0, occupied: 0, total: tables.length },
    )
  }, [tables])

  const selectedTable = useMemo(
    () => tables.find((table) => table.id === selectedTableId) ?? null,
    [selectedTableId, tables],
  )

  return {
    state: {
      tables,
      now,
      timeMultiplier,
      autoOn,
      lang,
      soundOn,
      view,
      selectedTableId,
      justChangedIds,
      demoOpen,
    },
    actions: {
      selectTable,
      acknowledgeCall,
      notifyCashier,
      markItemServed,
      markAllServed,
      requestBill,
      openSession,
      injectItemReady: refetchTables,
      injectCall: refetchTables,
      injectBill: refetchTables,
      injectNewSession: refetchTables,
      setAutoOn,
      setTimeMultiplier,
      setLang,
      setSoundOn,
      setView,
      setDemoOpen,
    },
    counts,
    selectedTable,
    t,
  }
}
