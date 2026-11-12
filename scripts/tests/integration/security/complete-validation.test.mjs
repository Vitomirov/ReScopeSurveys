/**
 * F1/F2 — server complete validation (required answers + email required for DNC).
 * Run with: node --test scripts/phase-security-complete.test.mjs
 * Integration cases require API on PORT from .env (default 3003) and Postgres.
 */
import { test, before, describe } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import {
  isAnswerEmpty,
  validateCompleteAnswers,
} from '../../../../server/src/lib/survey/completeValidation.js'
import { makeApi, provisionOrg, surveyId, createSurvey } from '../../lib/rbacFixtures.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootEnv = readFileSync(resolve(__dirname, '../../../../.env'), 'utf8')
const PORT = rootEnv.match(/^PORT=(\d+)/m)?.[1] || '3003'
const BASE = `http://127.0.0.1:${PORT}`
const api = makeApi(BASE)

const unique = `cmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
const EMAIL_Q = 'q_email_cmp'
const REQ_Q = 'q_required_cmp'
const OPT_Q = 'q_optional_cmp'

// ─── Unit ───────────────────────────────────────────────────────────────────

test('isAnswerEmpty treats 0 and false as present', () => {
  assert.equal(isAnswerEmpty(0), false)
  assert.equal(isAnswerEmpty(false), false)
  assert.equal(isAnswerEmpty(''), true)
  assert.equal(isAnswerEmpty([]), true)
  assert.equal(isAnswerEmpty({}), true)
  assert.equal(isAnswerEmpty({ a: '' }), true)
  assert.equal(isAnswerEmpty({ a: 'x' }), false)
})

test('validateCompleteAnswers allows empty surveys', () => {
  assert.deepEqual(validateCompleteAnswers({ responses: {} }, []), { ok: true })
})

test('validateCompleteAnswers rejects empty complete when questions exist', () => {
  const items = [{ id: OPT_Q, itemType: 'question', questionType: 'text', required: false }]
  const result = validateCompleteAnswers({ responses: {} }, items)
  assert.equal(result.ok, false)
  assert.equal(result.code, 'INCOMPLETE_ANSWERS')
})

test('validateCompleteAnswers rejects missing required answers', () => {
  const items = [
    { id: REQ_Q, itemType: 'question', questionType: 'text', required: true },
    { id: OPT_Q, itemType: 'question', questionType: 'text', required: false },
  ]
  const result = validateCompleteAnswers({ responses: { [OPT_Q]: 'only optional' } }, items)
  assert.equal(result.ok, false)
  assert.equal(result.code, 'INCOMPLETE_ANSWERS')
})

test('validateCompleteAnswers requires email when isEmailField is set', () => {
  const items = [
    { id: EMAIL_Q, itemType: 'question', questionType: 'text', isEmailField: true },
    { id: REQ_Q, itemType: 'question', questionType: 'text', required: true },
  ]
  const missing = validateCompleteAnswers(
    { responses: { [REQ_Q]: 'yes' } },
    items,
  )
  assert.equal(missing.ok, false)
  assert.equal(missing.code, 'EMAIL_REQUIRED')

  const invalid = validateCompleteAnswers(
    { responses: { [REQ_Q]: 'yes', [EMAIL_Q]: 'not-an-email' } },
    items,
  )
  assert.equal(invalid.ok, false)
  assert.equal(invalid.code, 'EMAIL_REQUIRED')

  const ok = validateCompleteAnswers(
    { responses: { [REQ_Q]: 'yes', [EMAIL_Q]: 'ok@example.com' } },
    items,
  )
  assert.deepEqual(ok, { ok: true })
})

const BRANCH = 'q_branch_vis'
const OPT_A = 'opt-a'
const OPT_B = 'opt-b'

function branchQuestion() {
  return {
    id: BRANCH,
    itemType: 'question',
    questionType: 'single_select',
    required: true,
  }
}

function gatedQuestion(id, mode, optionId) {
  return {
    id,
    itemType: 'question',
    questionType: 'text',
    required: true,
    visibility: {
      enabled: true,
      mode,
      conditions: [{ questionId: BRANCH, conditionType: 'any_of', optionIds: [optionId] }],
    },
  }
}

function skipSurvey(mode, optionId) {
  return [
    branchQuestion(),
    gatedQuestion('q_skip_2', mode, optionId),
    gatedQuestion('q_skip_3', mode, optionId),
    gatedQuestion('q_skip_4', mode, optionId),
  ]
}

test('validateCompleteAnswers accepts a show_if skip when the gated questions stay hidden', () => {
  const items = skipSurvey('show_if', OPT_A)
  const result = validateCompleteAnswers({ responses: { [BRANCH]: OPT_B } }, items)
  assert.deepEqual(result, { ok: true })
})

test('validateCompleteAnswers still requires show_if questions when they are visible', () => {
  const items = skipSurvey('show_if', OPT_A)
  const missing = validateCompleteAnswers({ responses: { [BRANCH]: OPT_A } }, items)
  assert.equal(missing.ok, false)
  assert.equal(missing.code, 'INCOMPLETE_ANSWERS')

  const filled = validateCompleteAnswers({
    responses: {
      [BRANCH]: OPT_A,
      q_skip_2: 'a',
      q_skip_3: 'b',
      q_skip_4: 'c',
    },
  }, items)
  assert.deepEqual(filled, { ok: true })
})

test('validateCompleteAnswers accepts a hide_if skip and still requires those questions otherwise', () => {
  const items = skipSurvey('hide_if', OPT_B)
  const skipped = validateCompleteAnswers({ responses: { [BRANCH]: OPT_B } }, items)
  assert.deepEqual(skipped, { ok: true })

  const shown = validateCompleteAnswers({ responses: { [BRANCH]: OPT_A } }, items)
  assert.equal(shown.ok, false)
  assert.equal(shown.code, 'INCOMPLETE_ANSWERS')
})

test('validateCompleteAnswers skips required questions inside a hidden group', () => {
  const items = [
    branchQuestion(),
    {
      id: 'g_skip',
      itemType: 'group',
      visibility: {
        enabled: true,
        mode: 'show_if',
        conditions: [{ questionId: BRANCH, conditionType: 'any_of', optionIds: [OPT_A] }],
      },
    },
    { id: 'q_skip_2', itemType: 'question', questionType: 'text', required: true },
    { id: 'q_skip_3', itemType: 'question', questionType: 'text', required: true },
    { id: 'q_skip_4', itemType: 'question', questionType: 'text', required: true },
  ]
  const skipped = validateCompleteAnswers({ responses: { [BRANCH]: OPT_B } }, items)
  assert.deepEqual(skipped, { ok: true })

  const shown = validateCompleteAnswers({ responses: { [BRANCH]: OPT_A } }, items)
  assert.equal(shown.ok, false)
  assert.equal(shown.code, 'INCOMPLETE_ANSWERS')
})

test('validateCompleteAnswers still rejects when every question is hidden and unanswered', () => {
  const items = [{
    id: 'q_only_hidden',
    itemType: 'question',
    questionType: 'text',
    required: false,
    visibility: {
      enabled: true,
      mode: 'show_if',
      conditions: [{ questionId: 'q_missing', conditionType: 'any_of', optionIds: ['x'] }],
    },
  }]
  const result = validateCompleteAnswers({ responses: {} }, items)
  assert.equal(result.ok, false)
  assert.equal(result.code, 'INCOMPLETE_ANSWERS')
})

test('validateCompleteAnswers does not require an email question hidden by visibility', () => {
  const items = [
    branchQuestion(),
    {
      id: 'q_email_hidden',
      itemType: 'question',
      questionType: 'text',
      isEmailField: true,
      required: true,
      visibility: {
        enabled: true,
        mode: 'show_if',
        conditions: [{ questionId: BRANCH, conditionType: 'any_of', optionIds: [OPT_A] }],
      },
    },
  ]
  const skipped = validateCompleteAnswers({ responses: { [BRANCH]: OPT_B } }, items)
  assert.deepEqual(skipped, { ok: true })

  const shown = validateCompleteAnswers({ responses: { [BRANCH]: OPT_A } }, items)
  assert.equal(shown.ok, false)
  assert.equal(shown.code, 'EMAIL_REQUIRED')
})

// ─── Integration (needs the API; unit cases above do not) ───────────────────

describe('public complete API', () => {
before(async () => {
  const res = await api('/health')
  assert.ok(res.data?.ok, `API not reachable at ${BASE}`)
})

async function setLive(token, id, title, revision, items) {
  const res = await api(`/api/surveys/${id}`, {
    method: 'PATCH',
    token,
    body: {
      survey: { id, title, status: 'live' },
      items,
      revision,
    },
  })
  assert.equal(res.status, 200, `set live ${id}: ${JSON.stringify(res.data)}`)
  return res.data
}

function entry(id, status, responses = {}) {
  return {
    id,
    status,
    timestamp: new Date().toISOString(),
    pageReached: 1,
    responses,
    companions: {},
    terminatedBy: null,
    fingerprint: null,
  }
}

test('F1: public complete with empty responses returns 400 when survey has questions', async () => {
  const { adminToken } = await provisionOrg(api, `${unique}_f1`)
  const id = surveyId('cmp_f1')
  const created = await createSurvey(api, adminToken, id, 'Complete F1')
  await setLive(adminToken, id, 'Complete F1', created.revision, [
    { id: REQ_Q, itemType: 'question', questionType: 'text', text: 'Name', required: true },
  ])

  const res = await api(`/api/public/surveys/${id}/responses`, {
    method: 'POST',
    body: entry(randomUUID(), 'complete', {}),
  })
  assert.equal(res.status, 400)
  assert.equal(res.data.code, 'INCOMPLETE_ANSWERS')
})

test('F1: public complete succeeds when required answers are present', async () => {
  const { adminToken } = await provisionOrg(api, `${unique}_f1ok`)
  const id = surveyId('cmp_f1ok')
  const created = await createSurvey(api, adminToken, id, 'Complete F1 OK')
  await setLive(adminToken, id, 'Complete F1 OK', created.revision, [
    { id: REQ_Q, itemType: 'question', questionType: 'text', text: 'Name', required: true },
  ])

  const responseId = randomUUID()
  const res = await api(`/api/public/surveys/${id}/responses`, {
    method: 'POST',
    body: entry(responseId, 'complete', { [REQ_Q]: 'Ada' }),
  })
  assert.equal(res.status, 200, JSON.stringify(res.data))
  assert.equal(res.data.id, responseId)
})

test('F2: public complete without email answer returns EMAIL_REQUIRED', async () => {
  const { adminToken } = await provisionOrg(api, `${unique}_f2`)
  const id = surveyId('cmp_f2')
  const created = await createSurvey(api, adminToken, id, 'Complete F2')
  await setLive(adminToken, id, 'Complete F2', created.revision, [
    { id: EMAIL_Q, itemType: 'question', questionType: 'text', text: 'Email', isEmailField: true },
  ])

  const res = await api(`/api/public/surveys/${id}/responses`, {
    method: 'POST',
    body: entry(randomUUID(), 'complete', {}),
  })
  assert.equal(res.status, 400)
  assert.equal(res.data.code, 'EMAIL_REQUIRED')
})

test('F2: DNC still applies when email is present and listed', async () => {
  const { adminToken } = await provisionOrg(api, `${unique}_f2dnc`)
  const id = surveyId('cmp_f2dnc')
  const created = await createSurvey(api, adminToken, id, 'Complete F2 DNC')
  await setLive(adminToken, id, 'Complete F2 DNC', created.revision, [
    { id: EMAIL_Q, itemType: 'question', questionType: 'text', text: 'Email', isEmailField: true },
  ])

  const blocked = `blocked_${unique}@example.com`
  await api(`/api/surveys/${id}/dnc`, {
    method: 'POST',
    token: adminToken,
    body: { emails: [blocked] },
  })

  const responseId = randomUUID()
  const res = await api(`/api/public/surveys/${id}/responses`, {
    method: 'POST',
    body: entry(responseId, 'complete', { [EMAIL_Q]: blocked }),
  })
  assert.equal(res.status, 200, JSON.stringify(res.data))

  const listed = await api(`/api/surveys/${id}/responses`, { token: adminToken })
  const saved = listed.data.responses.find(r => r.id === responseId)
  assert.equal(saved?.status, 'dnc')
})

test('partial responses remain allowed with empty answers', async () => {
  const { adminToken } = await provisionOrg(api, `${unique}_partial`)
  const id = surveyId('cmp_partial')
  const created = await createSurvey(api, adminToken, id, 'Complete Partial')
  await setLive(adminToken, id, 'Complete Partial', created.revision, [
    { id: REQ_Q, itemType: 'question', questionType: 'text', text: 'Name', required: true },
    { id: EMAIL_Q, itemType: 'question', questionType: 'text', text: 'Email', isEmailField: true },
  ])

  const res = await api(`/api/public/surveys/${id}/responses`, {
    method: 'POST',
    body: entry(randomUUID(), 'partial', {}),
  })
  assert.equal(res.status, 200, JSON.stringify(res.data))
})
})
