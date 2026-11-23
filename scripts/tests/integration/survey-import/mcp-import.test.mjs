/**
 * Claude MCP integration endpoint — auth + create_preview_survey.
 * Run with API up: node --test scripts/tests/integration/survey-import/mcp-import.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeApi, provisionOrg } from '../../lib/rbacFixtures.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootEnv = readFileSync(resolve(__dirname, '../../../../.env'), 'utf8')
const PORT = rootEnv.match(/^PORT=(\d+)/m)?.[1] || '3003'
const BASE = `http://127.0.0.1:${PORT}`
const api = makeApi(BASE)
const MCP_PATH = '/api/integrations/v1/mcp'

function parseSseJson(body) {
  const line = String(body).split('\n').find(l => l.startsWith('data: '))
  assert.ok(line, `expected SSE data, got: ${String(body).slice(0, 300)}`)
  return JSON.parse(line.slice(6))
}

async function mcpRpc(apiKey, method, params, id = 1) {
  const res = await fetch(`${BASE}${MCP_PATH}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  })
  const text = await res.text()
  return { status: res.status, text, json: res.status < 400 ? parseSseJson(text) : null }
}

test('MCP without API key returns 401', async () => {
  const res = await fetch(`${BASE}${MCP_PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
  })
  assert.equal(res.status, 401)
  const data = await res.json()
  assert.equal(data.code, 'INVALID_API_KEY')
})

test('MCP create_preview_survey creates pending_review survey', async () => {
  const unique = `mcp_${Date.now()}`
  const { adminToken } = await provisionOrg(api, unique, { planId: 'enterprise' })

  const keyRes = await api('/api/platform/integration-keys', {
    method: 'POST',
    token: adminToken,
    body: { name: 'claude mcp test' },
  })
  assert.equal(keyRes.status, 201, JSON.stringify(keyRes.data))
  const apiKey = keyRes.data.apiKey
  assert.ok(apiKey?.startsWith('rsk_live_'))

  const externalId = `mcp-test-${unique}`
  const call = await mcpRpc(apiKey, 'tools/call', {
    name: 'create_preview_survey',
    arguments: {
      title: 'MCP screener',
      externalId,
      items: [
        {
          code: 'Q1',
          itemType: 'question',
          questionType: 'single_select',
          text: 'Do you qualify?',
          required: true,
          options: [
            { code: 'Q1_O1', text: 'Yes' },
            { code: 'Q1_O2', text: 'No', terminates: true },
          ],
        },
      ],
    },
  })
  assert.equal(call.status, 200, call.text.slice(0, 400))
  assert.ok(!call.json.result?.isError, JSON.stringify(call.json))
  const body = JSON.parse(call.json.result.content[0].text)
  assert.ok(body.surveyId)
  assert.equal(body.status, 'pending_review')
  assert.match(body.builderUrl, new RegExp(`#/builder/${body.surveyId}$`))

  const row = await api(`/api/surveys/${body.surveyId}`, { token: adminToken })
  assert.equal(row.status, 200)
  assert.equal(row.data.survey.status, 'pending_review')

  const again = await mcpRpc(apiKey, 'tools/call', {
    name: 'create_preview_survey',
    arguments: {
      title: 'MCP screener',
      externalId,
      items: [
        {
          code: 'Q1',
          itemType: 'question',
          questionType: 'open_text',
          text: 'Ignored on idempotent',
        },
      ],
    },
  }, 2)
  assert.equal(again.status, 200)
  const body2 = JSON.parse(again.json.result.content[0].text)
  assert.equal(body2.surveyId, body.surveyId)
  assert.equal(body2.idempotent, true)
})

test('non-enterprise integration key cannot use MCP', async () => {
  const unique = `mcp_st_${Date.now()}`
  const { adminToken } = await provisionOrg(api, unique, { planId: 'starter' })

  // Key creation itself is gated — expect 403
  const keyRes = await api('/api/platform/integration-keys', {
    method: 'POST',
    token: adminToken,
    body: { name: 'blocked' },
  })
  assert.equal(keyRes.status, 403)
  assert.equal(keyRes.data.code, 'IMPORT_NOT_INCLUDED')
})
