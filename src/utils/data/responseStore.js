// ─── Keys ──────────────────────────────────────────────────────────────────

const responsesKey   = (surveyId) => `sf_responses_${surveyId}`
const exportHistKey  = (surveyId) => `sf_exports_${surveyId}`

// ─── Response CRUD ─────────────────────────────────────────────────────────

/** Load all stored responses for a survey, sorted newest-first. */
export function loadResponses(surveyId) {
  try {
    const raw = localStorage.getItem(responsesKey(surveyId))
    const arr = raw ? JSON.parse(raw) : []
    return arr.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  } catch {
    return []
  }
}

/** Load responses without sorting (cheaper for counting). */
function loadResponsesUnsorted(surveyId) {
  try {
    const raw = localStorage.getItem(responsesKey(surveyId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * Count responses per survey in a single pass per survey (no sort, no filter passes).
 * @param {string[]} surveyIds
 * @returns {Record<string, { total: number, complete: number, terminated: number, partial: number }>}
 */
export function countResponsesForSurveys(surveyIds) {
  const result = {}
  for (const surveyId of surveyIds) {
    const counts = { total: 0, complete: 0, terminated: 0, partial: 0 }
    try {
      const arr = loadResponsesUnsorted(surveyId)
      counts.total = arr.length
      for (const r of arr) {
        if (r.status === 'complete') counts.complete++
        else if (r.status === 'terminated') counts.terminated++
        else if (r.status === 'partial') counts.partial++
      }
    } catch { /* keep zero counts */ }
    result[surveyId] = counts
  }
  return result
}

/**
 * Save a single response. If a response with the same ID already exists
 * it is replaced (useful for updating a partial → complete status).
 * Returns the saved entry.
 *
 * Shape:
 * {
 *   id: string,
 *   surveyId: string,
 *   timestamp: ISO string,
 *   status: 'complete' | 'terminated' | 'partial',
 *   pageReached: number,
 *   responses: {},
 *   companions: {},
 *   terminatedBy: null | { blockTitle, cause }
 * }
 */
export function saveResponse(surveyId, entry) {
  try {
    const all     = loadResponses(surveyId)
    const without = all.filter(r => r.id !== entry.id)
    const updated = [{ ...entry, surveyId }, ...without]
    localStorage.setItem(responsesKey(surveyId), JSON.stringify(updated))
    return entry
  } catch {
    return entry
  }
}

/** Delete a single response by ID. */
export function deleteResponse(surveyId, responseId) {
  try {
    const all = loadResponses(surveyId).filter(r => r.id !== responseId)
    localStorage.setItem(responsesKey(surveyId), JSON.stringify(all))
  } catch { /* noop */ }
}

/** Delete all responses for a survey. */
export function clearResponses(surveyId) {
  try { localStorage.removeItem(responsesKey(surveyId)) } catch { /* noop */ }
}

// ─── Export history ────────────────────────────────────────────────────────

/** Load export history for a survey, newest-first. */
export function loadExportHistory(surveyId) {
  try {
    const raw = localStorage.getItem(exportHistKey(surveyId))
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

/**
 * Record a completed export.
 * @param {string} surveyId
 * @param {object} entry { id, timestamp, rowCount, filters: { statuses, dateFrom, dateTo, sinceLastExport } }
 */
export function recordExport(surveyId, entry) {
  try {
    const history = loadExportHistory(surveyId)
    const updated = [entry, ...history].slice(0, 50)  // keep last 50
    localStorage.setItem(exportHistKey(surveyId), JSON.stringify(updated))
  } catch { /* noop */ }
}

/** Return the timestamp of the most recent export, or null. */
export function lastExportTimestamp(surveyId) {
  const history = loadExportHistory(surveyId)
  return history.length > 0 ? history[0].timestamp : null
}

// ─── Filter helpers ────────────────────────────────────────────────────────

/**
 * Apply filters to a response array.
 * @param {Array}  responses   - full response array from loadResponses()
 * @param {object} filters
 *   statuses:        string[]       - e.g. ['complete','terminated','partial']
 *   dateFrom:        string|null    - ISO date string (start of day)
 *   dateTo:          string|null    - ISO date string (end of day)
 *   sinceLastExport: string|null    - ISO timestamp; only rows AFTER this
 */
export function applyFilters(responses, filters = {}) {
  let result = [...responses]

  if (filters.statuses?.length) {
    result = result.filter(r => filters.statuses.includes(r.status))
  }

  if (filters.dateFrom) {
    const from = new Date(filters.dateFrom)
    from.setHours(0, 0, 0, 0)
    result = result.filter(r => new Date(r.timestamp) >= from)
  }

  if (filters.dateTo) {
    const to = new Date(filters.dateTo)
    to.setHours(23, 59, 59, 999)
    result = result.filter(r => new Date(r.timestamp) <= to)
  }

  if (filters.sinceLastExport) {
    const cutoff = new Date(filters.sinceLastExport)
    result = result.filter(r => new Date(r.timestamp) > cutoff)
  }

  return result
}

// ─── Unique ID ─────────────────────────────────────────────────────────────
function uuidV4() {
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** RFC UUID. randomUUID throws outside a secure context and in older browsers. */
export function newResponseId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try { return crypto.randomUUID() } catch { /* insecure context */ }
  }
  return uuidV4()
}
