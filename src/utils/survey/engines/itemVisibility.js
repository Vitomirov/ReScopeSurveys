// Same show/hide rule the taker uses. Kept free of page layout so the server
// can require answers only for questions the respondent would actually see.

import { evalConditionSet } from './conditionEngine.js'

/**
 * Returns true if `item` (a question, page_break, or group) should be
 * visible given the current `responses`. Items with no visibility config,
 * or visibility disabled, are always visible.
 */
export function isItemVisible(item, responses, allItems) {
  const vis = item?.visibility
  if (!vis || !vis.enabled || !vis.conditions?.length) return true

  const matched = evalConditionSet(vis.conditions, responses, allItems)
  return vis.mode === 'hide_if' ? !matched : matched
}

/**
 * Question ids the respondent would see for these answers.
 * Group membership follows item order until a visible page break, matching
 * buildVisiblePages — not a groupId field.
 * O(n) items; each visibility check is the existing condition evaluation.
 */
export function visibleQuestionIds(items, responses) {
  const list = items || []
  const answers = responses && typeof responses === 'object' && !Array.isArray(responses)
    ? responses
    : {}

  const groupVisibility = {}
  for (const item of list) {
    if (item?.itemType === 'group') {
      groupVisibility[item.id] = isItemVisible(item, answers, list)
    }
  }

  const visible = new Set()
  let currentGroupId = null

  for (const item of list) {
    if (!item) continue
    if (item.itemType === 'group') {
      currentGroupId = item.id
      continue
    }
    if (item.itemType === 'page_break') {
      if (isItemVisible(item, answers, list)) currentGroupId = null
      continue
    }
    if (item.itemType !== 'question') continue
    if (currentGroupId && groupVisibility[currentGroupId] === false) continue
    if (!isItemVisible(item, answers, list)) continue
    visible.add(item.id)
  }

  return visible
}
