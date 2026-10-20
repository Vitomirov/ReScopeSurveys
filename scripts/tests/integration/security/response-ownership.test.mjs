/**
 * Phase 2 — response upsert ownership.
 * Run with: npm run test:security:ownership
 * Requires API on PORT from .env (default 3003) and Postgres.
 */
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { makeApi, provisionOrg, surveyId, createSurvey } from '../../lib/rbacFixtures.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootEnv = readFileSync(resolve(__dirname, '../../../../.env'), 'utf8')
const PORT = rootEnv.match(/^PORT=(\d+)/m)?.[1] || '3003'
const BASE = `http://127.0.0.1:${PORT}`
const api = makeApi(BASE)

const unique = `own_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

function responseEntry(id, status = 'partial') {
  return {
    id,
    status,
    timestamp: new Date().toISOString(),
    pageReached: 0,
    responses: {},
    companions: {},
    terminatedBy: null,
    fingerprint: null,
  }
}

async function setLive(token, id, title, revision) {
  const res = await api(`/api/surveys/${id}`, {
    method: 'PATCH',
    token,
    body: {
      survey: { id, title, status: 'live' },
      items: [],
      revision,
    },
  })
  assert.equal(res.status, 200, `set live ${id}: ${JSON.stringify(res.data)}`)
  return res.data
}

before(async () => {
  const res = await api('/health')
  assert.ok(res.data?.ok, `API not reachable at ${BASE}`)
})

test('cross-survey response replay returns 409; same-survey resume succeeds', async () => {
  const { adminToken } = await provisionOrg(api, unique)

  const idA = surveyId('own_a')
  const idB = surveyId('own_b')
  const createdA = await createSurvey(api, adminToken, idA, 'Ownership A')
  const createdB = await createSurvey(api, adminToken, idB, 'Ownership B')
  await setLive(adminToken, idA, 'Ownership A', createdA.revision)
  await setLive(adminToken, idB, 'Ownership B', createdB.revision)

  const responseId = randomUUID()

  const first = await api(`/api/public/surveys/${idA}/responses`, {
    method: 'POST',
    body: responseEntry(responseId, 'partial'),
  })
  assert.equal(first.status, 200, `public submit A: ${JSON.stringify(first.data)}`)
  assert.equal(first.data.ok, true)
  assert.equal(first.data.id, responseId)

  const crossPublic = await api(`/api/public/surveys/${idB}/responses`, {
    method: 'POST',
    body: responseEntry(responseId, 'complete'),
  })
  assert.equal(crossPublic.status, 409)
  assert.match(crossPublic.data?.error || '', /another survey/i)

  const resume = await api(`/api/public/surveys/${idA}/responses`, {
    method: 'POST',
    cookies: first.cookies,
    body: responseEntry(responseId, 'complete'),
  })
  assert.equal(resume.status, 200, `public resume A: ${JSON.stringify(resume.data)}`)
  assert.equal(resume.data.id, responseId)

  const reopen = await api(`/api/public/surveys/${idA}/responses`, {
    method: 'POST',
    body: responseEntry(responseId, 'partial'),
  })
  assert.equal(reopen.status, 409)
  assert.match(reopen.data?.error || '', /finalized/i)

  const idempotent = await api(`/api/public/surveys/${idA}/responses`, {
    method: 'POST',
    body: responseEntry(responseId, 'complete'),
  })
  assert.equal(idempotent.status, 200)
  assert.equal(idempotent.data.id, responseId)

  const crossAuth = await api(`/api/surveys/${idB}/responses`, {
    method: 'POST',
    token: adminToken,
    body: responseEntry(responseId, 'partial'),
  })
  assert.equal(crossAuth.status, 409)
  assert.match(crossAuth.data?.error || '', /another survey/i)
})
