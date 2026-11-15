import { useCallback, useEffect, useMemo, useState } from 'react'
import { useApi } from '@/config/api'
import { fetchResponseNotifications } from '@/api/platform/notifications'
import {
  loadNotificationReads,
  saveNotificationReads,
} from '@/utils/notifications/notificationReads'
import {
  buildLocalNotifications,
  buildNotificationsPayload,
  EMPTY_NOTIFICATIONS,
  hideReadNotifications,
  surveyIdOf,
} from '@/utils/notifications/responseNotifications'

const POLL_MS = 60_000

function payloadFromSurveys(surveys) {
  if (!useApi) return buildLocalNotifications(surveys)
  const newBySurvey = {}
  for (const entry of surveys || []) {
    const id = surveyIdOf(entry)
    if (!id) continue
    newBySurvey[id] = {
      newCount: entry.stats?.newSinceExport ?? 0,
      latestAt: entry.stats?.latestNewAt ?? null,
    }
  }
  return buildNotificationsPayload(surveys, { newBySurvey })
}

/**
 * New-since-export notifications for the dashboard header + tiles.
 * Local mode reads localStorage; API mode hydrates from dashboard stats then
 * refreshes GET /api/notifications/responses on mount, panel open, and a 60s poll.
 */
export function useResponseNotifications(surveys) {
  const [payload, setPayload] = useState(() => payloadFromSurveys(surveys))
  const [reads, setReads] = useState(() => loadNotificationReads())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const unread = useMemo(() => hideReadNotifications(payload, reads), [payload, reads])

  const applyLocal = useCallback(() => {
    setPayload(payloadFromSurveys(surveys))
    setLoading(false)
    setError(null)
  }, [surveys])

  const refreshFromApi = useCallback(async () => {
    try {
      const data = await fetchResponseNotifications()
      setPayload(data || EMPTY_NOTIFICATIONS)
      setError(null)
    } catch (err) {
      console.error('Failed to load response notifications', err)
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (useApi) setPayload(payloadFromSurveys(surveys))
    else applyLocal()
  }, [surveys, applyLocal])

  useEffect(() => {
    if (!useApi) return undefined

    refreshFromApi()

    const poll = () => {
      if (document.visibilityState === 'visible') refreshFromApi()
    }
    const id = setInterval(poll, POLL_MS)
    document.addEventListener('visibilitychange', poll)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', poll)
    }
  }, [refreshFromApi])

  const markRead = useCallback((surveyIds) => {
    const ids = [...new Set((surveyIds || []).filter(Boolean))]
    if (!ids.length) return
    setReads(saveNotificationReads(ids))
  }, [])

  return {
    payload,
    unread,
    loading,
    error,
    refresh: useApi ? refreshFromApi : applyLocal,
    markRead,
  }
}
