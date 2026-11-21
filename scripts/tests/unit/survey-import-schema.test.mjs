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