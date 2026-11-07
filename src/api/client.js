import { useApi } from '@/config/api'
import { notifyAuthInvalidated } from '@/api/auth/authEvents'
import { AUTH_ERRORS } from '@/constants/authCopy'
import { parseRetryAfterSeconds } from '@/utils/data/pendingResponse'

export class ApiError extends Error {
  constructor(message, { status, body, retryAfter = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
    this.retryAfter = retryAfter
  }
}

const AUTH_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/refresh',
  '/api/auth/logout',
])

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

function readCsrfToken() {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(/(?:^|;\s*)rs_csrf=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

let refreshInFlight = null

function pathOnly(path) {
  return String(path || '').split('?')[0]
}

async function doRefreshFetch() {
  const headers = { 'Content-Type': 'application/json' }
  const csrfToken = readCsrfToken()
  if (csrfToken) headers['X-CSRF-Token'] = csrfToken

  const res = await fetch('/api/auth/refresh', {
    method: 'POST',
    credentials: 'include',
    headers,
    body: '{}',
  })
  if (!res.ok) {
    const err = new Error('refresh failed')
    err.status = res.status
    throw err
  }
  return res.json().catch(() => ({}))
}

async function refreshAccessToken() {
  if (!refreshInFlight) {
    const run = typeof navigator !== 'undefined' && navigator.locks?.request
      ? () => navigator.locks.request('rs-auth-refresh', doRefreshFetch)
      : doRefreshFetch
    refreshInFlight = Promise.resolve()
      .then(run)
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

function invalidateSession(code) {
  try { sessionStorage.removeItem('sf_session') } catch { /* noop */ }
  notifyAuthInvalidated(code || 'UNAUTHORIZED')
}

export async function apiFetch(path, options = {}) {
  const { skipAuthInvalidate = false, skipRefresh = false, _retry = false, ...fetchOptions } = options
  const headers = { ...fetchOptions.headers }
  if (fetchOptions.body != null && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  const method = String(fetchOptions.method || 'GET').toUpperCase()
  if (useApi && UNSAFE_METHODS.has(method)) {
    const csrfToken = readCsrfToken()
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken
  }

  const rawBody = fetchOptions.body
  const requestBody = rawBody != null
    && typeof rawBody === 'object'
    && !(rawBody instanceof FormData)
    && !(rawBody instanceof URLSearchParams)
    && !(rawBody instanceof Blob)
    ? JSON.stringify(rawBody)
    : rawBody

  const res = await fetch(path, {
    ...fetchOptions,
    body: requestBody,
    headers,
    ...(useApi ? { credentials: 'include' } : {}),
  })

  let data = null
  const text = await res.text()
  if (text) {
    try { data = JSON.parse(text) } catch { data = text }
  }

  const isAuthPath = AUTH_PATHS.has(pathOnly(path))
  const expiredOrMissing = data?.code === 'TOKEN_EXPIRED' || data?.code === 'UNAUTHORIZED'
  const shouldTryRefresh = useApi
    && res.status === 401
    && !_retry
    && !skipRefresh
    && !isAuthPath
    && expiredOrMissing

  if (shouldTryRefresh) {
    try {
      await refreshAccessToken()
      return apiFetch(path, { ...options, _retry: true })
    } catch {
      if (!skipAuthInvalidate) invalidateSession(data?.code || 'TOKEN_EXPIRED')
    }
  } else if (res.status === 401 && useApi && !skipAuthInvalidate && !isAuthPath) {
    invalidateSession(data?.code || 'UNAUTHORIZED')
  }

  if (!res.ok) {
    const message = data?.error || res.statusText || 'Request failed'
    const retryAfter = parseRetryAfterSeconds(res.headers.get('Retry-After'))
    if (res.status === 403 && data?.code === 'FORBIDDEN') {
      throw new ApiError(message || AUTH_ERRORS.forbidden, { status: res.status, body: data, retryAfter })
    }
    throw new ApiError(message, {
      status: res.status,
      body: data,
      retryAfter,
    })
  }

  return data
}
