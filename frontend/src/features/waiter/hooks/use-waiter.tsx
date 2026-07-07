import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { WF_DICT } from '@/features/waiter/data/i18n'
import type {
  Lang,
  WFCounts,
  WFTable,
  WaiterView,
  UseWaiterValue,
} from '@/features/waiter/types'
import { useStaffTables } from '@/features/waiter/queries/useStaffTables'
import { useUpdateItemStatus } from '@/features/waiter/mutations/useUpdateItemStatus'
import { useRequestBill } from '@/features/waiter/mutations/useRequestBill'
import { useOpenSession } from '@/features/waiter/mutations/useOpenSession'

type DictArgs = Array<string | number>

export function useWaiter(): UseWaiterValue {
  const [now, setNow] = useState<Date>(() => new Date())
  const [timeMultiplier, setTimeMultiplier] = useState(1)
  const [autoOn, setAutoOn] = useState(false)
  const [lang, setLangState] = useState<Lang>(
    () => (localStorage.getItem('rest_lang_waiter') as Lang) || 'vi',
  )
  const [soundOn, setSoundOn] = useState(true)
  const [view, setView] = useState<WaiterView>(() =>
    typeof window !== 'undefined' && window.innerWidth < 640 ? 'grid' : 'plan',
  )
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [justChangedIds, setJustChangedIds] = useState<Set<string>>(() => new Set())
  const [demoOpen, setDemoOpen] = useState(false)

  const { tables, refetch } = useStaffTables()
  const updateItemStatus = useUpdateItemStatus()
  const requestBillMutation = useRequestBill()
  const openSessionMutation = useOpenSession()

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

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow((current) => new Date(current.getTime() + 1000 * timeMultiplier))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [timeMultiplier])

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

  const selectTable = useCallback((tableId: string | null) => {
    setSelectedTableId(tableId)
  }, [])

  const acknowledgeCall = useCallback(
    (tableId: string) => {
      const table = tables.find((item) => item.id === tableId)
      if (table) toast(t('toast_acknowledged', table.number))
    },
    [t, tables],
  )

  const notifyCashier = useCallback(
    (tableId: string) => {
      toast(t('toast_bill_sent'))
    },
    [t],
  )

  const markItemServed = useCallback(
    (tableId: string, itemId: string) => {
      const table = tables.find((item) => item.id === tableId)
      const item = table?.session?.orders
        .flatMap((order) => order.items)
        .find((i) => i.id === itemId)
      const itemName = item ? (lang === 'vi' ? item.name_vi : item.name_en) : ''
      updateItemStatus.mutateAsync({ itemId, status: 'SERVED' }).then(() => {
        markJustChanged(tableId)
        if (table) toast(t('toast_served', itemName, table.number))
      })
    },
    [markJustChanged, updateItemStatus, tables, t, lang],
  )

  const markAllServed = useCallback(
    (tableId: string) => {
      const table = tables.find((item) => item.id === tableId)
      const readyItems =
        table?.session?.orders.flatMap((order) =>
          order.items.filter((item) => item.status === 'ready'),
        ) ?? []
      void Promise.all(
        readyItems.map((item) =>
          updateItemStatus.mutateAsync({ itemId: item.id, status: 'SERVED' }),
        ),
      ).then(() => {
        markJustChanged(tableId)
        if (table) toast(t('toast_all_served', table.number))
      })
    },
    [markJustChanged, updateItemStatus, tables, t],
  )

  const requestBill = useCallback(
    (tableId: string) => {
      const table = tables.find((t) => t.id === tableId)
      const sessionId = table?.session?.id
      if (!sessionId) return
      requestBillMutation.mutateAsync(sessionId).then(() => {
        markJustChanged(tableId)
        toast(t('toast_bill_sent'))
      })
    },
    [markJustChanged, requestBillMutation, tables, t],
  )

  const openSession = useCallback(
    (tableId: string) => {
      const table = tables.find((t) => t.id === tableId)
      openSessionMutation.mutateAsync(tableId).then(() => {
        markJustChanged(tableId)
        if (table) toast(t('toast_session_opened', table.number))
      })
    },
    [markJustChanged, openSessionMutation, tables, t],
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
      injectItemReady: refetch,
      injectCall: refetch,
      injectBill: refetch,
      injectNewSession: refetch,
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
