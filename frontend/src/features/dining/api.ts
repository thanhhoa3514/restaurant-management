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
    (import.meta.env.VITE_PUBLIC_ORIGIN as string | undefined)?.replace(/\/$/, '') ??
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
