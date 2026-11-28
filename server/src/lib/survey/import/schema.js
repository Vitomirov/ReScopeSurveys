import { z } from 'zod'
import {
  TIER_A_FULL,
  TIER_B_PARTIAL,
  normalizeImportQuestionType,
} from '../../../../../shared/surveyImport/questionTiers.js'

const codeRegex = /^[A-Za-z][A-Za-z0-9_]{0,63}$/

const optionalString = z.string().nullish().transform(v => (v == null || v === '' ? undefined : v))

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
  matchMode: z.enum(['any', 'all']).optional(),
  targetPageCode: optionalString,
  note: optionalString,
  ruleType: z.enum(['choice', 'text', 'matrix', 'date', 'slider']).optional(),
  textOperator: optionalString,
  textValue: optionalString,
  textValue2: optionalString,
  matrixRowCode: optionalString,
  matrixColumnCodes: z.array(z.string()).optional(),
})

const importItemSchema = z.object({
  code: z.string().regex(codeRegex),
  itemType: z.enum(['question', 'page_break', 'text_block', 'group', 'termination_block']),
  questionType: optionalString,
  text: optionalString,
  required: z.boolean().nullish().transform(v => v ?? undefined),
  multiline: z.boolean().nullish().transform(v => v ?? undefined),
  randomizeOptions: z.boolean().nullish().transform(v => v ?? undefined),
  options: z.array(importOptionSchema).optional(),
  title: optionalString,
  content: optionalString,
  navigationLockSeconds: z.number().int().positive().optional(),
  terminationLogic: z.enum(['if_any', 'if_none']).optional(),
  branchLogic: z.enum(['if_any', 'if_none']).optional(),
  branchNoneTargetCode: optionalString,
  terminationRules: z.array(importRuleSchema).optional(),
  branchRules: z.array(importRuleSchema).optional(),
  matrixRows: z.array(matrixLabelSchema).optional(),
  matrixColumns: z.array(matrixLabelSchema).optional(),
})

const allowedTypes = [...TIER_A_FULL, ...TIER_B_PARTIAL].filter(t => t !== 'page_break' && t !== 'text_block')

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
}).superRefine((val, ctx) => {
  for (const [i, item] of val.items.entries()) {
    if (item.itemType !== 'question') continue
    if (!item.questionType || !allowedTypes.includes(item.questionType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['items', i, 'questionType'],
        message: `Unsupported or missing questionType`,
      })
    }
    // Missing options on choice types: warning in buildRuntimeItems (import → pending QA)
  }
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

function sanitizeImportItem(item) {
  if (!item || typeof item !== 'object') return item
  const base = stripNullFields(item)
  if (base.itemType === 'question' && base.questionType) {
    base.questionType = normalizeImportQuestionType(base.questionType)
  }
  if (Array.isArray(base.options)) {
    base.options = base.options
      .filter(opt => opt && opt.code != null && opt.text != null)
      .map(opt => ({
        ...stripNullFields(opt),
        code: String(opt.code).trim(),
        text: String(opt.text).trim(),
      }))
      .filter(opt => opt.code && opt.text)
  }
  return base
}

/** Remove nulls from file/JSON payloads before Zod (multipart routes pass surveyId: null). */
export function normalizeImportPayload(raw) {
  if (!raw || typeof raw !== 'object') return raw
  const out = stripNullFields(raw)
  if (raw.survey != null) {
    out.survey = stripNullFields(raw.survey)
  }
  if (Array.isArray(raw.items)) {
    out.items = raw.items.map(sanitizeImportItem)
  }
  return out
}

export function importValidationSummary(errors) {
  if (!errors?.length) return 'Import validation failed'
  const first = errors[0]
  const loc = first.path ? `${first.path}: ` : ''
  return `${loc}${first.message}`
}
