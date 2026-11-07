import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Prisma } from '../../../server/node_modules/@prisma/client/index.js'
import { createResponseInbox } from '../../../server/src/lib/survey/responseInbox.js'

function entry(id = '11111111-1111-4111-8111-111111111111') {
  return {
    id,
    status: 'complete',
    responses: {},
  }
}

function fakeRedis() {
  const jobs = []
  const acked = []
  return {
    jobs,
    acked,
    isOpen: true,
    async xAdd(_key, _id, fields) {
      jobs.push(JSON.parse(fields.job))
      return `${jobs.length}-0`
    },
    async xAck(_key, _group, id) {
      acked.push(id)
      return 1
    },
  }
}

test('a free slot writes through and does not queue', async () => {
  const redis = fakeRedis()
  let writes = 0
  const inbox = createResponseInbox({
    redis,
    maxSlots: 1,
    upsert: async (job) => {
      writes += 1
      return { row: { id: job.entry.id } }
    },
  })
  const outcome = await inbox.savePublic({
    surveyId: 'survey-1',
    organizationId: 'org-1',
    entry: entry(),
    surveyItems: [],
    presentedKey: null,
  })
  assert.equal(outcome.queued, false)
  assert.equal(outcome.result.row.id, entry().id)
  assert.equal(writes, 1)
  assert.equal(redis.jobs.length, 0)
})

test('a full slot accepts the finish into redis and returns 202 fields', async () => {
  const redis = fakeRedis()
  const inbox = createResponseInbox({
    redis,
    maxSlots: 0,
    upsert: async () => {
      throw new Error('direct write should not run')
    },
  })
  const outcome = await inbox.savePublic({
    surveyId: 'survey-1',
    organizationId: 'org-1',
    entry: entry(),
    surveyItems: [],
    presentedKey: null,
  })
  assert.equal(outcome.queued, true)
  assert.equal(outcome.id, entry().id)
  assert.equal(typeof outcome.issuedWriteKey, 'string')
  assert.equal(redis.jobs[0].surveyId, 'survey-1')
  assert.equal(redis.jobs[0].entry.id, entry().id)
  assert.equal(typeof redis.jobs[0].trustedHash, 'string')
  assert.equal(redis.jobs[0].surveyItems, undefined)
})

test('a database timeout is queued instead of failing the taker', async () => {
  const redis = fakeRedis()
  const inbox = createResponseInbox({
    redis,
    maxSlots: 1,
    upsert: async () => {
      throw new Prisma.PrismaClientKnownRequestError('timeout', {
        code: 'P2024',
        clientVersion: '0.0.0',
      })
    },
  })
  const outcome = await inbox.savePublic({
    surveyId: 'survey-1',
    organizationId: 'org-1',
    entry: entry(),
    presentedKey: 'already-issued',
  })
  assert.equal(outcome.queued, true)
  assert.equal(outcome.issuedWriteKey, null)
  assert.equal(redis.jobs.length, 1)
})

test('redis append failure falls back to the direct upsert', async () => {
  let writes = 0
  const inbox = createResponseInbox({
    redis: {
      isOpen: true,
      async xAdd() { throw new Error('redis down') },
    },
    maxSlots: 0,
    upsert: async (job) => {
      writes += 1
      return { row: { id: job.entry.id } }
    },
  })
  const outcome = await inbox.savePublic({
    surveyId: 'survey-1',
    organizationId: 'org-1',
    entry: entry(),
  })
  assert.equal(outcome.queued, false)
  assert.equal(writes, 1)
})

test('a delivered job is acknowledged only after upsert succeeds', async () => {
  const redis = fakeRedis()
  let calls = 0
  const inbox = createResponseInbox({
    redis,
    upsert: async () => {
      calls += 1
      if (calls === 1) {
        throw new Prisma.PrismaClientKnownRequestError('down', {
          code: 'P1001',
          clientVersion: '0.0.0',
        })
      }
      return { row: { id: 'row-1' } }
    },
  })
  await inbox.deliver({
    id: '1-0',
    job: {
      surveyId: 'survey-1',
      organizationId: 'org-1',
      entry: entry(),
      trustedHash: 'abc',
    },
  })
  assert.deepEqual(redis.acked, [])
  await inbox.deliver({
    id: '1-0',
    job: {
      surveyId: 'survey-1',
      organizationId: 'org-1',
      entry: entry(),
      trustedHash: 'abc',
    },
  })
  assert.deepEqual(redis.acked, ['1-0'])
})
