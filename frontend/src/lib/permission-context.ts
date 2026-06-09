import { createContext, use } from 'react'

import type { PermissionCode } from '@/lib/auth'

export interface PermissionContextValue {
  permissions: ReadonlySet<PermissionCode>
  loading: boolean
  has: (permission: PermissionCode) => boolean
  hasAny: (permissions: PermissionCode[]) => boolean
}

export const PermissionContext = createContext<PermissionContextValue | null>(null)

export function usePermissions(): PermissionContextValue {
  const value = use(PermissionContext)
  if (!value) throw new Error('usePermissions must be used inside PermissionProvider')
  return value
}
