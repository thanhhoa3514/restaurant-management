import { useQuery } from '@tanstack/react-query'
import type { AdminDashboardDTO } from '@/features/admin/types'
import {
  fetchAdminDashboard,
  listRoles,
  listStaffUsers,
  staffQueryKeys,
} from '@/features/admin/api'

export const ADMIN_DASHBOARD_KEY = ['adminDashboard'] as const

export function useAdminDashboardQuery() {
  return useQuery<AdminDashboardDTO>({
    queryKey: ADMIN_DASHBOARD_KEY,
    queryFn: fetchAdminDashboard,
    refetchInterval: 30000,
    staleTime: 60 * 1000,
  })
}

export function useStaffUsersQuery() {
  return useQuery({
    queryKey: staffQueryKeys.users,
    queryFn: listStaffUsers,
  })
}

export function useStaffRolesQuery() {
  return useQuery({
    queryKey: staffQueryKeys.roles,
    queryFn: listRoles,
  })
}
