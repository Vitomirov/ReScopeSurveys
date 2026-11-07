import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  clearPendingResponse,
  isRetryableStatus,
  parseRetryAfterSeconds,
  readPendingResponse,
  retryDelayMs,
  writePendingResponse,
} from '../../../src/utils/data/pendingResponse.js'

function memoryStorage() {
  const map = new Map()
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  }
}

test('pending response round-trips one entry per survey', () => {
  const storage = memoryStorage()
  const record = { entry: { id: 'abc', status: 'complete', responses: { q1: 'yes' } }, outcome: 'complete' }
  writePendingResponse('survey-1', record, storage)
  assert.deepEqual(readPendingResponse('survey-1', storage), record)
  writePendingResponse('survey-2', { entry: { id: 'other' } }, storage)
  clearPendingResponse('survey-1', storage)
  assert.equal(readPendingResponse('survey-1', storage), null)
  assert.equal(readPendingResponse('survey-2', storage).entry.id, 'other')
})

test('retry delay honors Retry-After and caps the backoff', () => {
  assert.equal(parseRetryAfterSeconds('12'), 12)
  assert.equal(parseRetryAfterSeconds(''), null)
  const now = Date.parse('2026-01-01T00:00:00.000Z')
  assert.equal(parseRetryAfterSeconds('Thu, 01 Jan 2026 00:00:30 GMT', now), 30)
  assert.equal(retryDelayMs({ retryAfterSeconds: 12, attempt: 1 }), 12_000)
  assert.equal(retryDelayMs({ retryAfterSeconds: 90, attempt: 1 }), 30_000)
  assert.equal(retryDelayMs({ attempt: 1 }), 1_000)
  assert.equal(retryDelayMs({ attempt: 3 }), 4_000)
  assert.equal(retryDelayMs({ attempt: 10 }), 30_000)
})

test('only busy and network failures are retried', () => {
  assert.equal(isRetryableStatus(undefined), true)
  assert.equal(isRetryableStatus(null), true)
  assert.equal(isRetryableStatus(429), true)
  assert.equal(isRetryableStatus(502), true)
  assert.equal(isRetryableStatus(503), true)
  assert.equal(isRetryableStatus(404), false)
  assert.equal(isRetryableStatus(400), false)
})
