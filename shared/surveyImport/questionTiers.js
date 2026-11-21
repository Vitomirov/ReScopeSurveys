/** Question type tiers for survey import (shared client + server). */

export const TIER_A_FULL = new Set([
  'single_select',
  'multi_select',
  'dropdown',
  'open_text',
  'matrix',
  'page_break',
  'text_block',
])

export const TIER_B_PARTIAL = new Set([
  'max_diff',
  'semantic_differential',
  'bipolar',
  'constant_sum',
  'card_sort',
  'ranking',
  'slider',
  'nps',
  'cascade',
  'date',
  'phone',
  'image_choice',
])

export const TIER_C_IMAGE = new Set(['image_choice'])

export const IMPORT_PENDING_STATUS = 'pending_review'

export function tierForQuestionType(questionType) {
  if (TIER_A_FULL.has(questionType)) return 'A'
  if (TIER_B_PARTIAL.has(questionType)) return 'B'
  return 'C'
}

export function isImportableQuestionType(questionType) {
  return TIER_A_FULL.has(questionType) || TIER_B_PARTIAL.has(questionType)
}