import { randomUUID } from 'node:crypto'
import { tierForQuestionType, TIER_C_IMAGE } from '../../../../../shared/surveyImport/questionTiers.js'

function baseVisibility() {
  return { enabled: false, mode: 'show_if', conditions: [] }
}

function makeOption(text, id) {
  return {
    id,
    text,
    anchorPosition: null,
    isExclusive: false,
    terminates: false,
    openText: { enabled: false, required: false, placeholder: 'Please specify' },
  }
}

function makeQuestionSkeleton(questionType, text, id, { partial = false } = {}) {
  const base = {
    id,
    itemType: 'question',
    questionType,
    text: text || '',
    required: true,
    groupId: null,
    isEmailField: false,
    pipedOptionsConfig: {
      enabled: false,
      sourceQuestionId: null,
      matrixRowId: null,
      matrixPipeMode: 'rows',
    },
    visibility: baseVisibility(),
    options: [],
    minSelections: null,
    maxSelections: null,
    randomizeOptions: false,
    terminationRules: [],
    terminationLogic: 'if_any',
    branchRules: [],
    branchLogic: 'if_any',
    branchNoneTargetPageBreakId: '',
    externalRedirectRules: [],
    externalRedirectLogic: 'if_any',
    externalRedirectNoneUrl: '',
    openTextConfig: {
      multiline: false,
      placeholder: 'Your answer',
      minLength: null,
      maxLength: null,
      validation: { type: 'none', numberMin: null, numberMax: null },
    },
  }
  if (partial) {
    base.importMeta = { partial: true }
  }
  return base
}

export function buildRuntimeItems(importItems, codeToId, { warnings = [] } = {}) {
  const out = []

  for (const raw of importItems) {
    const id = codeToId.get(raw.code)
    if (!id) {
      warnings.push({ code: 'MISSING_CODE', message: `No id for code ${raw.code}` })
      continue
    }

    if (raw.itemType === 'page_break') {
      out.push({
        id,
        itemType: 'page_break',
        visibility: baseVisibility(),
        navigationLock: { enabled: false, message: '' },
      })
      continue
    }

    if (raw.itemType === 'text_block') {
      out.push({
        id,
        itemType: 'text_block',
        title: raw.title || '',
        content: raw.content || raw.text || '',
        image: null,
        imageCaption: '',
        visibility: baseVisibility(),
      })
      continue
    }

    if (raw.itemType !== 'question') continue

    const tier = tierForQuestionType(raw.questionType)
    const partial = tier === 'B' || (tier === 'C' && !TIER_C_IMAGE.has(raw.questionType))
    const q = makeQuestionSkeleton(raw.questionType, raw.text, id, { partial: partial || tier === 'B' })

    q.required = raw.required !== false
    if (raw.questionType === 'open_text') {
      q.openTextConfig.multiline = Boolean(raw.multiline)
      q.required = raw.required === true
    }

    if (['single_select', 'multi_select', 'dropdown'].includes(raw.questionType) && raw.options?.length) {
      q.options = raw.options.map(opt => {
        const oid = codeToId.get(opt.code) || randomUUID()
        const option = makeOption(opt.text, oid)
        if (opt.terminates) option.terminates = true
        if (opt.isExclusive) option.isExclusive = true
        return option
      })
    }

    if (raw.questionType === 'matrix' && tier === 'A') {
      q.matrixConfig = {
        subType: 'single',
        rows: [{ id: randomUUID(), text: 'Row 1' }],
        columns: [{ id: randomUUID(), text: 'Column 1' }],
        randomizeRows: false,
      }
      warnings.push({ code: 'MATRIX_MINIMAL', message: `Matrix ${raw.code} imported with placeholder rows/columns.` })
    }

    if (tier === 'B') {
      warnings.push({
        code: 'PARTIAL_TYPE',
        message: `Question ${raw.code} (${raw.questionType}) imported as stub — complete in builder.`,
      })
    }

    out.push(q)
  }

  return out
}