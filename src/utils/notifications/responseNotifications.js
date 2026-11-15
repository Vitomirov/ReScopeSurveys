/**
 * Local-mode adapters for new-since-export notifications.
 * Counting and feed shape live in shared/responseNotifications.js.
 */
import {
  loadResponses,
  lastExportTimestamp,
} from '@/utils/data/responseStore'
import {
  summarizeNewForSurveys,
  buildNotificationsPayload,
  surveyIdOf,
} from '@shared/responseNotifications.js'

export {
  countNewResponses,
  countNewForSurveys,
  summarizeNewResponses,
  summarizeNewForSurveys,
  buildNotificationFeed,
  buildNotificationsPayload,
  formatBadgeCount,
  formatRelativeTime,
  hideReadNotifications,
  feedMessage,
  surveysTabLabel,
  surveyIdOf,
  surveyTitleOf,
  EMPTY_NOTIFICATIONS,
} from '@shared/responseNotifications.js'

export { lastExportTimestamp }

/**
 * New-response summaries for surveys stored in localStorage.
 * @param {string[]} surveyIds
 * @returns {Record<string, { newCount: number, latestAt: string|null }>}
 */
export function loadLocalNewBySurvey(surveyIds) {
  const responsesBySurvey = {}
  const lastExportBySurvey = {}
  for (const id of surveyIds) {
    responsesBySurvey[id] = loadResponses(id)
    lastExportBySurvey[id] = lastExportTimestamp(id)
  }
  return summarizeNewForSurveys(surveyIds, { responsesBySurvey, lastExportBySurvey })
}

/** Full notification payload (totalNew, bySurvey, feed) from local surveys. */
export function buildLocalNotifications(surveys) {
  const ids = (surveys || []).map(surveyIdOf).filter(Boolean)
  const newBySurvey = loadLocalNewBySurvey(ids)
  return buildNotificationsPayload(surveys, { newBySurvey })
}
