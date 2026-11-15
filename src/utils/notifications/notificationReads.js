import { getSession } from '@/utils/data/authStore'

const STORAGE_KEY = 'sb-notification-reads'

function storageKey() {
  const userId = getSession()?.userId || 'local'
  return `${STORAGE_KEY}:${userId}`
}

export function loadNotificationReads() {
  try {
    const raw = localStorage.getItem(storageKey())
    const parsed = raw ? JSON.parse(raw) : {}
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

/** Remember read cursors for these surveys. Returns the updated map. */
export function saveNotificationReads(surveyIds, readAt = new Date().toISOString()) {
  const next = { ...loadNotificationReads() }
  for (const id of surveyIds) {
    if (!id) continue
    next[id] = readAt
  }
  try {
    localStorage.setItem(storageKey(), JSON.stringify(next))
  } catch { /* storage full or blocked — in-memory caller still updates */ }
  return next
}
