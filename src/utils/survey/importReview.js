import { isChoiceType } from './questions/questionTypeFlags.js'

/** Warning codes already shown on the question card — hide from survey-level "other notes". */
const SURFACED_ON_ITEM = new Set([
  'CHOICE_OPTIONS',
  'PARTIAL_TYPE',
  'MATRIX_DEFAULTS',
  'BRANCH_TARGET',
  'BRANCH_NONE_TARGET',
  'TERMINATION_BLOCK_STUB',
])

/**
 * Live import QA issues for one builder item.
 * Choice/option gaps auto-clear when fixed; stub flags clear via Mark reviewed.
 */
export function getItemImportIssues(item) {
  if (!item) return []
  const reviewed = item.importMeta?.reviewed === true
  const issues = []

  if (item.itemType === 'termination_block' && !reviewed) {
    const empty = !Array.isArray(item.conditions) || item.conditions.length === 0
    if (empty || item.importMeta?.stub) {
      issues.push({
        code: 'TERMINATION_BLOCK_STUB',
        severity: 'review',
        title: 'Finish screenout block',
        detail: 'Conditions were not imported. Add rules here, or delete this block if unused.',
        dismissible: true,
      })
    }
    return issues
  }

  if (item.itemType !== 'question') return []

  if (isChoiceType(item.questionType) && !(item.options?.length > 0)) {
    issues.push({
      code: 'CHOICE_OPTIONS',
      severity: 'action',
      title: 'Add answer options',
      detail: 'This question has no choices yet. Add options before going Live — respondents cannot answer without them.',
    })
  }

  if (item.importMeta?.partial && !reviewed) {
    issues.push({
      code: 'PARTIAL_TYPE',
      severity: 'review',
      title: `Finish ${item.questionType || 'question'} setup`,
      detail: 'Imported as a stub. Configure scales, cards, images, or type-specific settings before going Live.',
      dismissible: true,
    })
  }

  if (item.importMeta?.needsMatrixReview && !reviewed) {
    issues.push({
      code: 'MATRIX_DEFAULTS',
      severity: 'review',
      title: 'Review matrix rows & columns',
      detail: 'Grid labels used builder defaults. Confirm rows and scale columns match the brief.',
      dismissible: true,
    })
  }

  if ((item.branchRules || []).some(r => !r?.targetPageBreakId)) {
    issues.push({
      code: 'BRANCH_TARGET',
      severity: 'action',
      title: 'Fix skip / branch target',
      detail: 'A skip rule is missing its page destination. Set the target page break or remove the rule.',
    })
  }

  return issues
}

/**
 * @returns {{ itemId: string, itemType: string, questionNumber: number|null, label: string, issues: object[] }[]}
 */
export function collectImportReviewEntries(items) {
  const entries = []
  let qNum = 0
  for (const item of items || []) {
    if (item.itemType === 'question') qNum += 1
    const issues = getItemImportIssues(item)
    if (!issues.length) continue
    const label =
      item.itemType === 'question'
        ? (item.text?.trim() || 'Untitled question')
        : (item.title?.trim() || 'Termination block')
    entries.push({
      itemId: item.id,
      itemType: item.itemType,
      questionNumber: item.itemType === 'question' ? qNum : null,
      label,
      issues,
    })
  }
  return entries
}

export function summarizeImportReview(entries) {
  let action = 0
  let review = 0
  for (const e of entries) {
    for (const issue of e.issues) {
      if (issue.severity === 'action') action += 1
      else review += 1
    }
  }
  return { action, review, total: action + review, openItems: entries.length }
}

/** Survey-level warnings not already shown on a question card. */
export function orphanImportWarnings(surveyWarnings, entries) {
  const onCard = new Set()
  for (const e of entries) {
    for (const issue of e.issues) onCard.add(issue.code)
  }
  return (Array.isArray(surveyWarnings) ? surveyWarnings : []).filter(w => {
    if (!w?.message) return false
    if (w.code && (onCard.has(w.code) || SURFACED_ON_ITEM.has(w.code))) return false
    return true
  })
}

export function markItemImportReviewed(importMeta = {}) {
  return {
    ...importMeta,
    reviewed: true,
    partial: false,
    needsMatrixReview: false,
    stub: false,
  }
}
