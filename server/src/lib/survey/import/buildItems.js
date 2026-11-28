import { randomUUID } from 'node:crypto'
import { tierForQuestionType, TIER_C_IMAGE } from '../../../../../shared/surveyImport/questionTiers.js'
import { createQuestionConfigBundle } from '../../../../../shared/survey/questionConfigDefaults.js'

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
  const typeConfigs = createQuestionConfigBundle(() => randomUUID())
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
    ...typeConfigs,
  }
  if (partial) {
    base.importMeta = { partial: true }
  }
  return base
}

function resolveOptionIds(optionCodes, codeToId, questionCode, warnings) {
  if (!optionCodes?.length) return []
  const ids = []
  for (const code of optionCodes) {
    const id = codeToId.get(code)
    if (!id) {
      warnings.push({
        code: 'LOGIC_OPTION',
        message: `Logic on ${questionCode}: unknown option code ${code}`,
      })
      continue
    }
    ids.push(id)
  }
  return ids
}

function mapImportRules(rawRules, codeToId, questionCode, warnings, { requireTarget = false } = {}) {
  if (!rawRules?.length) return []
  return rawRules.map(raw => {
    const rule = {
      id: randomUUID(),
      ruleType: raw.ruleType || 'choice',
      matchMode: raw.matchMode === 'all' ? 'all' : 'any',
      optionIds: resolveOptionIds(raw.optionCodes, codeToId, questionCode, warnings),
      matrixRowId: '',
      matrixColumnIds: [],
      textOperator: raw.textOperator || 'contains',
      textValue: raw.textValue || '',
      textValue2: raw.textValue2 || '',
      note: raw.note || '',
    }
    if (raw.matrixRowCode) {
      const rowId = codeToId.get(raw.matrixRowCode)
      if (rowId) rule.matrixRowId = rowId
      else {
        warnings.push({
          code: 'LOGIC_MATRIX_ROW',
          message: `Logic on ${questionCode}: unknown matrix row code ${raw.matrixRowCode}`,
        })
      }
    }
    if (raw.matrixColumnCodes?.length) {
      rule.matrixColumnIds = resolveOptionIds(raw.matrixColumnCodes, codeToId, questionCode, warnings)
    }
    if (requireTarget) {
      const targetCode = raw.targetPageCode
      if (!targetCode) {
        warnings.push({
          code: 'BRANCH_TARGET',
          message: `Branch on ${questionCode}: missing targetPageCode (page_break code)`,
        })
        rule.targetPageBreakId = ''
      } else if (targetCode === '__start__') {
        rule.targetPageBreakId = '__start__'
      } else {
        const targetId = codeToId.get(targetCode)
        if (!targetId) {
          warnings.push({
            code: 'BRANCH_TARGET',
            message: `Branch on ${questionCode}: unknown targetPageCode ${targetCode}`,
          })
          rule.targetPageBreakId = ''
        } else {
          rule.targetPageBreakId = targetId
        }
      }
    }
    return rule
  })
}

function applyMatrixLabels(q, raw, codeToId) {
  if (!raw.matrixRows?.length && !raw.matrixColumns?.length) return false
  const rows = (raw.matrixRows || []).map(r => {
    const id = (r.code && codeToId.get(r.code)) || randomUUID()
    if (r.code) codeToId.set(r.code, id)
    return { id, text: r.text }
  })
  const columns = (raw.matrixColumns || []).map(c => {
    const id = (c.code && codeToId.get(c.code)) || randomUUID()
    if (c.code) codeToId.set(c.code, id)
    return { id, text: c.text }
  })
  q.matrixConfig = {
    ...q.matrixConfig,
    rows: rows.length ? rows : q.matrixConfig.rows,
    columns: columns.length ? columns : q.matrixConfig.columns,
  }
  return true
}

export function buildRuntimeItems(importItems, codeToId, { warnings = [] } = {}) {
  const out = []

  // Pre-register matrix label codes so Logic can resolve them when building rules
  for (const raw of importItems) {
    for (const label of [...(raw.matrixRows || []), ...(raw.matrixColumns || [])]) {
      if (label.code && !codeToId.has(label.code)) {
        codeToId.set(label.code, randomUUID())
      }
    }
  }

  for (const raw of importItems) {
    const id = codeToId.get(raw.code)
    if (!id) {
      warnings.push({ code: 'MISSING_CODE', message: `No id for code ${raw.code}` })
      continue
    }

    if (raw.itemType === 'page_break') {
      const seconds = Number(raw.navigationLockSeconds)
      out.push({
        id,
        itemType: 'page_break',
        visibility: baseVisibility(),
        navigationLock: Number.isFinite(seconds) && seconds > 0
          ? { enabled: true, seconds: Math.round(seconds) }
          : { enabled: false, seconds: 10 },
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

    if (raw.itemType === 'group') {
      out.push({
        id,
        itemType: 'group',
        title: raw.title || 'Group',
        collapsed: false,
        color: null,
        visibility: baseVisibility(),
        navigationLock: { enabled: false, seconds: 10 },
      })
      continue
    }

    if (raw.itemType === 'termination_block') {
      out.push({
        id,
        itemType: 'termination_block',
        title: raw.title || '',
        conditions: [],
      })
      warnings.push({
        code: 'TERMINATION_BLOCK_STUB',
        message: `Termination block ${raw.code}: conditions not imported — finish in builder.`,
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
    if (raw.randomizeOptions != null) q.randomizeOptions = Boolean(raw.randomizeOptions)

    if (['single_select', 'multi_select', 'dropdown'].includes(raw.questionType)) {
      if (raw.options?.length) {
        q.options = raw.options.map(opt => {
          const oid = codeToId.get(opt.code) || randomUUID()
          const option = makeOption(opt.text, oid)
          if (opt.terminates) option.terminates = true
          if (opt.isExclusive) option.isExclusive = true
          return option
        })
      } else {
        warnings.push({
          code: 'CHOICE_OPTIONS',
          message: `Choice ${raw.code}: no options in workbook — add in builder before Live.`,
        })
      }
    }

    const matrixApplied = applyMatrixLabels(q, raw, codeToId)
    if (raw.questionType === 'matrix' && tier === 'A' && !matrixApplied) {
      warnings.push({
        code: 'MATRIX_DEFAULTS',
        message: `Matrix ${raw.code}: rows/columns use builder defaults — review and edit in builder.`,
      })
    }

    if (raw.terminationLogic) q.terminationLogic = raw.terminationLogic
    if (raw.branchLogic) q.branchLogic = raw.branchLogic
    if (raw.branchNoneTargetCode) {
      if (raw.branchNoneTargetCode === '__start__') {
        q.branchNoneTargetPageBreakId = '__start__'
      } else {
        const tid = codeToId.get(raw.branchNoneTargetCode)
        if (tid) q.branchNoneTargetPageBreakId = tid
        else {
          warnings.push({
            code: 'BRANCH_NONE_TARGET',
            message: `Question ${raw.code}: unknown branchNoneTargetCode ${raw.branchNoneTargetCode}`,
          })
        }
      }
    }

    q.terminationRules = mapImportRules(raw.terminationRules, codeToId, raw.code, warnings)
    q.branchRules = mapImportRules(raw.branchRules, codeToId, raw.code, warnings, { requireTarget: true })

    if (tier === 'B') {
      warnings.push({
        code: 'PARTIAL_TYPE',
        message: `Question ${raw.code} (${raw.questionType}): finish setup in builder before going Live.`,
      })
    }

    out.push(q)
  }

  return out
}
