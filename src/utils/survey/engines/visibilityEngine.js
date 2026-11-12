// ─── Visibility Evaluator ───────────────────────────────────────────────────
// Uses conditionEngine for all condition matching — same logic as termination
// blocks, so survey creators only need one mental model for AND/OR rules.

import { buildQuestionNumberById } from '../questions/questionHelpers.js'
import { isItemVisible } from './itemVisibility.js'
import {
  formatConditionPhraseBlockStyle,
  joinConditionPhrasesInline,
} from '../conditions/conditionSummary.js'
import { resolveNavigationLockSeconds } from '../../../constants/navigationLock.js'

/**
 * Termination blocks evaluate when the respondent leaves the page that holds
 * the questions they reference — not an empty page created by a page break
 * placed between the questions and the block.
 */
function terminationBlockTargetIndex(pagesArr) {
  for (let i = pagesArr.length - 1; i >= 0; i--) {
    if (pagesArr[i].some(it => it.itemType === 'question')) return i
  }
  return Math.max(0, pagesArr.length - 1)
}

/**
 * Walks the flat `items` array and builds the respondent-facing page
 * structure, fully respecting:
 *  - page_break visibility (a hidden break merges its two pages into one)
 *  - group visibility (hides every question that belongs to a hidden group)
 *  - per-question visibility
 *
 * Returns { pages, blocksByPage, navigationLockByPage, pageTitlesByPage } where
 * `pages` is an array of page item arrays, `blocksByPage[i]` holds termination
 * blocks for page i, `navigationLockByPage[i]` is the minimum seconds before
 * Next unlocks on page i, and `pageTitlesByPage[i]` is the title of the visible
 * page_break that started that page (null for page 0).
 *
 * Must be recomputed whenever `responses` changes, since visibility can
 * depend on answers given earlier in the survey.
 */
export function buildVisiblePages(items, responses, surveySettings = null) {
  // Pass 1: resolve visibility for every group, keyed by group id.
  const groupVisibility = {}
  items.forEach(item => {
    if (item.itemType === 'group') {
      groupVisibility[item.id] = isItemVisible(item, responses, items)
    }
  })

  const allPagesLock = resolveNavigationLockSeconds(surveySettings?.navigationLockAllPages)
  let pageOneOnlyLock = resolveNavigationLockSeconds(surveySettings?.pageOneNavigationLock)
  // Legacy: `navigationLock` was previously used for page-1-only before all-pages key existed.
  if (!pageOneOnlyLock && !allPagesLock) {
    pageOneOnlyLock = resolveNavigationLockSeconds(surveySettings?.navigationLock)
  }

  const pageLock = (pageBreakLock = 0) => (allPagesLock > 0 ? allPagesLock : pageBreakLock)

  const pagesArr  = [[]]
  const blocksArr = [[]]
  const locksArr  = [allPagesLock > 0 ? allPagesLock : Math.max(pageOneOnlyLock)]
  const titlesArr = [null]
  let currentGroupId = null

  const applyGroupLock = (groupItem) => {
    if (allPagesLock > 0) return
    if (groupVisibility[groupItem.id] === false) return
    const groupLock = resolveNavigationLockSeconds(groupItem.navigationLock)
    if (groupLock <= 0) return
    const idx = pagesArr.length - 1
    locksArr[idx] = Math.max(locksArr[idx] || 0, groupLock)
  }

  const startNewPage = (pageBreakLock = 0, pageTitle = null) => {
    currentGroupId = null
    pagesArr.push([])
    blocksArr.push([])
    locksArr.push(pageLock(pageBreakLock))
    titlesArr.push(pageTitle || null)
  }

  for (const item of items) {
    if (item.itemType === 'group') {
      currentGroupId = item.id
      applyGroupLock(item)
      continue
    }

    if (item.itemType === 'page_break') {
      const breakLock = allPagesLock > 0 ? 0 : resolveNavigationLockSeconds(item.navigationLock)
      if (!isItemVisible(item, responses, items)) {
        if (breakLock > 0) {
          const idx = pagesArr.length - 1
          locksArr[idx] = Math.max(locksArr[idx] || 0, breakLock)
        }
        continue // merges into current page
      }
      startNewPage(breakLock, item.title)
      continue
    }

    if (item.itemType === 'termination_block') {
      const targetIdx = terminationBlockTargetIndex(pagesArr)
      blocksArr[targetIdx].push(item)
      continue
    }

    // text_block — visible/hidden by same logic as questions
    if (item.itemType === 'text_block') {
      if (!isItemVisible(item, responses, items)) continue
      pagesArr[pagesArr.length - 1].push(item)
      continue
    }

    // question
    if (currentGroupId && groupVisibility[currentGroupId] === false) continue
    if (!isItemVisible(item, responses, items)) continue

    pagesArr[pagesArr.length - 1].push(item)
  }

  const filtered = pagesArr
    .map((p, i) => ({
      p,
      b: blocksArr[i] || [],
      l: locksArr[i] || 0,
      t: titlesArr[i] ?? null,
    }))
    .filter(x => x.p.length > 0)

  return {
    pages: filtered.map(x => x.p),
    blocksByPage: filtered.map(x => x.b),
    navigationLockByPage: filtered.map(x => x.l),
    pageTitlesByPage: filtered.map(x => x.t),
  }
}

export function visibilitySummary(vis, allItems) {
  if (!vis?.enabled || !vis.conditions?.length) return null

  const qNumById = buildQuestionNumberById(allItems)
  const itemById = {}
  for (const item of allItems) itemById[item.id] = item

  const verb = vis.mode === 'hide_if' ? 'Hidden if' : 'Shown only if'
  const phrases = vis.conditions.map(c => {
    const q = itemById[c.questionId]
    const qLabel = q ? `Q${qNumById[q.id] ?? '?'}` : '?'
    return formatConditionPhraseBlockStyle(c, q, allItems, qLabel)
  })
  const parts = joinConditionPhrasesInline(vis.conditions, phrases)
  return `${verb}: ${parts}`
}

/** Visible page index for content after `targetPageBreakId` (`__start__` → 0). */
export function findPageIndexForBreak(items, responses, targetPageBreakId, pages) {
  if (!targetPageBreakId || targetPageBreakId === '__start__') return 0
  if (!pages?.length) return null

  const groupVisibility = {}
  items.forEach(item => {
    if (item.itemType === 'group') {
      groupVisibility[item.id] = isItemVisible(item, responses, items)
    }
  })

  let afterTarget = false
  let currentGroupId = null

  for (const item of items) {
    if (item.itemType === 'group') {
      currentGroupId = item.id
      continue
    }

    if (item.itemType === 'page_break') {
      if (!isItemVisible(item, responses, items)) continue
      if (item.id === targetPageBreakId) {
        afterTarget = true
        currentGroupId = null
        continue
      }
      if (afterTarget) break
      currentGroupId = null
      continue
    }

    if (!afterTarget) continue
    if (item.itemType === 'termination_block') continue

    if (item.itemType === 'text_block') {
      if (!isItemVisible(item, responses, items)) continue
      const idx = pages.findIndex(page => page.some(p => p.id === item.id))
      return idx >= 0 ? idx : null
    }

    if (item.itemType === 'question') {
      if (currentGroupId && groupVisibility[currentGroupId] === false) continue
      if (!isItemVisible(item, responses, items)) continue
      const idx = pages.findIndex(page => page.some(p => p.id === item.id))
      return idx >= 0 ? idx : null
    }
  }

  return null
}
