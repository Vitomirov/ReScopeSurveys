import test from 'node:test'
import assert from 'node:assert/strict'
import { parseTextOutline } from '../../../shared/surveyImport/parseTextOutline.js'

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

test('parseTextOutline infers four question types from sample', () => {
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