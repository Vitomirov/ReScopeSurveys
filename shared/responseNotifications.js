/**
 * Shared "new since last export" counting and notification feed.
 * Used by the dashboard, header panel, and API — a response is new when
 * timestamp > lastExportAt. Never exported ⇒ every valid-timestamp row is new.
 * Deleted rows are simply absent from the input list / DB query.
 */

export function toTimestampMs(value) {
  if (value == null || value === '') return NaN
  if (value instanceof Date) return value.getTime()
  const ms = new Date(value).getTime()
  return ms
}

function isAfterLastExport(timestampMs, lastExportAt) {
  if (!Number.isFinite(timestampMs)) return false
  if (lastExportAt == null || lastExportAt === '') return true
  const cutoff = toTimestampMs(lastExportAt)
  if (!Number.isFinite(cutoff)) return true
  return timestampMs > cutoff
}

/** True when the row should count as new (all statuses; invalid timestamps skip). */
export function isNewResponse(response, lastExportAt) {
  if (!response || response.deleted) return false
  return isAfterLastExport(toTimestampMs(response.timestamp), lastExportAt)
}

/**
 * Count responses newer than the last export for one survey.
 * @param {string} [_surveyId]
 * @param {{ responses?: Array, lastExportAt?: string|Date|null }} [opts]
 */
export function countNewResponses(_surveyId, { responses = [], lastExportAt = null } = {}) {
  if (!Array.isArray(responses) || responses.length === 0) return 0
  let n = 0
  for (const row of responses) {
    if (isNewResponse(row, lastExportAt)) n++
  }
  return n
}

export function latestNewTimestamp(_surveyId, { responses = [], lastExportAt = null } = {}) {
  if (!Array.isArray(responses) || responses.length === 0) return null
  let latest = NaN
  for (const row of responses) {
    if (!isNewResponse(row, lastExportAt)) continue
    const ms = toTimestampMs(row.timestamp)
    if (!Number.isFinite(ms)) continue
    if (!Number.isFinite(latest) || ms > latest) latest = ms
  }
  return Number.isFinite(latest) ? new Date(latest).toISOString() : null
}

export function summarizeNewResponses(surveyId, { responses = [], lastExportAt = null } = {}) {
  return {
    surveyId,
    newCount: countNewResponses(surveyId, { responses, lastExportAt }),
    latestAt: latestNewTimestamp(surveyId, { responses, lastExportAt }),
  }
}

/**
 * @param {string[]} surveyIds
 * @param {{ responsesBySurvey?: Record<string, Array>, lastExportBySurvey?: Record<string, string|Date|null> }} [opts]
 * @returns {Record<string, number>}
 */
export function countNewForSurveys(surveyIds, { responsesBySurvey = {}, lastExportBySurvey = {} } = {}) {
  const result = {}
  for (const id of surveyIds) {
    result[id] = countNewResponses(id, {
      responses: responsesBySurvey[id] || [],
      lastExportAt: lastExportBySurvey[id] ?? null,
    })
  }
  return result
}

/**
 * @param {string[]} surveyIds
 * @returns {Record<string, { newCount: number, latestAt: string|null }>}
 */
export function summarizeNewForSurveys(surveyIds, { responsesBySurvey = {}, lastExportBySurvey = {} } = {}) {
  const result = {}
  for (const id of surveyIds) {
    const summary = summarizeNewResponses(id, {
      responses: responsesBySurvey[id] || [],
      lastExportAt: lastExportBySurvey[id] ?? null,
    })
    result[id] = { newCount: summary.newCount, latestAt: summary.latestAt }
  }
  return result
}

export function surveyIdOf(survey) {
  return survey?.id || survey?.survey?.id || null
}

export function surveyTitleOf(survey) {
  return survey?.title
    || survey?.survey?.title
    || 'Untitled Survey'
}

export function feedMessage(title, newCount) {
  if (newCount > 1) return `${newCount} new responses on ${title}`
  return `New response on ${title}`
}

export function surveysTabLabel(title, newCount) {
  return `${title} — ${newCount} new`
}

/**
 * One feed item per survey with new activity, newest first.
 * Batches when a survey has more than one new response (avoids per-row spam).
 */
export function buildNotificationFeed(surveys, { newBySurvey = {} } = {}) {
  const items = []
  for (const survey of surveys || []) {
    const id = surveyIdOf(survey)
    if (!id) continue
    const info = newBySurvey[id]
    const newCount = info?.newCount ?? 0
    if (newCount <= 0) continue
    const title = surveyTitleOf(survey)
    items.push({
      surveyId: id,
      title,
      newCount,
      latestAt: info.latestAt ?? null,
      message: feedMessage(title, newCount),
    })
  }
  items.sort((a, b) => {
    const bt = toTimestampMs(b.latestAt)
    const at = toTimestampMs(a.latestAt)
    const bSafe = Number.isFinite(bt) ? bt : 0
    const aSafe = Number.isFinite(at) ? at : 0
    return bSafe - aSafe
  })
  return items
}

/** Drop feed rows already covered by a read cursor (latest activity at or before readAt). */
export function hideReadNotifications(payload, reads = {}) {
  const feed = (payload?.feed || []).filter(item => !isCoveredByRead(item, reads))
  const bySurvey = (payload?.bySurvey || []).filter(item => !isCoveredByRead(item, reads))
  const totalNew = bySurvey.reduce((sum, row) => sum + (row.newCount || 0), 0)
  return { ...payload, totalNew, bySurvey, feed }
}

function isCoveredByRead(item, reads) {
  const readAt = reads?.[item?.surveyId]
  if (!readAt) return false
  const readMs = toTimestampMs(readAt)
  if (!Number.isFinite(readMs)) return false
  const latestMs = toTimestampMs(item?.latestAt)
  if (!Number.isFinite(latestMs)) return true
  return latestMs <= readMs
}

export function buildNotificationsPayload(surveys, { newBySurvey = {} } = {}) {
  const feed = buildNotificationFeed(surveys, { newBySurvey })
  const bySurvey = feed.map(({ surveyId, title, newCount, latestAt }) => ({
    surveyId,
    title,
    newCount,
    latestAt,
  }))
  const totalNew = bySurvey.reduce((sum, row) => sum + row.newCount, 0)
  return { totalNew, bySurvey, feed }
}

/** Bell badge label: 1–9 or "9+". */
export function formatBadgeCount(n) {
  const count = Number(n) || 0
  if (count <= 0) return ''
  if (count > 9) return '9+'
  return String(count)
}

export function formatRelativeTime(iso, now = Date.now()) {
  if (!iso) return ''
  const ms = toTimestampMs(iso)
  if (!Number.isFinite(ms)) return ''
  const diff = now - ms
  if (diff < 60_000) return 'Just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`
  return new Date(ms).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export const EMPTY_NOTIFICATIONS = Object.freeze({
  totalNew: 0,
  bySurvey: [],
  feed: [],
})
