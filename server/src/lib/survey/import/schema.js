import { z } from 'zod'
import {
  TIER_A_FULL,
  TIER_B_PARTIAL,
  normalizeImportQuestionType,
  isImportableQuestionType,
} from '../../../../../shared/surveyImport/questionTiers.js'

const codeRegex = /^[A-Za-z][A-Za-z0-9_]{0,63}$/

const RULE_TYPES = new Set(['choice', 'text', 'matrix', 'date', 'slider'])
const MATCH_MODES = new Set(['any', 'all'])
const LOGIC_MODES = new Set(['if_any', 'if_none'])
const ITEM_TYPES = new Set(['question', 'page_break', 'text_block', 'group', 'termination_block'])

const optionalString = z.string().nullish().transform(v => (v == null || v === '' ? undefined : v))

/** Blank/unknown → fallback (AI/workbook noise must not hard-fail import). */
function coerceSoft(value, allowed, fallback) {
  if (value == null || value === '') return fallback
  const s = String(value).trim().toLowerCase()
  return allowed.has(s) ? s : fallback
}

function softEnum(allowed, fallback) {
  const values = [...allowed]
  return z.preprocess(
    v => coerceSoft(v, allowed, fallback),
    fallback === undefined ? z.enum(values).optional() : z.enum(values),
  )
}

const importOptionSchema = z.object({
  code: z.string().regex(codeRegex),
  text: z.string().min(1),
  terminates: z.boolean().optional(),
  isExclusive: z.boolean().optional(),
})

const matrixLabelSchema = z.object({
  text: z.string().min(1),
  code: z.string().regex(codeRegex).optional(),
})

const importRuleSchema = z.object({
  optionCodes: z.array(z.string().regex(codeRegex)).optional(),
  matchMode: softEnum(MATCH_MODES, 'any'),
  targetPageCode: optionalString,
  note: optionalString,
  ruleType: softEnum(RULE_TYPES, 'choice'),
  textOperator: optionalString,
  textValue: optionalString,
  textValue2: optionalString,
  matrixRowCode: optionalString,
  matrixColumnCodes: z.array(z.string()).optional(),
})

const importItemSchema = z.object({
  code: z.string().regex(codeRegex),
  itemType: softEnum(ITEM_TYPES, 'question'),
  questionType: optionalString,
  text: optionalString,
  required: z.boolean().nullish().transform(v => v ?? undefined),
  multiline: z.boolean().nullish().transform(v => v ?? undefined),
  randomizeOptions: z.boolean().nullish().transform(v => v ?? undefined),
  options: z.array(importOptionSchema).optional(),
  title: optionalString,
  content: optionalString,
  navigationLockSeconds: z.number().int().positive().optional(),
  terminationLogic: softEnum(LOGIC_MODES, undefined),
  branchLogic: softEnum(LOGIC_MODES, undefined),
  branchNoneTargetCode: optionalString,
  terminationRules: z.array(importRuleSchema).optional(),
  branchRules: z.array(importRuleSchema).optional(),
  matrixRows: z.array(matrixLabelSchema).optional(),
  matrixColumns: z.array(matrixLabelSchema).optional(),
})

export const importPayloadSchema = z.object({
  schemaVersion: z.literal(1).optional().default(1),
  mode: z.enum(['create', 'append']).nullish().transform(v => v ?? undefined),
  surveyId: z.string().uuid().nullish().transform(v => v ?? undefined),
  externalId: z.string().max(200).nullish().transform(v => v ?? undefined),
  survey: z.object({
    title: optionalString,
    internalName: optionalString,
    surveyCode: optionalString,
    description: optionalString,
    clientName: optionalString,
    topicName: optionalString,
    surveyTypeName: optionalString,
    startButtonText: optionalString,
    showCoverPage: z.boolean().nullish().transform(v => v ?? undefined),
    status: z.enum(['pending_review']).nullish().transform(v => v ?? undefined),
    settings: z.record(z.unknown()).optional(),
  }).optional().default({}),
  items: z.array(importItemSchema).min(1),
})

export function formatZodErrors(error) {
  return error.issues.map(issue => ({
    path: issue.path.join('.'),
    code: 'SCHEMA',
    message: issue.message,
  }))
}

function stripNullFields(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) continue
    out[k] = v
  }
  return out
}

/** Fix or drop an import code so Zod regex does not reject the whole workbook. */
function coerceImportCode(raw, { fallbackPrefix = 'X' } = {}) {
  const s = String(raw ?? '').trim()
  if (!s) return null
  if (codeRegex.test(s)) return s
  let fixed = s.replace(/[^A-Za-z0-9_]/g, '_')
  if (!/^[A-Za-z]/.test(fixed)) fixed = `${fallbackPrefix}_${fixed}`.replace(/_+/g, '_')
  fixed = fixed.slice(0, 64)
  return codeRegex.test(fixed) ? fixed : null
}

function sanitizeCodeList(codes) {
  if (!Array.isArray(codes)) return undefined
  const next = codes.map(c => coerceImportCode(c)).filter(Boolean)
  return next.length ? next : undefined
}

function sanitizeRule(rule) {
  if (!rule || typeof rule !== 'object') return null
  const out = stripNullFields(rule)
  out.ruleType = coerceSoft(out.ruleType, RULE_TYPES, 'choice')
  out.matchMode = coerceSoft(out.matchMode, MATCH_MODES, 'any')
  const optionCodes = sanitizeCodeList(out.optionCodes)
  if (optionCodes) out.optionCodes = optionCodes
  else delete out.optionCodes
  if (Array.isArray(out.matrixColumnCodes)) {
    out.matrixColumnCodes = out.matrixColumnCodes.map(c => String(c).trim()).filter(Boolean)
    if (!out.matrixColumnCodes.length) delete out.matrixColumnCodes
  }
  if (out.matrixRowCode != null) {
    const c = coerceImportCode(out.matrixRowCode)
    if (c) out.matrixRowCode = c
    else delete out.matrixRowCode
  }
  if (out.targetPageCode === '') delete out.targetPageCode
  return out
}

function sanitizeMatrixLabel(label) {
  if (!label || typeof label !== 'object') return null
  const text = String(label.text ?? '').trim()
  if (!text) return null
  const out = { text }
  if (label.code != null && String(label.code).trim() !== '') {
    const c = coerceImportCode(label.code)
    if (c) out.code = c
  }
  return out
}

function sanitizeImportItem(item, warnings) {
  if (!item || typeof item !== 'object') return null
  const base = stripNullFields(item)

  const code = coerceImportCode(base.code, { fallbackPrefix: 'Q' })
  if (!code) {
    warnings.push({ code: 'ITEM_CODE', message: `Skipped item with invalid code "${base.code || ''}".` })
    return null
  }
  base.code = code
  base.itemType = coerceSoft(base.itemType, ITEM_TYPES, 'question')

  if (base.itemType === 'question') {
    if (base.questionType) {
      base.questionType = normalizeImportQuestionType(base.questionType)
    }
    const typeOk = base.questionType
      && isImportableQuestionType(base.questionType)
      && base.questionType !== 'page_break'
      && base.questionType !== 'text_block'
    if (!typeOk) {
      warnings.push({
        code: 'QUESTION_TYPE',
        message: `${base.code}: unknown questionType "${item.questionType || ''}" — imported as open_text (finish in builder).`,
      })
      base.questionType = 'open_text'
    }
  }

  const termLogic = coerceSoft(base.terminationLogic, LOGIC_MODES, undefined)
  if (termLogic) base.terminationLogic = termLogic
  else delete base.terminationLogic
  const branchLogic = coerceSoft(base.branchLogic, LOGIC_MODES, undefined)
  if (branchLogic) base.branchLogic = branchLogic
  else delete base.branchLogic

  if (Array.isArray(base.options)) {
    base.options = base.options
      .map(opt => {
        if (!opt) return null
        const o = stripNullFields(opt)
        const oc = coerceImportCode(o.code, { fallbackPrefix: base.code })
        const text = String(o.text ?? '').trim()
        if (!oc || !text) return null
        return { ...o, code: oc, text }
      })
      .filter(Boolean)
  }

  if (Array.isArray(base.terminationRules)) {
    base.terminationRules = base.terminationRules.map(sanitizeRule).filter(Boolean)
  }
  if (Array.isArray(base.branchRules)) {
    base.branchRules = base.branchRules.map(sanitizeRule).filter(Boolean)
  }
  if (Array.isArray(base.matrixRows)) {
    base.matrixRows = base.matrixRows.map(sanitizeMatrixLabel).filter(Boolean)
  }
  if (Array.isArray(base.matrixColumns)) {
    base.matrixColumns = base.matrixColumns.map(sanitizeMatrixLabel).filter(Boolean)
  }

  if (base.navigationLockSeconds != null) {
    const n = Number(base.navigationLockSeconds)
    if (!Number.isFinite(n) || n <= 0) delete base.navigationLockSeconds
    else base.navigationLockSeconds = Math.round(n)
  }

  return base
}

/**
 * Remove nulls and coerce soft AI/workbook fields before Zod.
 * @returns {{ payload: object, warnings: object[] }}
 */
export function normalizeImportPayloadWithWarnings(raw) {
  const warnings = []
  if (!raw || typeof raw !== 'object') return { payload: raw, warnings }
  const out = stripNullFields(raw)
  if (raw.survey != null) {
    out.survey = stripNullFields(raw.survey)
  }
  if (Array.isArray(raw.items)) {
    out.items = raw.items.map(item => sanitizeImportItem(item, warnings)).filter(Boolean)
  }
  if (!out.items?.length) {
    out.items = [{
      code: 'Q1',
      itemType: 'question',
      questionType: 'open_text',
      text: 'Imported survey (empty workbook)',
    }]
    warnings.push({
      code: 'NO_ITEMS',
      message: 'No importable items found — created a placeholder question. Rebuild the workbook or edit in the builder.',
    })
  }
  return { payload: out, warnings }
}

/** Drop-in normalize for validate routes (warnings discarded). */
export function normalizeImportPayload(raw) {
  return normalizeImportPayloadWithWarnings(raw).payload
}

export function importValidationSummary(errors) {
  if (!errors?.length) return 'Import validation failed'
  const first = errors[0]
  const loc = first.path ? `${first.path}: ` : ''
  return `${loc}${first.message}`
}
