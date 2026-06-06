import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { ApiError, apiRequest } from '@/lib/api'
import {
  getStaffSession,
  logoutStaff,
  subscribeStaffSession,
  updateStaffSession,
  type PermissionCode,
  type StaffSession,
} from '@/lib/auth'
import {
  PermissionContext,
  type PermissionContextValue,
} from '@/lib/permission-context'

interface MeResponse {
  user_id: string
  username: string
  name: string
  role: string
  permissions: PermissionCode[]
  restaurant_id: string
}

export function PermissionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<StaffSession | null>(() => getStaffSession())
  const [loading, setLoading] = useState(() => Boolean(getStaffSession()?.token))

  useEffect(
    () =>
      subscribeStaffSession((next) => {
        setSession(next)
        setLoading(Boolean(next?.token))
      }),
    [],
  )

  useEffect(() => {
    if (!session?.token) return
    let active = true
    apiRequest<MeResponse>('/api/v1/identity/me')
      .then((me) => {
        if (!active) return
        const next = updateStaffSession({
          name: me.name,
          permissions: me.permissions,
        })
        setSession(next)
      })
      .catch((error: unknown) => {
        if (!active) return
        if (error instanceof ApiError && error.status === 401) {
          logoutStaff()
          setSession(null)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [session?.token])

  const permissions = useMemo(
    () => new Set<PermissionCode>(session?.permissions ?? []),
    [session?.permissions],
  )
  const value = useMemo<PermissionContextValue>(
    () => ({
      permissions,
      loading,
      has: (permission) => permissions.has(permission),
      hasAny: (codes) => codes.some((code) => permissions.has(code)),
    }),
    [loading, permissions],
  )

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>
}
