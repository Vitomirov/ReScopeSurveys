/**
 * Unit tests for API error mapping (Prisma constraints, infra, production masking).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Prisma } from '../../../server/node_modules/@prisma/client/index.js'
import { mapDatabaseError, publicErrorResponse } from '../../../server/src/lib/httpErrors.js'

test('P2002 on email maps to 409 with registration copy', () => {
  const err = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
    code: 'P2002',
    clientVersion: '0.0.0',
    meta: { target: ['email'] },
  })
  const mapped = mapDatabaseError(err)
  assert.equal(mapped.statusCode, 409)
  assert.equal(mapped.code, 'CONFLICT')
  assert.match(mapped.message, /email/i)

  const res = publicErrorResponse(err, { isDev: false })
  assert.equal(res.status, 409)
  assert.equal(res.body.code, 'CONFLICT')
})

test('P2025 maps to 404', () => {
  const err = new Prisma.PrismaClientKnownRequestError('Not found', {
    code: 'P2025',
    clientVersion: '0.0.0',
  })
  assert.equal(mapDatabaseError(err).statusCode, 404)
})

test('connection errors map to 503 with safe body in production', () => {
  const err = new Prisma.PrismaClientKnownRequestError('timeout', {
    code: 'P2024',
    clientVersion: '0.0.0',
  })
  const res = publicErrorResponse(err, { isDev: false })
  assert.equal(res.status, 503)
  assert.equal(res.body.code, 'DB_UNAVAILABLE')
  assert.doesNotMatch(res.body.error, /timeout/i)
})

test('unknown errors stay generic 500 in production', () => {
  const res = publicErrorResponse(new Error('secret stack'), { isDev: false })
  assert.equal(res.status, 500)
  assert.deepEqual(res.body, { error: 'Internal server error' })
})
