import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  clearClientWriteKey,
  clearPendingResponse,
  isRetryableSaveError,
  isRetryableStatus,
  parseRetryAfterSeconds,
  readClientWriteKey,
  readPendingResponse,
  rememberClientWriteKey,
  retryDelayMs,
  writePendingResponse,
} from '../../../src/utils/data/pendingResponse.js'
import { newResponseId } from '../../../src/utils/data/responseStore.js'

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

test('a lost save race and a short 500 are retried, a real rejection is not', () => {
  const conflict = { status: 409, body: { code: 'CONFLICT' } }
  const txn = { status: 409, body: { code: 'TRANSACTION_CONFLICT' } }
  const writeKey = { status: 401, body: { code: 'WRITE_KEY_REQUIRED' } }
  assert.equal(isRetryableSaveError(conflict, 0), true)
  assert.equal(isRetryableSaveError(conflict, 3), true)
  assert.equal(isRetryableSaveError(conflict, 4), false)
  assert.equal(isRetryableSaveError(txn, 0), true)
  assert.equal(isRetryableSaveError({ status: 409, body: { code: 'FINALIZED' } }, 0), false)
  assert.equal(isRetryableSaveError(writeKey, 0), true)
  assert.equal(isRetryableSaveError(writeKey, 3), true)
  assert.equal(isRetryableSaveError(writeKey, 4), false)
  assert.equal(isRetryableSaveError({ status: 500 }, 0), true)
  assert.equal(isRetryableSaveError({ status: 500 }, 1), true)
  assert.equal(isRetryableSaveError({ status: 500 }, 2), false)
  assert.equal(isRetryableSaveError({ status: 400, body: { code: 'INCOMPLETE_ANSWERS' } }, 0), false)
})

test('client write-key backup survives without cookies', () => {
  const storage = memoryStorage()
  const id = '11111111-1111-4111-8111-111111111111'
  rememberClientWriteKey(id, 'secret-key', storage)
  assert.equal(readClientWriteKey(id, storage), 'secret-key')
  clearClientWriteKey(id, storage)
  assert.equal(readClientWriteKey(id, storage), null)
})

test('response ids stay uuids when randomUUID is missing', () => {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  assert.match(newResponseId(), uuid)
  const randomUUID = crypto.randomUUID
  crypto.randomUUID = () => { throw new Error('insecure') }
  try {
    assert.match(newResponseId(), uuid)
  } finally {
    crypto.randomUUID = randomUUID
  }
})
