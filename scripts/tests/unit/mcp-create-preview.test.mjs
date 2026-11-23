/**
 * Integration create helper used by webhook + MCP.
 * Run: node --test scripts/tests/unit/mcp-create-preview.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createSurveyFromIntegration } from '../../../server/src/lib/survey/import/createFromIntegration.js'

test('createSurveyFromIntegration returns 422 for invalid payload', async () => {
  const result = await createSurveyFromIntegration(
    { surveyImport: { findFirst: async () => null, create: async () => ({}) } },
    { organizationId: 'org-1', createdById: 'user-1' },
    { schemaVersion: 1, survey: { title: 'X' }, items: [] },
    { source: 'mcp' },
  )
  assert.equal(result.ok, false)
  assert.equal(result.httpStatus, 422)
  assert.ok(result.errors?.length)
})

test('createSurveyFromIntegration idempotent hit returns prior surveyId', async () => {
  const priorId = '22222222-2222-4222-8222-222222222222'
  const prisma = {
    surveyImport: {
      findFirst: async () => ({ surveyId: priorId }),
      create: async () => {
        throw new Error('should not create')
      },
    },
  }
  const result = await createSurveyFromIntegration(
    prisma,
    { organizationId: 'org-1', createdById: 'user-1' },
    {
      schemaVersion: 1,
      externalId: 'mcp-idem-1',
      survey: { title: 'Screen' },
      items: [{
        code: 'Q1',
        itemType: 'question',
        questionType: 'open_text',
        text: 'Comments?',
      }],
    },
    { source: 'mcp' },
  )
  assert.equal(result.ok, true)
  assert.equal(result.idempotent, true)
  assert.equal(result.surveyId, priorId)
  assert.equal(result.status, 'pending_review')
  assert.equal(result.httpStatus, 200)
})

test('externalIdFallback used when body omits externalId', async () => {
  const priorId = '44444444-4444-4444-8444-444444444444'
  let seenExternalId = null
  const prisma = {
    surveyImport: {
      findFirst: async ({ where }) => {
        seenExternalId = where.externalId
        return { surveyId: priorId }
      },
      create: async () => ({}),
    },
  }
  const result = await createSurveyFromIntegration(
    prisma,
    { organizationId: 'org-1', createdById: 'user-1' },
    {
      schemaVersion: 1,
      survey: { title: 'Screen' },
      items: [{
        code: 'Q1',
        itemType: 'question',
        questionType: 'open_text',
        text: 'Comments?',
      }],
    },
    { source: 'webhook', externalIdFallback: 'header-idem-99' },
  )
  assert.equal(seenExternalId, 'header-idem-99')
  assert.equal(result.surveyId, priorId)
  assert.equal(result.idempotent, true)
})
