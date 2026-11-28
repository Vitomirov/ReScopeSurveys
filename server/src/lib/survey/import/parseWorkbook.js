import * as XLSX from 'xlsx'
import { parseYesNo, splitSurveySheetFlat } from '../../../../../shared/surveyImport/workbookSettings.js'

function sheetToRows(wb, name) {
  const sheet = wb.Sheets[name]
  if (!sheet) return null
  return XLSX.utils.sheet_to_json(sheet, { defval: '' })
}

function cell(row, ...keys) {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim() !== '') return row[key]
  }
  return ''
}

function splitCodes(raw) {
  return String(raw ?? '')
    .split(/[,;|]/)
    .map(s => s.trim())
    .filter(Boolean)
}

function parseSurveyMeta(rows) {
  const flat = {}
  if (!rows) return {}
  for (const row of rows) {
    const key = String(cell(row, 'key', 'Key')).trim()
    const value = String(cell(row, 'value', 'Value')).trim()
    if (key) flat[key] = value
  }
  return splitSurveySheetFlat(flat)
}

function parseOptions(optionRows) {
  const optionsByQuestion = new Map()
  for (const row of optionRows || []) {
    const qCode = String(cell(row, 'questionCode', 'QuestionCode')).trim()
    if (!qCode) continue
    if (!optionsByQuestion.has(qCode)) optionsByQuestion.set(qCode, [])
    optionsByQuestion.get(qCode).push({
      code: String(cell(row, 'optionCode', 'OptionCode')).trim(),
      text: String(cell(row, 'text', 'Text')).trim(),
      terminates: parseYesNo(cell(row, 'terminates', 'Terminates')),
      isExclusive: parseYesNo(cell(row, 'isExclusive', 'IsExclusive')),
    })
  }
  return optionsByQuestion
}

function parseMatrix(matrixRows) {
  const byQuestion = new Map()
  for (const row of matrixRows || []) {
    const qCode = String(cell(row, 'questionCode', 'QuestionCode')).trim()
    if (!qCode) continue
    const axis = String(cell(row, 'axis', 'Axis')).trim().toLowerCase()
    const text = String(cell(row, 'text', 'Text')).trim()
    const code = String(cell(row, 'code', 'Code')).trim()
    if (!text || (axis !== 'row' && axis !== 'col' && axis !== 'column')) continue
    if (!byQuestion.has(qCode)) byQuestion.set(qCode, { rows: [], columns: [] })
    const entry = { text, ...(code ? { code } : {}) }
    if (axis === 'row') byQuestion.get(qCode).rows.push(entry)
    else byQuestion.get(qCode).columns.push(entry)
  }
  return byQuestion
}

function parseLogic(logicRows, warnings) {
  const byQuestion = new Map()
  for (const row of logicRows || []) {
    const questionCode = String(cell(row, 'questionCode', 'QuestionCode')).trim()
    if (!questionCode) continue
    const action = String(cell(row, 'action', 'Action')).trim().toLowerCase()
    if (action !== 'terminate' && action !== 'branch') {
      warnings.push({
        code: 'LOGIC_ACTION',
        message: `Logic row for ${questionCode}: unknown action "${action}" (use terminate or branch)`,
      })
      continue
    }
    const optionCodes = splitCodes(cell(row, 'optionCodes', 'OptionCodes', 'options', 'Options'))
    const matchModeRaw = String(cell(row, 'matchMode', 'MatchMode')).trim().toLowerCase()
    const matchMode = matchModeRaw === 'all' ? 'all' : 'any'
    const targetPageCode = String(cell(row, 'targetPageCode', 'TargetPageCode', 'target')).trim()
    const note = String(cell(row, 'note', 'Note')).trim()
    const ruleType = String(cell(row, 'ruleType', 'RuleType')).trim().toLowerCase() || undefined
    const textOperator = String(cell(row, 'textOperator', 'TextOperator')).trim() || undefined
    const textValue = String(cell(row, 'textValue', 'TextValue')).trim() || undefined
    const textValue2 = String(cell(row, 'textValue2', 'TextValue2')).trim() || undefined
    const matrixRowCode = String(cell(row, 'matrixRowCode', 'MatrixRowCode')).trim() || undefined
    const matrixColumnCodes = splitCodes(cell(row, 'matrixColumnCodes', 'MatrixColumnCodes'))

    if (!byQuestion.has(questionCode)) byQuestion.set(questionCode, [])
    byQuestion.get(questionCode).push({
      action,
      optionCodes: optionCodes.length ? optionCodes : undefined,
      matchMode,
      targetPageCode: targetPageCode || undefined,
      note: note || undefined,
      ruleType,
      textOperator,
      textValue,
      textValue2,
      matrixRowCode,
      matrixColumnCodes: matrixColumnCodes.length ? matrixColumnCodes : undefined,
    })
  }
  return byQuestion
}

export function parseWorkbookBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const warnings = []
  const survey = parseSurveyMeta(sheetToRows(wb, 'Survey'))

  const itemRows = sheetToRows(wb, 'Items') || []
  const optionsByQuestion = parseOptions(sheetToRows(wb, 'Options'))
  const matrixByQuestion = parseMatrix(sheetToRows(wb, 'Matrix'))
  const logicByQuestion = parseLogic(sheetToRows(wb, 'Logic'), warnings)

  const items = []
  for (const row of itemRows) {
    const code = String(cell(row, 'code', 'Code')).trim()
    if (!code) continue
    const itemType = String(cell(row, 'itemType', 'ItemType') || 'question').trim()
    const item = { code, itemType }

    if (itemType === 'page_break') {
      const lockSeconds = Number(cell(row, 'navigationLockSeconds', 'NavigationLockSeconds'))
      if (Number.isFinite(lockSeconds) && lockSeconds > 0) {
        item.navigationLockSeconds = Math.round(lockSeconds)
      }
      items.push(item)
      continue
    }

    if (itemType === 'text_block') {
      item.title = String(cell(row, 'title', 'Title')).trim()
      item.content = String(cell(row, 'content', 'Content')).trim()
      items.push(item)
      continue
    }

    if (itemType === 'question') {
      item.questionType = String(cell(row, 'questionType', 'QuestionType') || 'single_select').trim()
      item.text = String(cell(row, 'text', 'Text')).trim()
      item.required = !['n', 'no', 'false', '0'].includes(
        String(cell(row, 'required', 'Required') || 'Y').trim().toLowerCase(),
      )
      const multiline = cell(row, 'multiline', 'Multiline')
      if (String(multiline).trim() !== '') item.multiline = parseYesNo(multiline)
      const randomize = cell(row, 'randomizeOptions', 'RandomizeOptions')
      if (String(randomize).trim() !== '') item.randomizeOptions = parseYesNo(randomize)

      const terminationLogic = String(cell(row, 'terminationLogic', 'TerminationLogic')).trim().toLowerCase()
      if (terminationLogic === 'if_any' || terminationLogic === 'if_none') {
        item.terminationLogic = terminationLogic
      }
      const branchLogic = String(cell(row, 'branchLogic', 'BranchLogic')).trim().toLowerCase()
      if (branchLogic === 'if_any' || branchLogic === 'if_none') {
        item.branchLogic = branchLogic
      }
      const branchNone = String(cell(row, 'branchNoneTargetCode', 'BranchNoneTargetCode')).trim()
      if (branchNone) item.branchNoneTargetCode = branchNone

      const opts = optionsByQuestion.get(code)
      if (opts?.length) item.options = opts.filter(o => o.code && o.text)

      const matrix = matrixByQuestion.get(code)
      if (matrix?.rows?.length) item.matrixRows = matrix.rows
      if (matrix?.columns?.length) item.matrixColumns = matrix.columns

      const logic = logicByQuestion.get(code)
      if (logic?.length) {
        const terminationRules = logic.filter(r => r.action === 'terminate').map(({ action, ...rest }) => rest)
        const branchRules = logic.filter(r => r.action === 'branch').map(({ action, ...rest }) => rest)
        if (terminationRules.length) item.terminationRules = terminationRules
        if (branchRules.length) item.branchRules = branchRules
      }

      items.push(item)
      continue
    }

    // group / termination_block — accept as stubs for forward-compat
    if (itemType === 'group' || itemType === 'termination_block') {
      item.title = String(cell(row, 'title', 'Title')).trim()
      items.push(item)
      continue
    }

    warnings.push({ code: 'ITEM_TYPE', message: `Unknown itemType "${itemType}" for ${code}` })
  }

  if (!items.length) {
    warnings.push({ code: 'NO_ITEMS', message: 'Workbook Items sheet has no importable rows.' })
  }

  return {
    survey,
    items,
    warnings,
    schemaVersion: 1,
  }
}
