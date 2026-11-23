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
  'maxdiff',
  'semantic_diff',
  'bipolar_matrix',
  'constant_sum',
  'card_sort',
  'ranking',
  'slider',
  'nps',
  'star_rating',
  'cascade',
  'date',
  'phone',
  'textbox_list',
  'image_choice_single',
  'image_choice_multi',
])

/** Legacy / AI payloads → builder questionType keys */
export const IMPORT_QUESTION_TYPE_ALIASES = {
  max_diff: 'maxdiff',
  semantic_differential: 'semantic_diff',
  bipolar: 'bipolar_matrix',
  image_choice: 'image_choice_single',
}

export function normalizeImportQuestionType(questionType) {
  const key = String(questionType || '').trim()
  if (!key) return key
  return IMPORT_QUESTION_TYPE_ALIASES[key] || key
}

export const TIER_C_IMAGE = new Set(['image_choice_single', 'image_choice_multi'])

export const IMPORT_PENDING_STATUS = 'pending_review'

export function tierForQuestionType(questionType) {
  if (TIER_A_FULL.has(questionType)) return 'A'
  if (TIER_B_PARTIAL.has(questionType)) return 'B'
  return 'C'
}

export function isImportableQuestionType(questionType) {
  return TIER_A_FULL.has(questionType) || TIER_B_PARTIAL.has(questionType)
}