import { apiRequest } from '@/lib/api'
import type { GuestTable, ManageTableQRResult, PendingSession, TableQR } from '@/features/dining/types'

export function listTableQRs(): Promise<TableQR[]> {
  return apiRequest<TableQR[]>('/api/v1/restaurant/tables/qrs')
}

export interface ManageTableQRArgs {
  tableId: string
  // Rotate deactivates the current token (invalidating printed codes). Omit /
  // false for an idempotent "ensure a QR exists" call.
  rotate?: boolean
}

export function manageTableQR({
  tableId,
  rotate = false,
}: ManageTableQRArgs): Promise<ManageTableQRResult> {
  return apiRequest<ManageTableQRResult>('/api/v1/restaurant/tables/qrs', {
    method: 'POST',
    body: { table_id: tableId, rotate },
  })
}

// QR codes encode the guest order URL with the opaque token, never the table
// id, so a leaked/printed code can be revoked by rotating the token.
// VITE_PUBLIC_ORIGIN overrides the encoded origin for codes scanned from
// another device (e.g. http://<LAN-IP>:5173 when demoing on a phone while the
// admin browses via localhost).
// Public (no auth) — returns tables with active QR tokens for the guest ordering flow.
export function fetchGuestTables(): Promise<GuestTable[]> {
  return apiRequest<GuestTable[]>('/api/v1/customer/tables')
}

export function buildQROrderURL(token: string): string {
  const origin =
    (import.meta.env.VITE_PUBLIC_ORIGIN as string)?.replace(/\/$/, '') ||
    (typeof window !== 'undefined' ? window.location.origin : '')
  return `${origin}/order?t=${encodeURIComponent(token)}`
}

export interface OpenSessionResult {
  session_id: string
  session_code: string
  table_id: string
  status: string
  session_token: string
}

export function openDiningSession(tableId: string): Promise<OpenSessionResult> {
  return apiRequest<OpenSessionResult>('/api/v1/restaurant/sessions', {
    method: 'POST',
    body: { table_id: tableId },
  })
}

export interface CloseSessionResult {
  id: string
  status: string
}

export function closeDiningSession(sessionId: string): Promise<CloseSessionResult> {
  return apiRequest<CloseSessionResult>(`/api/v1/restaurant/sessions/${encodeURIComponent(sessionId)}/close`, {
    method: 'POST',
  })
}

export function fetchPendingSessions(): Promise<PendingSession[]> {
  return apiRequest<PendingSession[]>('/api/v1/restaurant/sessions/pending-verification')
}

export function verifySession(sessionId: string, action: 'approve' | 'reject'): Promise<void> {
  return apiRequest<void>(`/api/v1/restaurant/sessions/${encodeURIComponent(sessionId)}/verify`, {
    method: 'POST',
    body: { action },
  })
}

export interface Area {
  id: string
  name: string
  description: string
  display_order: number
  is_active: boolean
}

export function listAreas(): Promise<{ areas: Area[] }> {
  return apiRequest<{ areas: Area[] }>('/api/v1/restaurant/areas')
}

export interface SaveAreaArgs {
  /** Omit to create a new area; set to update that area. */
  areaId?: string
  name: string
  description?: string
  displayOrder?: number
  isActive?: boolean
}

export function saveArea({ areaId, name, description, displayOrder, isActive }: SaveAreaArgs) {
  const body = {
    name,
    description: description ?? '',
    display_order: displayOrder ?? 0,
    ...(isActive === undefined ? {} : { is_active: isActive }),
  }
  return areaId
    ? apiRequest(`/api/v1/restaurant/areas/${encodeURIComponent(areaId)}`, { method: 'PATCH', body })
    : apiRequest('/api/v1/restaurant/areas', { method: 'POST', body })
}

export function deleteArea(areaId: string) {
  return apiRequest(`/api/v1/restaurant/areas/${encodeURIComponent(areaId)}`, { method: 'DELETE' })
}

export interface SaveTableArgs {
  /** Omit to create a new table; set to update that table. */
  tableId?: string
  areaId?: string | null
  code: string
  name: string
  capacity: number
  status: string
}

export function saveTable({ tableId, areaId, code, name, capacity, status }: SaveTableArgs) {
  const body = { area_id: areaId ?? null, code, name, capacity, status }
  return tableId
    ? apiRequest(`/api/v1/restaurant/tables/${encodeURIComponent(tableId)}`, { method: 'PATCH', body })
    : apiRequest('/api/v1/restaurant/tables', { method: 'POST', body })
}

export function deleteTable(tableId: string) {
  return apiRequest(`/api/v1/restaurant/tables/${encodeURIComponent(tableId)}`, { method: 'DELETE' })
}
