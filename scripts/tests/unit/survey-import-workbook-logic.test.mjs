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
import { mapCodesToIds } from '../../../server/src/lib/survey/import/mapCodes.js'
import { buildRuntimeItems } from '../../../server/src/lib/survey/import/buildItems.js'
import { buildImportSurveyMeta } from '../../../server/src/lib/survey/import/importEngine.js'
import { splitSurveySheetFlat, parseYesNo } from '../../../shared/surveyImport/workbookSettings.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const coffeePath = resolve(__dirname, '../../../public/templates/coffee-consumption-habits-screener.xlsx')
const templatePath = resolve(__dirname, '../../../public/templates/survey-import-template.xlsx')

test('parseYesNo accepts Y after lowercasing', () => {
  assert.equal(parseYesNo('Y'), true)
  assert.equal(parseYesNo('n'), false)
})

test('splitSurveySheetFlat nests fingerprinting and locks', () => {
  const survey = splitSurveySheetFlat({
    title: 'T',
    fingerprinting: 'Y',
    disableBackButton: 'Y',
    navigationLockAllPagesSeconds: '15',
  })
  assert.equal(survey.title, 'T')
  assert.equal(survey.settings.disableBackButton, true)
  assert.equal(survey.settings.fingerprinting.enabled, true)
  assert.equal(survey.settings.navigationLockAllPages.seconds, 15)
})

test('coffee screener workbook: settings + if_none brewing logic + matrix', () => {
  const parsed = parseWorkbookBuffer(readFileSync(coffeePath))
  const result = importPayloadSchema.safeParse(normalizeImportPayload(parsed))
  assert.equal(result.success, true, JSON.stringify(result.error?.issues))

  const meta = buildImportSurveyMeta(result.data.survey, { source: 'test', mode: 'create', warnings: [] })
  assert.equal(meta.settings.disableBackButton, true)
  assert.equal(meta.settings.fingerprinting.enabled, true)

  const s6 = result.data.items.find(i => i.code === 'S6')
  assert.equal(s6.terminationLogic, 'if_none')
  assert.equal(s6.terminationRules?.length, 1)
  assert.deepEqual(s6.terminationRules[0].optionCodes, ['S6_O2', 'S6_O3', 'S6_O5'])

  const { codeToId } = mapCodesToIds(result.data.items)
  const warnings = []
  const runtime = buildRuntimeItems(result.data.items, codeToId, { warnings })
  const runtimeS6 = runtime.find(i => i.id === codeToId.get('S6'))
  assert.equal(runtimeS6.terminationLogic, 'if_none')
  assert.equal(runtimeS6.terminationRules[0].optionIds.length, 3)

  const runtimeQ8 = runtime.find(i => i.id === codeToId.get('Q8'))
  assert.equal(runtimeQ8.matrixConfig.rows.length, 6)
  assert.equal(runtimeQ8.matrixConfig.columns.length, 5)
  assert.ok(!warnings.some(w => w.code === 'MATRIX_DEFAULTS'))
})

test('template workbook: branch target resolves to page break id', () => {
  const parsed = parseWorkbookBuffer(readFileSync(templatePath))
  const result = importPayloadSchema.safeParse(normalizeImportPayload(parsed))
  assert.equal(result.success, true, JSON.stringify(result.error?.issues))

  const { codeToId } = mapCodesToIds(result.data.items)
  const runtime = buildRuntimeItems(result.data.items, codeToId, { warnings: [] })
  const q1 = runtime.find(i => i.id === codeToId.get('Q1'))
  assert.equal(q1.branchRules.length, 1)
  assert.equal(q1.branchRules[0].targetPageBreakId, codeToId.get('PB1'))
})

test('choice without options validates and warns (import → pending QA)', () => {
  const payload = {
    schemaVersion: 1,
    survey: { title: 'Stub choice' },
    items: [
      {
        code: 'Q1',
        itemType: 'question',
        questionType: 'single_select',
        text: 'Placeholder stem',
        required: true,
      },
    ],
  }
  const result = importPayloadSchema.safeParse(normalizeImportPayload(payload))
  assert.equal(result.success, true, JSON.stringify(result.error?.issues))
  const { codeToId } = mapCodesToIds(result.data.items)
  const warnings = []
  const runtime = buildRuntimeItems(result.data.items, codeToId, { warnings })
  assert.equal(runtime[0].options.length, 0)
  assert.ok(warnings.some(w => w.code === 'CHOICE_OPTIONS'))
})
