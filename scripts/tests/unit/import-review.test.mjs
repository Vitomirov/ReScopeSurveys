import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getItemImportIssues,
  collectImportReviewEntries,
  summarizeImportReview,
  markItemImportReviewed,
} from '../../../src/utils/survey/importReview.js'

test('choice without options is action severity', () => {
  const issues = getItemImportIssues({
    id: '1',
    itemType: 'question',
    questionType: 'single_select',
    text: 'Age',
    options: [],
  })
  assert.equal(issues[0].code, 'CHOICE_OPTIONS')
  assert.equal(issues[0].severity, 'action')
})

test('choice options clear the issue', () => {
  const issues = getItemImportIssues({
    id: '1',
    itemType: 'question',
    questionType: 'single_select',
    text: 'Age',
    options: [{ id: 'o1', text: '18+' }],
  })
  assert.equal(issues.length, 0)
})

test('partial stub is dismissible via reviewed', () => {
  const open = getItemImportIssues({
    id: '1',
    itemType: 'question',
    questionType: 'nps',
    text: 'NPS',
    importMeta: { partial: true },
  })
  assert.equal(open[0].code, 'PARTIAL_TYPE')
  assert.equal(open[0].dismissible, true)

  const closed = getItemImportIssues({
    id: '1',
    itemType: 'question',
    questionType: 'nps',
    text: 'NPS',
    importMeta: markItemImportReviewed({ partial: true }),
  })
  assert.equal(closed.length, 0)
})

test('collect + summarize open items', () => {
  const entries = collectImportReviewEntries([
    { id: 'a', itemType: 'question', questionType: 'single_select', text: 'A', options: [] },
    { id: 'b', itemType: 'question', questionType: 'nps', text: 'B', importMeta: { partial: true } },
  ])
  assert.equal(entries.length, 2)
  assert.equal(entries[0].questionNumber, 1)
  const summary = summarizeImportReview(entries)
  assert.equal(summary.action, 1)
  assert.equal(summary.review, 1)
  assert.equal(summary.openItems, 2)
})
