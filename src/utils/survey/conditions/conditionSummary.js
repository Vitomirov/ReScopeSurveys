// ─── Condition summary formatting ─────────────────────────────────────────────
// Shared plain-text formatters for visibility summaries, termination block
// causes, and builder condition previews. Evaluation logic lives in conditionEngine.

import { isChoiceType, isMatrixType } from '../questions/questionTypeFlags.js'
import { resolveOptionLabel } from '../questions/questionOptions.js'
import { getChoiceConditionLabel, isDateQuestion, isSliderQuestion, TEXT_CONDITION_TYPES } from './conditionConstants.js'
import { formatDateConditionPhrase } from './dateOperators.js'
import { formatSliderConditionPhrase } from './sliderOperators.js'

export function getMatrixRowLabel(matrixConfig, rowId, fallback = 'row') {
  return matrixConfig?.rows?.find(r => r.id === rowId)?.text || fallback
}

export function getMatrixColumnLabels(matrixConfig, columnIds, fallback = '?') {
  return (columnIds || []).map(id =>
    matrixConfig?.columns?.find(col => col.id === id)?.text || fallback
  )
}

/** Whether a condition on this question uses option/column pickers. */
export function usesOptionCondition(question) {
  if (!question) return false
  if (isMatrixType(question.questionType)) return true
  if (isChoiceType(question.questionType)) return true
  if (question.pipedOptionsConfig?.enabled) return true
  return false
}

/**
 * Plain phrase for visibility summaries and termination block causes.
 * Uses underscore-replaced condition types (e.g. "any of").
 */
export function formatConditionPhraseBlockStyle(cond, question, contextItems, qLabel) {
  if (!question) return null

  if (isMatrixType(question.questionType)) {
    const rowLabel = getMatrixRowLabel(question.matrixConfig, cond.matrixRowId)
    const colLabels = getMatrixColumnLabels(question.matrixConfig, cond.matrixColumnIds)
    const op = cond.conditionType?.replace(/_/g, ' ') || ''
    return `${qLabel} row "${rowLabel}" ${op} [${colLabels.join(', ')}]`
  }

  if (isChoiceType(question.questionType) || question.pipedOptionsConfig?.enabled) {
    const labels = (cond.optionIds || []).map(id => resolveOptionLabel(question, id, contextItems))
    const op = cond.conditionType?.replace(/_/g, ' ') || ''
    return `${qLabel} ${op} [${labels.join(', ')}]`
  }

  if (isDateQuestion(question)) {
    return `${qLabel} ${formatDateConditionPhrase(cond.textOperator, cond.textValue, cond.textValue2)}`
  }

  if (isSliderQuestion(question)) {
    return `${qLabel} ${formatSliderConditionPhrase(cond.textOperator, cond.textValue, cond.textValue2)}`
  }

  const op = cond.textOperator?.replace(/_/g, ' ') || ''
  return `${qLabel} ${op} "${cond.textValue || ''}"`
}

/**
 * Plain phrase for termination block logic preview (Q-number labels).
 * Uses human-readable condition labels (e.g. "is any of").
 */
export function formatConditionPhraseLogicStyle(cond, question, contextItems, qLabel) {
  if (!question) return null

  if (isMatrixType(question.questionType)) {
    const rowLbl = getMatrixRowLabel(question.matrixConfig, cond.matrixRowId)
    const ct = getChoiceConditionLabel(cond.conditionType)
    const cols = getMatrixColumnLabels(question.matrixConfig, cond.matrixColumnIds)
    return `${qLabel} row "${rowLbl}" ${ct} [${cols.join(', ') || 'none'}]`
  }

  if (usesOptionCondition(question)) {
    const ct = getChoiceConditionLabel(cond.conditionType)
    const opts = (cond.optionIds || []).map(id => resolveOptionLabel(question, id, contextItems))
    return `${qLabel} ${ct} [${opts.join(', ') || 'none'}]`
  }

  if (isDateQuestion(question)) {
    return `${qLabel} ${formatDateConditionPhrase(cond.textOperator, cond.textValue, cond.textValue2)}`
  }

  if (isSliderQuestion(question)) {
    return `${qLabel} ${formatSliderConditionPhrase(cond.textOperator, cond.textValue, cond.textValue2)}`
  }

  const op = TEXT_CONDITION_TYPES.find(t => t.value === cond.textOperator)?.label || cond.textOperator
  return `${qLabel} ${op} "${cond.textValue || '…'}"`
}

/** Join condition phrases with AND/OR for inline / block-cause summaries. */
export function joinConditionPhrasesInline(conditions, phrases) {
  return conditions.map((c, i) => {
    const phrase = phrases[i]
    if (!phrase) return null
    return i === 0 ? phrase : `${c.join} ${phrase}`
  }).filter(Boolean).join(' ')
}

/** Join condition phrases with AND/OR, newline-separated (block editor preview). */
export function joinConditionPhrasesMultiline(conditions, phrases) {
  return conditions.map((c, i) => {
    const phrase = phrases[i]
    if (i === 0) return phrase
    return `${c.join || 'AND'} ${phrase}`
  }).join('\n')
}

/** Truncated question text label used in termination block cause strings. */
export function buildBlockQuestionLabel(question) {
  return question?.text ? `"${question.text.slice(0, 40)}…"` : 'a question'
}
