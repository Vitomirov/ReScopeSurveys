/**
 * New-since-last-export counting and notification feed.
 * Run: node --test scripts/tests/unit/response-notifications.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  countNewResponses,
  countNewForSurveys,
  summarizeNewResponses,
  summarizeNewForSurveys,
  isNewResponse,
  buildNotificationFeed,
  buildNotificationsPayload,
  formatBadgeCount,
  formatRelativeTime,
  feedMessage,
  hideReadNotifications,
} from '../../../shared/responseNotifications.js'

const T0 = '2026-08-01T10:00:00.000Z'
const T1 = '2026-08-01T11:00:00.000Z'
const T2 = '2026-08-01T12:00:00.000Z'
const T3 = '2026-08-01T13:00:00.000Z'

const r = (id, timestamp, status = 'complete') => ({ id, timestamp, status })

test('never exported: all valid-timestamp responses count as new', () => {
  const responses = [r('a', T1), r('b', T2, 'partial'), r('c', T3, 'terminated')]
  assert.equal(countNewResponses('s1', { responses, lastExportAt: null }), 3)
  assert.equal(countNewResponses('s1', { responses }), 3)
})

test('after export: only timestamps strictly after lastExportAt count', () => {
  const responses = [r('a', T0), r('b', T1), r('c', T2)]
  assert.equal(countNewResponses('s1', { responses, lastExportAt: T1 }), 1)
  assert.equal(isNewResponse(r('b', T1), T1), false)
  assert.equal(isNewResponse(r('c', T2), T1), true)
})

test('equal timestamp is not new', () => {
  assert.equal(isNewResponse(r('a', T1), T1), false)
  assert.equal(countNewResponses('s1', { responses: [r('a', T1)], lastExportAt: T1 }), 0)
})

test('invalid or missing timestamps are skipped', () => {
  const responses = [
    r('a', T2),
    r('b', 'not-a-date'),
    { id: 'c', status: 'complete' },
    null,
  ]
  assert.equal(countNewResponses('s1', { responses, lastExportAt: T1 }), 1)
})

test('deleted flag is not counted', () => {
  const responses = [
    r('a', T2),
    { id: 'b', timestamp: T2, deleted: true },
  ]
  assert.equal(countNewResponses('s1', { responses, lastExportAt: T1 }), 1)
})

test('all statuses count unless product later says otherwise', () => {
  const responses = [
    r('a', T2, 'complete'),
    r('b', T2, 'partial'),
    r('c', T2, 'terminated'),
    r('d', T2, 'dnc'),
  ]
  assert.equal(countNewResponses('s1', { responses, lastExportAt: T1 }), 4)
})

test('empty list and lastExport after every response → 0', () => {
  assert.equal(countNewResponses('s1', { responses: [], lastExportAt: null }), 0)
  assert.equal(countNewResponses('s1', { responses: [r('a', T1)], lastExportAt: T3 }), 0)
})

test('Date objects work as lastExportAt and response.timestamp', () => {
  const responses = [{ id: 'a', timestamp: new Date(T2) }]
  assert.equal(countNewResponses('s1', { responses, lastExportAt: new Date(T1) }), 1)
})

test('summarizeNewResponses includes latestAt of the newest new row', () => {
  const responses = [r('a', T1), r('b', T3), r('c', T2)]
  const summary = summarizeNewResponses('s1', { responses, lastExportAt: T1 })
  assert.equal(summary.newCount, 2)
  assert.equal(summary.latestAt, T3)
})

test('countNewForSurveys / summarizeNewForSurveys are per-id', () => {
  const surveyIds = ['s1', 's2', 's3']
  const responsesBySurvey = {
    s1: [r('a', T2)],
    s2: [r('b', T0), r('c', T2)],
    s3: [],
  }
  const lastExportBySurvey = { s1: T1, s2: T1, s3: null }
  assert.deepEqual(
    countNewForSurveys(surveyIds, { responsesBySurvey, lastExportBySurvey }),
    { s1: 1, s2: 1, s3: 0 },
  )
  const summarized = summarizeNewForSurveys(surveyIds, { responsesBySurvey, lastExportBySurvey })
  assert.equal(summarized.s1.newCount, 1)
  assert.equal(summarized.s2.latestAt, T2)
  assert.equal(summarized.s3.newCount, 0)
})

test('buildNotificationFeed batches >1 new per survey and sorts newest first', () => {
  const surveys = [
    { id: 's1', title: 'Customer Satisfaction Q2' },
    { id: 's2', survey: { title: 'NPS' } },
    { id: 's3', title: 'Quiet' },
  ]
  const newBySurvey = {
    s1: { newCount: 3, latestAt: T1 },
    s2: { newCount: 1, latestAt: T3 },
    s3: { newCount: 0, latestAt: null },
  }
  const feed = buildNotificationFeed(surveys, { newBySurvey })
  assert.equal(feed.length, 2)
  assert.equal(feed[0].surveyId, 's2')
  assert.equal(feed[0].message, 'New response on NPS')
  assert.equal(feed[1].surveyId, 's1')
  assert.equal(feed[1].message, '3 new responses on Customer Satisfaction Q2')
  assert.equal(feedMessage('X', 1), 'New response on X')
})

test('buildNotificationsPayload totals new counts across visible surveys', () => {
  const surveys = [
    { id: 's1', title: 'A' },
    { id: 's2', title: 'B' },
  ]
  const payload = buildNotificationsPayload(surveys, {
    newBySurvey: {
      s1: { newCount: 2, latestAt: T2 },
      s2: { newCount: 1, latestAt: T1 },
    },
  })
  assert.equal(payload.totalNew, 3)
  assert.equal(payload.bySurvey.length, 2)
  assert.equal(payload.feed.length, 2)
})

test('hideReadNotifications drops surveys read at or after their latest response', () => {
  const payload = buildNotificationsPayload(
    [{ id: 's1', title: 'A' }, { id: 's2', title: 'B' }],
    {
      newBySurvey: {
        s1: { newCount: 2, latestAt: T1 },
        s2: { newCount: 1, latestAt: T3 },
      },
    }
  )
  const hidden = hideReadNotifications(payload, { s1: T2 })
  assert.equal(hidden.feed.length, 1)
  assert.equal(hidden.feed[0].surveyId, 's2')
  assert.equal(hidden.totalNew, 1)
})

test('formatBadgeCount caps at 9+', () => {
  assert.equal(formatBadgeCount(0), '')
  assert.equal(formatBadgeCount(1), '1')
  assert.equal(formatBadgeCount(9), '9')
  assert.equal(formatBadgeCount(10), '9+')
  assert.equal(formatBadgeCount(42), '9+')
})

test('formatRelativeTime buckets', () => {
  const now = Date.parse('2026-08-01T12:00:00.000Z')
  assert.equal(formatRelativeTime('2026-08-01T11:59:30.000Z', now), 'Just now')
  assert.equal(formatRelativeTime('2026-08-01T11:45:00.000Z', now), '15m ago')
  assert.equal(formatRelativeTime('2026-08-01T09:00:00.000Z', now), '3h ago')
  assert.equal(formatRelativeTime('2026-07-30T12:00:00.000Z', now), '2d ago')
})
