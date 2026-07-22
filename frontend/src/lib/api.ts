import { getStaffSession, refreshStaffSession } from '@/lib/auth'
import { ApiError, type Envelope, type RequestOptions } from '@/types/api'
export { ApiError }

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return fallback
}

const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')


let refreshPromise: Promise<boolean> | null = null

async function attemptRefresh(): Promise<boolean> {

  if (refreshPromise) return refreshPromise
  refreshPromise = refreshStaffSession().then((s) => s !== null)
  try {
    return await refreshPromise
  } finally {
    refreshPromise = null
  }
}

async function doFetch<T>(path: string, options: RequestOptions, headers: Record<string, string>): Promise<T> {
  const { method = 'GET', body, signal } = options
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  })

  if (res.status === 204) return undefined as T

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

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, sessionToken } = options

  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let isStaffRequest = false
  if (sessionToken) {
    headers['X-Session-Token'] = sessionToken
  } else {

    isStaffRequest = true
    const session = getStaffSession()
    if (session?.token) headers.Authorization = `Bearer ${session.token}`
  }

  try {
    return await doFetch<T>(path, options, headers)
  } catch (err) {
    if (
      isStaffRequest &&
      err instanceof ApiError &&
      err.status === 401 &&
      !path.includes('/restaurant/auth/login') &&
      !path.includes('/restaurant/auth/refresh')
    ) {
      const refreshed = await attemptRefresh()
      if (refreshed) {
        const session = getStaffSession()
        if (session?.token) {
          headers.Authorization = `Bearer ${session.token}`
        }
        return doFetch<T>(path, options, headers)
      }
    }
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    if (err instanceof ApiError) throw err
    throw new ApiError(0, 'network_error', 'Không thể kết nối máy chủ')
  }
}
