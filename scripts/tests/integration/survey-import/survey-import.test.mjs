/**
 * Enterprise survey import — gating, text outline, pending_review.
 * Run: node --test scripts/tests/integration/survey-import/survey-import.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeApi, provisionOrg } from '../../lib/rbacFixtures.mjs'
import { parseTextOutline } from '../../../../shared/surveyImport/parseTextOutline.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootEnv = readFileSync(resolve(__dirname, '../../../../.env'), 'utf8')
const PORT = rootEnv.match(/^PORT=(\d+)/m)?.[1] || '3003'
const api = makeApi(`http://127.0.0.1:${PORT}`)

test('non-enterprise import returns IMPORT_NOT_INCLUDED', async () => {
  const unique = `imp_starter_${Date.now()}`
  const { adminToken } = await provisionOrg(api, unique, { planId: 'starter' })
  const cap = await api('/api/surveys/import/capabilities', { token: adminToken })
  assert.equal(cap.status, 200)
  assert.equal(cap.data.surveyImport, false)

  const text = parseTextOutline('Q1 stem\n() A\n() B')
  const imp = await api('/api/surveys/import', {
    method: 'POST',
    token: adminToken,
    body: {
      text: `Q1 stem\n() A\n() B`,
      schemaVersion: 1,
      items: text.items,
      survey: text.survey,
    },
  })
  assert.equal(imp.status, 403)
  assert.equal(imp.data.code, 'IMPORT_NOT_INCLUDED')
})

test('enterprise text import creates pending_review survey', async () => {
  const unique = `imp_ent_${Date.now()}`
  const { adminToken } = await provisionOrg(api, unique, { planId: 'enterprise' })
  const cap = await api('/api/surveys/import/capabilities', { token: adminToken })
  assert.equal(cap.data.surveyImport, true)

  const parsed = parseTextOutline('How are you?\n() Good\n() Bad')
  const imp = await api('/api/surveys/import', {
    method: 'POST',
    token: adminToken,
    body: {
      schemaVersion: 1,
      items: parsed.items,
      survey: { title: 'Import test' },
    },
  })
  assert.equal(imp.status, 201, JSON.stringify(imp.data))
  assert.ok(imp.data.surveyId)
  assert.equal(imp.data.status, 'pending_review')

  const row = await api(`/api/surveys/${imp.data.surveyId}`, { token: adminToken })
  assert.equal(row.status, 200)
  assert.equal(row.data.survey.status, 'pending_review')
  assert.ok((row.data.items || []).length >= 1)
})

test('append blocked on live survey', async () => {
  const unique = `imp_live_${Date.now()}`
  const { adminToken } = await provisionOrg(api, unique, { planId: 'enterprise' })

  const surveyId = `s_imp_${Date.now()}`
  const create = await api(`/api/surveys/${surveyId}`, {
    method: 'PATCH',
    token: adminToken,
    body: {
      survey: { id: surveyId, title: 'Live target', status: 'live' },
      items: [],
    },
  })
  assert.equal(create.status, 201)

  const parsed = parseTextOutline('Extra?\n() Yes')
  const imp = await api('/api/surveys/import', {
    method: 'POST',
    token: adminToken,
    body: {
      mode: 'append',
      surveyId,
      revision: 1,
      schemaVersion: 1,
      items: parsed.items,
    },
  })
  assert.equal(imp.status, 422)
  assert.ok(imp.data.errors?.some(e => e.code === 'IMPORT_STATUS_LOCKED'))
})