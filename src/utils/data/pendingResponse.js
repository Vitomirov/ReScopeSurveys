const PREFIX = 'rs_pending_response:'
const MAX_DELAY_MS = 30_000
const BASE_DELAY_MS = 1_000

function storageOf(storage) {
  if (storage) return storage
  if (typeof sessionStorage === 'undefined') return null
  return sessionStorage
}

export function pendingResponseKey(surveyId) {
  return `${PREFIX}${surveyId}`
}

export function readPendingResponse(surveyId, storage) {
  const store = storageOf(storage)
  if (!store || !surveyId) return null
  try {
    const raw = store.getItem(pendingResponseKey(surveyId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !parsed.entry) return null
    return parsed
  } catch {
    return null
  }
}

export function writePendingResponse(surveyId, record, storage) {
  const store = storageOf(storage)
  if (!store || !surveyId) return
  store.setItem(pendingResponseKey(surveyId), JSON.stringify(record))
}

export function clearPendingResponse(surveyId, storage) {
  const store = storageOf(storage)
  if (!store || !surveyId) return
  store.removeItem(pendingResponseKey(surveyId))
}

/** Retry-After is either delay-seconds or an HTTP date. */
export function parseRetryAfterSeconds(raw, now = Date.now()) {
  if (raw == null || raw === '') return null
  const seconds = Number(raw)
  if (Number.isFinite(seconds) && seconds >= 0) return seconds
  const when = Date.parse(String(raw))
  if (Number.isNaN(when)) return null
  return Math.max(0, (when - now) / 1000)
}

export function retryDelayMs({ retryAfterSeconds, attempt = 1 } = {}) {
  const header = Number(retryAfterSeconds)
  if (Number.isFinite(header) && header > 0) {
    return Math.min(header * 1000, MAX_DELAY_MS)
  }
  const exp = BASE_DELAY_MS * (2 ** Math.max(0, attempt - 1))
  return Math.min(exp, MAX_DELAY_MS)
}

/** 429, 502, 503, and a failed fetch (no status) are worth another try. */
export function isRetryableStatus(status) {
  return status == null || status === 429 || status === 502 || status === 503
}

export function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
