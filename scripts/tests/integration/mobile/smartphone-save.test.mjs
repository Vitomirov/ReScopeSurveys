/**
 * Real-world smartphone save scenarios against the local API.
 *
 * Simulates what Safari / Instagram / Facebook / slow 4G do:
 *   - drop or never store rs_response_write cookies
 *   - lose the HTTP response after the server already saved
 *   - double-tap Submit (two in-flight POSTs with the same response id)
 *
 * Run (API must be up on PORT from .env, default 3003):
 *   npm run dev:server
 *   npm run test:mobile:save
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

const unique = `phone_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
const MOBILE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'

function log(step, detail) {
  console.log(`\n  [phone] ${step}`)
  if (detail) console.log(`          ${detail}`)
}

function entry(id, status, answers = {}) {
  return {
    id,
    status,
    timestamp: new Date().toISOString(),
    pageReached: 0,
    responses: answers,
    companions: {},
    terminatedBy: null,
    fingerprint: null,
  }
}

function phoneSurveyItems(questionId = 'q_phone') {
  return [{
    id: questionId,
    itemType: 'question',
    questionType: 'open_text',
    text: 'How was your day?',
    required: false,
  }]
}

async function publishLiveSurvey(token, id, title, items = phoneSurveyItems()) {
  const created = await createSurvey(api, token, id, title)
  const live = await api(`/api/surveys/${id}`, {
    method: 'PATCH',
    token,
    body: {
      survey: { id, title, status: 'live' },
      items,
      revision: created.revision,
    },
  })
  assert.equal(live.status, 200, `go live ${id}: ${JSON.stringify(live.data)}`)
  return live.data
}

/** Phone POST: never sends Cookie (ITP / in-app browser). Optional write-key header. */
async function phoneSave(surveyPublicId, body, { writeKey = null } = {}) {
  const headers = { 'User-Agent': MOBILE_UA }
  if (writeKey) headers['X-Response-Write-Key'] = writeKey
  return api(`/api/public/surveys/${surveyPublicId}/responses`, {
    method: 'POST',
    body,
    headers,
    // Explicit empty jar = smartphone that dropped Set-Cookie
    cookies: {},
  })
}

before(async () => {
  const res = await api('/health')
  assert.ok(res.data?.ok, `API not reachable at ${BASE}. Start it with: npm run dev:server`)
})

test('smartphone: cookie blocked — resume with sessionStorage write-key header', async () => {
  log('SCENARIO 1', 'Safari/ITP: cookie never sticks; taker keeps writeKey in sessionStorage')
  const { adminToken } = await provisionOrg(api, `${unique}_s1`)
  const id = surveyId('phone_s1')
  await publishLiveSurvey(adminToken, id, 'Phone cookie blocked')

  const responseId = randomUUID()

  log('1. First save (partial)', 'phone opens survey, answers page 1 — no Cookie jar')
  const answers = { q_phone: 'hello' }
  const first = await phoneSave(id, entry(responseId, 'partial', answers))
  assert.ok([200, 202].includes(first.status), `first save: ${first.status} ${JSON.stringify(first.data)}`)
  assert.equal(first.data.id, responseId)
  assert.equal(typeof first.data.writeKey, 'string', 'server must return writeKey in JSON for mobile backup')
  log('   server', `status=${first.status} writeKey in body=${Boolean(first.data.writeKey)} (cookie ignored by phone)`)

  const storedKey = first.data.writeKey

  log('2. Continue without cookie', 'Submit uses X-Response-Write-Key from sessionStorage')
  const complete = await phoneSave(id, entry(responseId, 'complete', answers), {
    writeKey: storedKey,
  })
  assert.ok([200, 202].includes(complete.status), `complete: ${complete.status} ${JSON.stringify(complete.data)}`)
  assert.equal(complete.data.id, responseId)
  log('   result', `status=${complete.status} → survey finishes on phone (no SAVE_REJECTED)`)
})

test('smartphone: lost 200 then retry — idempotent complete without cookie', async () => {
  log('SCENARIO 2', 'Slow 4G: server saved complete, phone never got the response, retries same id')
  const { adminToken } = await provisionOrg(api, `${unique}_s2`)
  const id = surveyId('phone_s2')
  await publishLiveSurvey(adminToken, id, 'Phone lost response')

  const responseId = randomUUID()
  const answers = { q_phone: 'done' }

  log('1. Submit complete', 'first POST succeeds on server')
  const first = await phoneSave(id, entry(responseId, 'complete', answers))
  assert.ok([200, 202].includes(first.status), `first: ${first.status} ${JSON.stringify(first.data)}`)
  log('   server', `status=${first.status} row stored; phone pretends the packet was lost`)

  log('2. Phone retries same complete id', 'no cookie, no write-key header')
  const retry = await phoneSave(id, entry(responseId, 'complete', answers))
  assert.ok([200, 202].includes(retry.status), `retry: ${retry.status} ${JSON.stringify(retry.data)}`)
  assert.equal(retry.data.id, responseId)
  assert.notEqual(retry.status, 401, 'must not WRITE_KEY_REQUIRED on finished row')
  log('   result', `status=${retry.status} → taker shows completion, not rejection`)
})

test('smartphone: double-tap Submit — concurrent same-id completes both succeed', async () => {
  log('SCENARIO 3', 'User taps Submit twice on a laggy phone; two POSTs race')
  const { adminToken } = await provisionOrg(api, `${unique}_s3`)
  const id = surveyId('phone_s3')
  await publishLiveSurvey(adminToken, id, 'Phone double tap')

  const responseId = randomUUID()
  const body = entry(responseId, 'complete', { q_phone: 'tap-twice' })

  log('1. Fire two POSTs at once', `responseId=${responseId}`)
  const [a, b] = await Promise.all([
    phoneSave(id, body),
    phoneSave(id, body),
  ])

  log('   twin A', `status=${a.status} code=${a.data?.code || 'ok'} id=${a.data?.id || '?'}`)
  log('   twin B', `status=${b.status} code=${b.data?.code || 'ok'} id=${b.data?.id || '?'}`)

  for (const res of [a, b]) {
    assert.ok([200, 202].includes(res.status), `race result: ${res.status} ${JSON.stringify(res.data)}`)
    assert.notEqual(res.status, 401, 'race must not end as WRITE_KEY_REQUIRED')
    assert.notEqual(res.status, 409, 'race must not end as hard conflict for same complete')
  }
  log('   result', 'both treated as success → no SAVE_REJECTED wall')
})

test('smartphone: without write-key header, partial→complete used to die; header path works', async () => {
  log('SCENARIO 4', 'Prove the header backup is what unlocks partial→complete on cookie-less phones')
  const { adminToken } = await provisionOrg(api, `${unique}_s4`)
  const id = surveyId('phone_s4')
  await publishLiveSurvey(adminToken, id, 'Phone header required for resume')

  const responseId = randomUUID()
  const answers = { q_phone: 'mid' }

  const first = await phoneSave(id, entry(responseId, 'partial', answers))
  assert.ok([200, 202].includes(first.status), `first: ${first.status} ${JSON.stringify(first.data)}`)
  const writeKey = first.data.writeKey
  assert.ok(writeKey)

  log('1. Bad path', 'retry complete with neither cookie nor header (old phone bug)')
  const blocked = await phoneSave(id, entry(responseId, 'complete', answers))
  // After our idempotent rules: same status would pass, but status change partial→complete
  // without key must still require ownership proof.
  assert.equal(blocked.status, 401, `expected WRITE_KEY_REQUIRED, got ${blocked.status} ${JSON.stringify(blocked.data)}`)
  assert.equal(blocked.data?.code, 'WRITE_KEY_REQUIRED')
  log('   server', `status=401 WRITE_KEY_REQUIRED (this is the old mobile dead-end)`)

  log('2. Fixed path', 'same complete with X-Response-Write-Key')
  const fixed = await phoneSave(id, entry(responseId, 'complete', answers), { writeKey })
  assert.ok([200, 202].includes(fixed.status), `fixed: ${fixed.status} ${JSON.stringify(fixed.data)}`)
  log('   result', `status=${fixed.status} → phone finishes after storing writeKey from first JSON body`)
})
