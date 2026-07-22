import { apiRequest } from '@/lib/api'
import type {
  AdminDashboardDTO,
  ManageUserRequest,
  ManageUserResult,
  RoleDTO,
  StaffUserDTO,
} from '@/features/admin/types'

export const staffQueryKeys = {
  users: ['identity', 'users'] as const,
  roles: ['identity', 'roles'] as const,
}

export function fetchAdminDashboard(): Promise<AdminDashboardDTO> {
  return apiRequest<AdminDashboardDTO>('/api/v1/restaurant/dashboard')
}

export function listStaffUsers(): Promise<StaffUserDTO[]> {
  return apiRequest<StaffUserDTO[]>('/api/v1/restaurant/users')
}

export function listRoles(): Promise<RoleDTO[]> {
  return apiRequest<RoleDTO[]>('/api/v1/restaurant/users/roles')
}

export function manageStaffUser(body: ManageUserRequest): Promise<ManageUserResult> {
  return apiRequest<ManageUserResult>('/api/v1/restaurant/users', {
    method: 'POST',
    body,
  })
}
