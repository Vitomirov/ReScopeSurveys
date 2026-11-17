/**
 * Server-side gates for finalizing a response as complete (or client-claimed dnc).
 * Closes empty-complete forgery and DNC bypass by omitting the email answer.
 * Required and email answers are enforced only for questions the taker would
 * show: visible under show/hide, and on the branch path the answers actually
 * walk. A required question skipped by a forward branch is not a failed submit.
 * Termination is not re-run.
 */
import { extractResponseEmail, findEmailQuestion } from './dncCheck.js'
import { visibleQuestionIds } from '../../../../src/utils/survey/engines/itemVisibility.js'
import { buildVisiblePages } from '../../../../src/utils/survey/engines/visibilityEngine.js'
import { simulateRespondentPath } from '../../../../src/utils/survey/engines/progressEngine.js'

export function isAnswerEmpty(answer) {
  if (answer === null || answer === undefined || answer === '') return true
  if (Array.isArray(answer) && answer.length === 0) return true
  if (typeof answer === 'object' && !Array.isArray(answer)) {
    const values = Object.values(answer)
    if (values.length === 0) return true
    return values.every(isAnswerEmpty)
  }
  return false
}

/** Question ids on the pages this answer set would actually open. */
function questionIdsOnPath(items, responses) {
  const { pages } = buildVisiblePages(items, responses)
  const path = simulateRespondentPath(pages, items, responses)
  const ids = new Set()
  for (const index of path) {
    for (const item of pages[index] || []) {
      if (item?.itemType === 'question' && item.id) ids.add(item.id)
    }
  }
  return ids
}

/**
 * Validate that a complete/dnc submission has enough answers to finalize.
 * @returns {{ ok: true } | { ok: false, code: 'EMAIL_REQUIRED' | 'INCOMPLETE_ANSWERS' }}
 */
export function validateCompleteAnswers(entry, surveyItems = []) {
  const questions = (surveyItems || []).filter(item => item?.itemType === 'question')
  if (questions.length === 0) return { ok: true }

  const responses = entry?.responses && typeof entry.responses === 'object' && !Array.isArray(entry.responses)
    ? entry.responses
    : {}

  const visible = visibleQuestionIds(surveyItems, responses)
  const onPath = questionIdsOnPath(surveyItems, responses)
  const inPlay = onPath.size === 0
    ? visible
    : new Set([...visible].filter(id => onPath.has(id)))

  const emailQuestion = findEmailQuestion(surveyItems)
  if (emailQuestion && inPlay.has(emailQuestion.id) && !extractResponseEmail(entry, surveyItems)) {
    return { ok: false, code: 'EMAIL_REQUIRED' }
  }

  for (const question of questions) {
    if (!question.required || !inPlay.has(question.id)) continue
    if (isAnswerEmpty(responses[question.id])) {
      return { ok: false, code: 'INCOMPLETE_ANSWERS' }
    }
  }

  const anyAnswer = questions.some(q => inPlay.has(q.id) && !isAnswerEmpty(responses[q.id]))
  if (!anyAnswer) {
    return { ok: false, code: 'INCOMPLETE_ANSWERS' }
  }

  return { ok: true }
}
