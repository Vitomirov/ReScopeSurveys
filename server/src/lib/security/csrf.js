/**
 * CSRF and browser-origin checks for cookie-authenticated API mutations.
 * Uses a double-submit cookie plus an explicit Origin / Sec-Fetch-Site policy.
 */
import { randomBytes, timingSafeEqual } from 'node:crypto'

export const CSRF_COOKIE = 'rs_csrf'
export const CSRF_HEADER = 'x-csrf-token'

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

// Credential-establishing routes: no session cookie is trusted here, so a forged
// cross-site POST gains nothing. Everything else with cookies must pass CSRF.
const CSRF_EXEMPT_EXACT = new Set([
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/invites/preview',
  '/api/auth/invites/accept',
  '/api/auth/password/forgot',
  '/api/auth/password/reset',
  '/api/auth/email/verify',
])

const CSRF_EXEMPT_PREFIXES = [
  '/api/public/',
  '/api/internal/',
  '/api/integrations/',
]

export function generateCsrfToken() {
  return randomBytes(32).toString('base64url')
}

export function normalizeAllowedOrigins(corsOrigin) {
  if (!corsOrigin) return []
  const parts = Array.isArray(corsOrigin) ? corsOrigin : [corsOrigin]
  return parts.map(origin => String(origin).trim().toLowerCase()).filter(Boolean)
}

export function isUnsafeMethod(method) {
  return UNSAFE_METHODS.has(String(method || 'GET').toUpperCase())
}

export function isCsrfExemptPath(path) {
  const normalized = String(path || '').split('?')[0]
  if (CSRF_EXEMPT_EXACT.has(normalized)) return true
  return CSRF_EXEMPT_PREFIXES.some(prefix => normalized.startsWith(prefix))
}

export function usesBearerAuth(request, authAllowBearer) {
  if (!authAllowBearer) return false
  const header = request.headers.authorization
  return Boolean(header?.startsWith('Bearer '))
}

export function hasSessionCookies(request) {
  return Boolean(request.cookies?.rs_access || request.cookies?.rs_refresh)
}

function tokensMatch(expected, provided) {
  if (!expected || !provided) return false
  const left = Buffer.from(String(expected))
  const right = Buffer.from(String(provided))
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function validateCsrfToken(request) {
  const cookieToken = request.cookies?.[CSRF_COOKIE]
  const headerToken = request.headers[CSRF_HEADER]
  return tokensMatch(cookieToken, headerToken)
}

export function validateBrowserOrigin(request, allowedOrigins, { isDev = false } = {}) {
  const allowlist = normalizeAllowedOrigins(allowedOrigins)
  if (!allowlist.length) return false

  const origin = String(request.headers.origin || '').trim().toLowerCase()
  if (origin) {
    if (allowlist.includes(origin)) return true
    if (isDev) {
      try {
        const { hostname } = new URL(origin)
        if (hostname === '127.0.0.1' || hostname === 'localhost') return true
      } catch { /* noop */ }
    }
    return false
  }

  const site = String(request.headers['sec-fetch-site'] || '').trim().toLowerCase()
  if (site === 'same-origin' || site === 'same-site') return true

  const referer = String(request.headers.referer || '').trim()
  if (!referer) return isDev
  try {
    const refOrigin = new URL(referer).origin.toLowerCase()
    if (allowlist.includes(refOrigin)) return true
    if (isDev) {
      const { hostname } = new URL(refOrigin)
      return hostname === '127.0.0.1' || hostname === 'localhost'
    }
    return false
  } catch {
    return false
  }
}

export function shouldEnforceCsrf(request, { authAllowBearer }) {
  if (!request.url.startsWith('/api')) return false
  if (!isUnsafeMethod(request.method)) return false
  if (usesBearerAuth(request, authAllowBearer)) return false

  const path = request.url.split('?')[0]
  if (isCsrfExemptPath(path)) return false

  // Cookie-authenticated browser clients and auth lifecycle routes that carry
  // refresh cookies must prove origin + CSRF on unsafe methods.
  if (hasSessionCookies(request)) return true
  if (path === '/api/auth/logout' || path === '/api/auth/refresh') return true

  return false
}

export function enforceCsrf(request, { corsOrigin, authAllowBearer, isDev = false }) {
  if (!shouldEnforceCsrf(request, { authAllowBearer })) {
    return { ok: true }
  }

  if (!validateBrowserOrigin(request, corsOrigin, { isDev })) {
    return { ok: false, status: 403, error: 'Cross-site request blocked.' }
  }

  if (!validateCsrfToken(request)) {
    return { ok: false, status: 403, error: 'Invalid or missing CSRF token.' }
  }

  return { ok: true }
}
