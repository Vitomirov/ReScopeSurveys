/**
 * Survey import — question types, aliases, and authoring hints (workbook + text outline).
 * Runtime keys match builder QUESTION_TYPES (see src/utils/survey/questions/questionHelpers.js).
 */

import { TIER_A_FULL, TIER_B_PARTIAL, normalizeImportQuestionType } from './questionTiers.js'

export { normalizeImportQuestionType }

/** @typedef {{ questionType: string, tier: 'A'|'B', label: string, textOutline: string, workbook: string }} ImportTypeRef */

/** @type {ImportTypeRef[]} */
export const IMPORT_TYPE_REFERENCE = [
  {
    questionType: 'single_select',
    tier: 'A',
    label: 'Single select',
    textOutline: 'Stem, then () option lines. Blank line before next question.',
    workbook: 'itemType=question, questionType=single_select; options on Options sheet',
  },
  {
    questionType: 'multi_select',
    tier: 'A',
    label: 'Multi select',
    textOutline: '[] option lines and/or "select all that apply" in stem',
    workbook: 'questionType=multi_select; isExclusive=Y on option for "none of the above"',
  },
  {
    questionType: 'dropdown',
    tier: 'A',
    label: 'Dropdown',
    textOutline: '@dropdown stem then () options (same as single select)',
    workbook: 'questionType=dropdown + options sheet',
  },
  {
    questionType: 'open_text',
    tier: 'A',
    label: 'Open text',
    textOutline: 'One ____ = short text; multiple ____ = long text; stem-only = short text (warning)',
    workbook: 'questionType=open_text',
  },
  {
    questionType: 'matrix',
    tier: 'A',
    label: 'Matrix grid',
    textOutline: '@matrix stem, then row: and col: lines',
    workbook: 'questionType=matrix; prefer Matrix sheet (axis=row|col). Defaults if omitted.',
  },
  {
    questionType: 'page_break',
    tier: 'A',
    label: 'Page break',
    textOutline: '@page_break alone in a block',
    workbook: 'itemType=page_break (no questionType)',
  },
  {
    questionType: 'text_block',
    tier: 'A',
    label: 'Text block',
    textOutline: '@text_block Title optional — following lines = body',
    workbook: 'itemType=text_block; title + content columns',
  },
  {
    questionType: 'date',
    tier: 'B',
    label: 'Date',
    textOutline: '@date stem',
    workbook: 'questionType=date — finish format in builder',
  },
  {
    questionType: 'phone',
    tier: 'B',
    label: 'Phone',
    textOutline: '@phone stem',
    workbook: 'questionType=phone',
  },
  {
    questionType: 'nps',
    tier: 'B',
    label: 'NPS',
    textOutline: '@nps stem',
    workbook: 'questionType=nps',
  },
  {
    questionType: 'slider',
    tier: 'B',
    label: 'Slider',
    textOutline: '@slider stem',
    workbook: 'questionType=slider',
  },
  {
    questionType: 'star_rating',
    tier: 'B',
    label: 'Star rating',
    textOutline: '@star_rating stem',
    workbook: 'questionType=star_rating',
  },
  {
    questionType: 'semantic_diff',
    tier: 'B',
    label: 'Semantic differential',
    textOutline: '@semantic_diff stem',
    workbook: 'questionType=semantic_diff',
  },
  {
    questionType: 'bipolar_matrix',
    tier: 'B',
    label: 'Bipolar matrix',
    textOutline: '@bipolar_matrix stem',
    workbook: 'questionType=bipolar_matrix',
  },
  {
    questionType: 'ranking',
    tier: 'B',
    label: 'Ranking',
    textOutline: '@ranking stem; () lines = rank items (labels only)',
    workbook: 'questionType=ranking',
  },
  {
    questionType: 'constant_sum',
    tier: 'B',
    label: 'Constant sum',
    textOutline: '@constant_sum stem; () lines = allocation items',
    workbook: 'questionType=constant_sum',
  },
  {
    questionType: 'card_sort',
    tier: 'B',
    label: 'Card sort',
    textOutline: '@card_sort stem; () lines = card labels',
    workbook: 'questionType=card_sort',
  },
  {
    questionType: 'maxdiff',
    tier: 'B',
    label: 'MaxDiff',
    textOutline: '@maxdiff stem; () lines = item labels',
    workbook: 'questionType=maxdiff',
  },
  {
    questionType: 'cascade',
    tier: 'B',
    label: 'Cascading dropdown',
    textOutline: '@cascade stem',
    workbook: 'questionType=cascade',
  },
  {
    questionType: 'textbox_list',
    tier: 'B',
    label: 'Textbox list',
    textOutline: '@textbox_list stem; () lines = row labels',
    workbook: 'questionType=textbox_list',
  },
  {
    questionType: 'image_choice_single',
    tier: 'B',
    label: 'Image choice (single)',
    textOutline: '@image_choice_single stem (images added in builder)',
    workbook: 'questionType=image_choice_single — no image binary import',
  },
  {
    questionType: 'image_choice_multi',
    tier: 'B',
    label: 'Image choice (multi)',
    textOutline: '@image_choice_multi stem',
    workbook: 'questionType=image_choice_multi',
  },
]

const TEXT_DIRECTIVE_TYPES = new Set([
  ...TIER_A_FULL,
  ...TIER_B_PARTIAL,
  'page_break',
  'text_block',
])

export function isKnownTextDirective(type) {
  const normalized = normalizeImportQuestionType(type)
  return TEXT_DIRECTIVE_TYPES.has(normalized)
    || normalized === 'page_break'
    || normalized === 'text_block'
}