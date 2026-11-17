// ─── Termination Engine ─────────────────────────────────────────────────────
// Screen-out logic for the survey taker: per-question rules, instant option
// terminates, and termination blocks. Condition matching delegates to
// conditionEngine so visibility and termination share identical evaluators.

import { isChoiceType } from '../questions/questionTypeFlags.js'
import { evalConditionSet, evalTextOperator } from './conditionEngine.js'
import {
  dateOperatorNeedsEndValue,
  dateOperatorNeedsValue,
  evalDateOperator,
} from '../conditions/dateOperators.js'
import {
  evalSliderOperator,
  sliderOperatorNeedsEndValue,
  sliderOperatorNeedsValue,
} from '../conditions/sliderOperators.js'
import { evalMatrixSelection } from '../conditions/matrixHelpers.js'
import { getEffectiveOptions } from '../questions/questionOptions.js'
import {
  buildBlockQuestionLabel,
  formatConditionPhraseBlockStyle,
  joinConditionPhrasesInline,
} from '../conditions/conditionSummary.js'
import { normalizeQuestionRuleLogic } from '../conditions/questionRuleLogic.js'

/**
 * Evaluate a rule set with if_any (OR) or if_none (AND-inverted) logic.
 * - if_any: fires when at least one rule matches
 * - if_none: fires when no rules match
 */
export function evaluateRulesWithLogic(rules, logic, question, answer, responses, allItems) {
  if (!rules.length) return { shouldFire: false, firedRuleIndex: -1 }

  const results = rules.map(r => evaluateQuestionRule(r, question, answer, responses, allItems))
  const mode = normalizeQuestionRuleLogic(logic)

  if (mode === 'if_any') {
    const firedRuleIndex = results.findIndex(Boolean)
    return { shouldFire: firedRuleIndex !== -1, firedRuleIndex }
  }

  return { shouldFire: results.every(r => !r), firedRuleIndex: -1 }
}

/** Evaluate a termination block's conditions (AND/OR). */
export function evalBlock(block, responses, allItems) {
  return evalConditionSet(block.conditions, responses, allItems)
}

function resolveOptions(question, answer, responses, allItems) {
  if (question.pipedOptionsConfig?.enabled && allItems?.length) {
    return getEffectiveOptions(question, responses, allItems)
  }
  return question.options || []
}

/** Infer how a rule should be evaluated for this question type. */
export function resolveQuestionRuleType(rule, question) {
  const qType = question.questionType
  if (qType === 'open_text') return 'text'
  if (qType === 'date') return 'date'
  if (qType === 'slider') return 'slider'
  if (qType === 'matrix') return rule.ruleType === 'text' ? 'text' : 'matrix'
  return rule.ruleType || 'choice'
}

/** Text compared in text rules — typed answer or selected option label(s). */
function resolveTextRuleHaystack(question, answer, responses, allItems) {
  const qType = question.questionType
  const isPipedChoice = question.pipedOptionsConfig?.enabled

  if (!isChoiceType(qType) && !isPipedChoice) {
    return String(answer)
  }

  const opts = resolveOptions(question, answer, responses, allItems)
  if (qType === 'multi_select') {
    const selected = Array.isArray(answer) ? answer : []
    return selected.map(id => opts.find(o => o.id === id)?.text || '').filter(Boolean).join(' ')
  }
  return opts.find(o => o.id === answer)?.text || ''
}

// ─── Per-question rule matching (shared by termination + branching) ─────────
export function evaluateQuestionRule(rule, question, answer, responses, allItems) {
  const ruleType = resolveQuestionRuleType(rule, question)

  if (ruleType === 'matrix') {
    return evalMatrixSelection(rule, question, answer)
  }

  if (ruleType === 'slider') {
    if (sliderOperatorNeedsValue(rule.textOperator) && !String(rule.textValue ?? '').trim()) return false
    if (sliderOperatorNeedsEndValue(rule.textOperator) && !String(rule.textValue2 ?? '').trim()) return false
    return evalSliderOperator(answer, rule.textOperator, rule.textValue, rule.textValue2)
  }

  if (ruleType === 'date') {
    if (dateOperatorNeedsValue(rule.textOperator) && !String(rule.textValue ?? '').trim()) return false
    if (dateOperatorNeedsEndValue(rule.textOperator) && !String(rule.textValue2 ?? '').trim()) return false
    return evalDateOperator(answer, rule.textOperator, rule.textValue, rule.textValue2)
  }

  if (ruleType === 'text') {
    if (answer === null || answer === undefined || answer === '') return false
    if (!String(rule.textValue ?? '').trim()) return false
    const haystack = resolveTextRuleHaystack(question, answer, responses, allItems)
    if (!haystack.trim()) return false
    return evalTextOperator(haystack, rule.textOperator || 'contains', rule.textValue)
  }

  const qType = question.questionType
  const isPipedChoice = question.pipedOptionsConfig?.enabled

  if (qType === 'single_select' || qType === 'dropdown' || isPipedChoice) {
    if (!answer) return false
    return rule.optionIds.includes(answer)
  }
  if (qType === 'multi_select') {
    const selected = Array.isArray(answer) ? answer : []
    if (!selected.length) return false
    if (rule.matchMode === 'all') {
      return rule.optionIds.length > 0 && rule.optionIds.every(id => selected.includes(id))
    }
    return rule.optionIds.some(id => selected.includes(id))
  }
  return false
}

/** Returns { terminated: boolean, cause?: string } */
export function checkTermination(question, answer, responses = {}, allItems = []) {
  const qType = question.questionType
  const opts  = resolveOptions(question, answer, responses, allItems)
  const isPipedChoice = question.pipedOptionsConfig?.enabled

  // ── 1. Per-option instant terminate ─────────────────────────────────────
  if (isChoiceType(qType) || isPipedChoice) {
    if (qType === 'single_select' || qType === 'dropdown' || isPipedChoice) {
      if (answer) {
        const opt = opts.find(o => o.id === answer)
        if (opt?.terminates) return { terminated: true, cause: opt.text }
      }
    } else if (qType === 'multi_select') {
      const selected = Array.isArray(answer) ? answer : []
      const termOpt  = opts.find(o => selected.includes(o.id) && o.terminates)
      if (termOpt) return { terminated: true, cause: termOpt.text }
    }
  }

  // ── 2. terminationRules evaluated with terminationLogic ─────────────────
  const rules = question.terminationRules || []
  if (!rules.length) return { terminated: false }

  const logic = normalizeQuestionRuleLogic(question.terminationLogic)
  const { shouldFire, firedRuleIndex } = evaluateRulesWithLogic(
    rules, logic, question, answer, responses, allItems,
  )
  if (!shouldFire) return { terminated: false }

  if (logic === 'if_none') {
    return { terminated: true, cause: 'No qualifying condition met' }
  }

  const firedRule = rules[firedRuleIndex]
  const firedType = resolveQuestionRuleType(firedRule, question)
  if (firedType === 'matrix') {
    const row = question.matrixConfig?.rows?.find(r => r.id === firedRule.matrixRowId)
    const cols = (firedRule.matrixColumnIds || []).map(id =>
      question.matrixConfig?.columns?.find(c => c.id === id)?.text || '?'
    )
    return {
      terminated: true,
      cause: firedRule.note || `${row?.text || 'Row'}: ${cols.join(', ')}`,
    }
  }
  return {
    terminated: true,
    cause: firedRule.note || (
      firedType === 'text'
        ? `Answer ${firedRule.textOperator?.replace(/_/g,' ')} "${firedRule.textValue}"`
        : firedType === 'date'
          ? `Date ${firedRule.textOperator?.replace(/_/g,' ')} ${firedRule.textValue || ''}`
          : firedType === 'slider'
            ? `Slider ${firedRule.textOperator?.replace(/_/g,' ')} ${firedRule.textValue || ''}`
            : `Rule ${firedRuleIndex + 1} matched`
    ),
  }
}

/** Build readable cause string from a fired termination block. */
export function buildBlockCause(block, responses, allItems) {
  const conds = block.conditions || []
  const phrases = conds.map(c => {
    const q = allItems.find(item => item.id === c.questionId)
    const qLabel = q ? buildBlockQuestionLabel(q) : 'a question'
    return formatConditionPhraseBlockStyle(c, q, allItems, qLabel)
  })
  return joinConditionPhrasesInline(conds, phrases)
}
