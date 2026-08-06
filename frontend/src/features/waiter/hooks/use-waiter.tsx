import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'

import { WF_DICT } from '@/features/waiter/data/i18n'
import type { Lang, WFCounts, UseWaiterValue } from '@/features/waiter/types'
import { useStaffTables } from '@/features/waiter/queries/useStaffTables'
import { useUpdateItemStatus } from '@/features/waiter/mutations/useUpdateItemStatus'
import { useReviewOrderItem } from '@/features/waiter/mutations/useReviewOrderItem'
import { useRequestBill } from '@/features/waiter/mutations/useRequestBill'
import { useAckWaiterCall } from '@/features/waiter/mutations/useAckWaiterCall'
import { useOpenSession } from '@/features/waiter/mutations/useOpenSession'
import { useMergeSessions, useSplitSessions } from '@/features/waiter/mutations/useMergeSessions'

type DictArgs = Array<string | number>

export function useWaiter(): UseWaiterValue {
  const [now, setNow] = useState<Date>(() => new Date())
  const [timeMultiplier, setTimeMultiplier] = useState(1)
  const [autoOn, setAutoOn] = useState(false)
  const [lang, setLangState] = useState<Lang>(
    () => (localStorage.getItem('rest_lang_waiter') as Lang) || 'vi',
  )
  const [soundOn, setSoundOn] = useState(true)
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [justChangedIds, setJustChangedIds] = useState<Set<string>>(() => new Set())
  const [demoOpen, setDemoOpen] = useState(false)
  const [mergeMode, setMergeMode] = useState(false)
  const [mergeSelectedIds, setMergeSelectedIds] = useState<string[]>([])

  const { tables, refetch } = useStaffTables()
  const updateItemStatus = useUpdateItemStatus()
  const reviewItem = useReviewOrderItem()
  const requestBillMutation = useRequestBill()
  const ackWaiterCallMutation = useAckWaiterCall()
  const openSessionMutation = useOpenSession()
  const mergeSessionsMutation = useMergeSessions()
  const splitSessionsMutation = useSplitSessions()

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
      const sessionId = table?.session?.id
      if (!sessionId) return
      ackWaiterCallMutation.mutateAsync(sessionId).then(() => {
        markJustChanged(tableId)
        if (table) toast(t('toast_acknowledged', table.code))
      })
    },
    [ackWaiterCallMutation, markJustChanged, t, tables],
  )

  const notifyCashier = useCallback(
    (tableId: string) => {
      void tableId
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
        if (table) toast(t('toast_served', itemName, table.code))
      })
    },
    [markJustChanged, updateItemStatus, tables, t, lang],
  )

  const confirmItem = useCallback(
    (tableId: string, itemId: string) => {
      const table = tables.find((item) => item.id === tableId)
      reviewItem.confirm
        .mutateAsync(itemId)
        .then(() => {
          markJustChanged(tableId)
          if (table) toast(t('toast_item_confirmed', table.code))
        })
        .catch((error: Error) => toast.error(error.message))
    },
    [markJustChanged, reviewItem.confirm, tables, t],
  )

  const rejectItem = useCallback(
    (tableId: string, itemId: string, reason: string) => {
      const table = tables.find((item) => item.id === tableId)
      reviewItem.reject
        .mutateAsync({ itemId, reason })
        .then(() => {
          markJustChanged(tableId)
          if (table) toast(t('toast_item_rejected', table.code))
        })
        .catch((error: Error) => toast.error(error.message))
    },
    [markJustChanged, reviewItem.reject, tables, t],
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
        if (table) toast(t('toast_all_served', table.code))
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
        if (table) toast(t('toast_session_opened', table.code))
      })
    },
    [markJustChanged, openSessionMutation, tables, t],
  )

  const toggleMergeMode = useCallback(() => {
    setMergeMode((current) => !current)
    setMergeSelectedIds([])
    setSelectedTableId(null)
  }, [])

  // Chỉ gộp được bàn đang có phiên và chưa nằm trong nhóm gộp nào
  const toggleMergeSelection = useCallback(
    (tableId: string) => {
      const table = tables.find((item) => item.id === tableId)
      if (!table?.session) return
      if (table.session.merge_group_id) {
        toast(t('merge_already_grouped'))
        return
      }
      setMergeSelectedIds((current) =>
        current.includes(tableId) ? current.filter((id) => id !== tableId) : [...current, tableId],
      )
    },
    [t, tables],
  )

  const confirmMerge = useCallback(() => {
    const sessionIds = mergeSelectedIds
      .map((id) => tables.find((table) => table.id === id)?.session?.id)
      .filter((id): id is string => Boolean(id))
    if (sessionIds.length < 2) return
    mergeSessionsMutation
      .mutateAsync(sessionIds)
      .then(() => {
        mergeSelectedIds.forEach(markJustChanged)
        setMergeSelectedIds([])
        setMergeMode(false)
        toast(t('toast_merged', sessionIds.length))
      })
      .catch((error: Error) => toast.error(error.message))
  }, [markJustChanged, mergeSelectedIds, mergeSessionsMutation, t, tables])

  const splitGroup = useCallback(
    (tableId: string) => {
      const groupId = tables.find((table) => table.id === tableId)?.session?.merge_group_id
      if (!groupId) return
      splitSessionsMutation
        .mutateAsync(groupId)
        .then(() => {
          markJustChanged(tableId)
          toast(t('toast_split'))
        })
        .catch((error: Error) => toast.error(error.message))
    },
    [markJustChanged, splitSessionsMutation, t, tables],
  )

  const counts = useMemo<WFCounts>(() => {
    const diningTables = tables.filter((table) => table.area_name.length > 0)
    return diningTables.reduce(
      (acc, table) => {
        if (table.status === 'occupied' && table.session) {
          acc.occupied += 1
          if (table.session.waiter_called_at) acc.calls += 1
          if (table.session.bill_requested_at) acc.bills += 1
          acc.ready += table.session.orders.reduce(
            (sum, order) => sum + order.items.filter((item) => item.status === 'ready').length,
            0,
          )
          acc.pending += table.session.orders.reduce(
            (sum, order) => sum + order.items.filter((item) => item.status === 'placed').length,
            0,
          )
        }
        return acc
      },
      { calls: 0, ready: 0, bills: 0, occupied: 0, total: diningTables.length, pending: 0 },
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
      selectedTableId,
      justChangedIds,
      demoOpen,
      mergeMode,
      mergeSelectedIds,
    },
    actions: {
      selectTable,
      acknowledgeCall,
      notifyCashier,
      markItemServed,
      markAllServed,
      confirmItem,
      rejectItem,
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
      setDemoOpen,
      toggleMergeMode,
      toggleMergeSelection,
      confirmMerge,
      splitGroup,
    },
    counts,
    selectedTable,
    t,
  }
}
