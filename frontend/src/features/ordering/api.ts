import { apiRequest } from '@/lib/api'

export interface JoinSessionResult {
  status: string
  session_token?: string
  session_id?: string
  table_id?: string
  restaurant_id?: string
}

export function joinDiningSession(qrToken: string): Promise<JoinSessionResult> {
  return apiRequest<JoinSessionResult>('/api/v1/dining/join-session', {
    method: 'POST',
    body: { qr_token: qrToken },
  })
}
