import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseWorkbookBuffer } from '../../../server/src/lib/survey/import/parseWorkbook.js'
import {
  importPayloadSchema,
  normalizeImportPayload,
} from '../../../server/src/lib/survey/import/schema.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const templatePath = resolve(__dirname, '../../../public/templates/survey-import-template.xlsx')

test('multipart-style null surveyId does not fail schema validation', () => {
  const parsed = parseWorkbookBuffer(readFileSync(templatePath))
  const payload = normalizeImportPayload({
    ...parsed,
    mode: 'create',
    surveyId: null,
    externalId: null,
  })
  const result = importPayloadSchema.safeParse(payload)
  assert.equal(result.success, true, JSON.stringify(result.error?.issues))
  assert.ok(result.data.items.length >= 1)
})

test('invalid ruleType / soft fields coerce — import still validates', () => {
  const payload = normalizeImportPayload({
    schemaVersion: 1,
    survey: { title: 'Soft import' },
    items: [
      {
        code: 'S1',
        itemType: 'question',
        questionType: 'multi_select',
        text: 'Brew methods',
        terminationLogic: 'if_none',
        options: [
          { code: 'S1_O1', text: 'Espresso' },
          { code: 'S1_O2', text: 'Filter' },
        ],
        terminationRules: [
          { ruleType: '', optionCodes: ['S1_O1', 'S1_O2'], matchMode: 'any' },
          { ruleType: 'terminate', optionCodes: ['S1_O1'], matchMode: 'weird' },
        ],
      },
      {
        code: 'Q-bad',
        itemType: 'question',
        questionType: 'not_a_real_type',
        text: 'Stub',
      },
    ],
  })
  const result = importPayloadSchema.safeParse(payload)
  assert.equal(result.success, true, JSON.stringify(result.error?.issues))
  assert.equal(result.data.items[0].terminationRules[0].ruleType, 'choice')
  assert.equal(result.data.items[0].terminationRules[1].ruleType, 'choice')
  assert.equal(result.data.items[0].terminationRules[1].matchMode, 'any')
  assert.equal(result.data.items[1].code, 'Q_bad')
  assert.equal(result.data.items[1].questionType, 'open_text')
})