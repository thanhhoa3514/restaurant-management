import { useQuery } from '@tanstack/react-query'
import { waiterService } from '@/features/waiter/services/waiterService'
import { toWaiterTables } from '@/features/waiter/helpers/mappers'
import { waiterKeys } from './waiter.keys'
import { useMemo } from 'react'
import type { WFTable } from '@/features/waiter/types'

interface UseStaffTablesValue {
  tables: WFTable[]
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

export function useStaffTables(): UseStaffTablesValue {
  const {
    data,
    isLoading,
    isError,
    refetch: refetchQuery,
  } = useQuery({
    queryKey: waiterKeys.tables(),
    queryFn: waiterService.getTables,
    refetchInterval: 8_000,
  })

  const tables = useMemo(() => toWaiterTables(data?.tables ?? []), [data])

  return { tables, isLoading, isError, refetch: () => void refetchQuery() }
}
