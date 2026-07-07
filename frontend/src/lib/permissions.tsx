import { useEffect, useMemo, useReducer, type ReactNode } from 'react'

import { ApiError, apiRequest } from '@/lib/api'
import {
  clearStaffSession,
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
}

export function PermissionProvider({ children }: { children: ReactNode }) {
  const [{ session, loading }, dispatch] = useReducer(
    (s: { session: StaffSession | null; loading: boolean }, a: Partial<typeof s>) => ({ ...s, ...a }),
    null as any,
    () => {
      const initSession = getStaffSession()
      if (initSession && (
        Number.isNaN(Date.parse(initSession.expiresAt)) ||
        new Date(initSession.expiresAt).getTime() <= Date.now()
      )) {
        clearStaffSession()
        return { session: null, loading: false }
      }
      return { session: initSession, loading: Boolean(initSession?.token) }
    }
  )

  useEffect(
    () =>
      subscribeStaffSession((next) => {
        dispatch({ session: next, loading: Boolean(next?.token) })
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
        dispatch({ session: next, loading: false })
      })
      .catch(async (error: unknown) => {
        if (!active) return
        if (error instanceof ApiError && error.status === 401) {
          await logoutStaff()
          dispatch({ session: null, loading: false })
        } else {
          dispatch({ loading: false })
        }
      })
      .finally(() => {
        if (active) dispatch({ loading: false })
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
