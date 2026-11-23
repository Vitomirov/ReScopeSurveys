import test from 'node:test'
import assert from 'node:assert/strict'
import { parseTextOutline } from '../../../shared/surveyImport/parseTextOutline.js'
import { TEXT_OUTLINE_SAMPLE } from '../../../shared/surveyImport/textOutlineSample.js'
import { normalizeImportQuestionType } from '../../../shared/surveyImport/questionTiers.js'

const SAMPLE = `How satisfied are you with our product overall?
() Very satisfied
() Somewhat satisfied

Which features do you use? (Select all that apply)
[] Reporting
[] Analytics

What is your job title?
____

Feedback:
____
____`

test('parseTextOutline infers four question types from minimal sample', () => {
  const { items, warnings } = parseTextOutline(SAMPLE)
  assert.equal(items.length, 4)
  assert.equal(items[0].questionType, 'single_select')
  assert.equal(items[0].options.length, 2)
  assert.equal(items[1].questionType, 'multi_select')
  assert.equal(items[2].questionType, 'open_text')
  assert.equal(items[2].multiline, false)
  assert.equal(items[3].questionType, 'open_text')
  assert.equal(items[3].multiline, true)
  assert.ok(Array.isArray(warnings))
})

test('parseTextOutline directives: dropdown, screenout, matrix, page break', () => {
  const text = `@dropdown Pick one
() A
() B {screenout}

@page_break

@matrix Rate us
row: Speed
col: Low
col: High`
  const { items } = parseTextOutline(text)
  assert.equal(items[0].questionType, 'dropdown')
  assert.equal(items[0].options[1].terminates, true)
  assert.equal(items[1].itemType, 'page_break')
  assert.equal(items[2].questionType, 'matrix')
  assert.equal(items[2].importMeta.matrixRows[0], 'Speed')
})

test('parseTextOutline sample includes all builder question types', () => {
  const { items } = parseTextOutline(TEXT_OUTLINE_SAMPLE)
  const types = new Set(items.filter(i => i.itemType === 'question').map(i => i.questionType))
  const expected = [
    'single_select', 'multi_select', 'dropdown', 'open_text', 'matrix', 'nps', 'star_rating',
    'date', 'phone', 'slider', 'ranking', 'constant_sum', 'semantic_diff', 'bipolar_matrix',
    'maxdiff', 'card_sort', 'cascade', 'textbox_list', 'image_choice_single', 'image_choice_multi',
  ]
  for (const t of expected) {
    assert.ok(types.has(t), `missing type ${t}`)
  }
  assert.ok(items.some(i => i.itemType === 'page_break'))
  assert.ok(items.some(i => i.itemType === 'text_block'))
})

test('normalizeImportQuestionType maps legacy aliases', () => {
  assert.equal(normalizeImportQuestionType('max_diff'), 'maxdiff')
  assert.equal(normalizeImportQuestionType('semantic_differential'), 'semantic_diff')
})