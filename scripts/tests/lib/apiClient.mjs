/**
 * HTTP helpers for integration tests: cookie jar + optional Bearer fallback.
 */
export function parseSetCookieHeaders(headers) {
  const list = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : []
  const parsed = {}
  for (const header of list) {
    const [nv, ...attrs] = header.split(';')
    const eq = nv.indexOf('=')
    if (eq === -1) continue
    const name = nv.slice(0, eq).trim()
    const value = nv.slice(eq + 1).trim()
    const expired = attrs.some((attr) => {
      const a = attr.trim().toLowerCase()
      return a === 'max-age=0' || a.startsWith('max-age=-')
    })
    parsed[name] = (!value || expired) ? null : value
  }
  return parsed
}

export function mergeCookies(jar, parsed) {
  const next = { ...jar }
  for (const [name, value] of Object.entries(parsed)) {
    if (value == null) delete next[name]
    else next[name] = value
  }
  return next
}

export function cookieHeader(cookies) {
  return Object.entries(cookies)
    .filter(([, value]) => value != null && value !== '')
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')
}

export function makeApi(base, { injectTokenFromCookie = true } = {}) {
  const defaultOrigin = (() => {
    try { return new URL(base).origin } catch { return 'http://127.0.0.1:3003' }
  })()

  return async function api(path, { method = 'GET', body, token, cookies, origin, headers: extraHeaders } = {}) {
    const headers = { ...(extraHeaders || {}) }
    if (body) headers['Content-Type'] = 'application/json'
    if (token) headers.Authorization = `Bearer ${token}`

    const normalizedMethod = String(method).toUpperCase()
    const jar = cookies || {}
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(normalizedMethod)) {
      headers.Origin = origin || defaultOrigin
      if (jar.rs_csrf) headers['X-CSRF-Token'] = jar.rs_csrf
    }
    if (cookies && Object.keys(cookies).length) headers.Cookie = cookieHeader(cookies)

    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    let data
    try { data = text ? JSON.parse(text) : null } catch { data = text }

    const nextCookies = mergeCookies(cookies || {}, parseSetCookieHeaders(res.headers))
    if (
      injectTokenFromCookie
      && data
      && typeof data === 'object'
      && data.token == null
      && nextCookies.rs_access
    ) {
      data = { ...data, token: nextCookies.rs_access }
    }

    return { status: res.status, data, cookies: nextCookies, headers: res.headers }
  }
}

/** Stateful client that accumulates Set-Cookie into a jar. */
export function createCookieClient(base, { injectTokenFromCookie = false } = {}) {
  let jar = {}
  const api = makeApi(base, { injectTokenFromCookie })

  async function request(path, opts = {}) {
    const result = await api(path, { ...opts, cookies: { ...jar, ...opts.cookies } })
    jar = { ...result.cookies }
    return result
  }

  return {
    request,
    getCookies: () => ({ ...jar }),
    clear: () => { jar = {} },
  }
}
