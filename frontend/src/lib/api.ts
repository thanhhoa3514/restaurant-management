import { getStaffSession } from '@/lib/auth'

// Base URL for the backend API.
// - Dev: leave VITE_API_URL unset; requests go same-origin and vite.config.ts
//   proxies /api -> the Go backend (no CORS).
// - Prod: set VITE_API_URL to the backend origin; the backend must allow it via
//   ALLOWED_ORIGINS (httpx.CORS).
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

// Backend success/error envelope: { data, meta, error }.
interface Envelope<T> {
  data: T | null
  meta?: unknown
  error?: { code: string; message: string } | null
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

interface RequestOptions {
  method?: string
  body?: unknown
  signal?: AbortSignal
  // QR-guest session token. When set, the request authenticates as a dining
  // guest via the X-Session-Token header (backend auth.QRSessionToken) instead
  // of the staff JWT. Used for /api/v1/guest/* endpoints.
  sessionToken?: string
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal, sessionToken } = options

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  if (sessionToken) {
    // Guest path: authenticate with the dining session token. Do not send the
    // staff Authorization header — these endpoints expect X-Session-Token only.
    headers['X-Session-Token'] = sessionToken
  } else {
    // Attach the staff JWT issued by /api/v1/identity/authenticate.
    const session = getStaffSession()
    if (session?.token) headers.Authorization = `Bearer ${session.token}`
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (err) {
    // Network failure / aborted / DNS — no HTTP response at all.
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError(0, 'network_error', 'Không thể kết nối máy chủ')
  }

  // 204 / empty body: nothing to parse.
  if (res.status === 204) return undefined as T

  // The dev proxy or a misroute can return HTML (SPA fallback / error page).
  // Don't blindly JSON.parse it — surface a clear error instead.
  const contentType = res.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    if (!res.ok) {
      throw new ApiError(res.status, 'http_error', `Lỗi máy chủ (${res.status})`)
    }
    throw new ApiError(res.status, 'unexpected_response', 'Phản hồi không hợp lệ từ máy chủ')
  }

  const envelope = (await res.json()) as Envelope<T>

  if (!res.ok || envelope.error) {
    const code = envelope.error?.code ?? 'http_error'
    const message = envelope.error?.message ?? `Lỗi máy chủ (${res.status})`
    throw new ApiError(res.status, code, message)
  }

  return envelope.data as T
}
