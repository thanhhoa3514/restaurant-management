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

export interface Envelope<T> {
  data: T | null
  meta?: unknown
  error?: { code: string; message: string } | null
}

export interface RequestOptions {
  method?: string
  body?: unknown
  signal?: AbortSignal
  sessionToken?: string
}
