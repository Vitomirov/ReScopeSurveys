import * as XLSX from 'xlsx'

function sheetToRows(wb, name) {
  const sheet = wb.Sheets[name]
  if (!sheet) return null
  return XLSX.utils.sheet_to_json(sheet, { defval: '' })
}

function parseSurveyMeta(rows) {
  const survey = {}
  if (!rows) return survey
  for (const row of rows) {
    const key = String(row.key ?? row.Key ?? '').trim()
    const value = String(row.value ?? row.Value ?? '').trim()
    if (key && value) survey[key] = value
  }
  if (survey.title) survey.title = survey.title
  return survey
}

export function parseWorkbookBuffer(buffer) {
  const wb = XLSX.read(buffer, { type: 'buffer' })
  const warnings = []
  const survey = parseSurveyMeta(sheetToRows(wb, 'Survey'))

  const itemRows = sheetToRows(wb, 'Items') || []
  const optionRows = sheetToRows(wb, 'Options') || []

  const yes = v => ['y', 'yes', 'true', '1'].includes(String(v ?? '').trim().toLowerCase())
  const optionsByQuestion = new Map()
  for (const row of optionRows) {
    const qCode = String(row.questionCode ?? row.QuestionCode ?? '').trim()
    if (!qCode) continue
    if (!optionsByQuestion.has(qCode)) optionsByQuestion.set(qCode, [])
    optionsByQuestion.get(qCode).push({
      code: String(row.optionCode ?? row.OptionCode ?? '').trim(),
      text: String(row.text ?? row.Text ?? '').trim(),
      terminates: yes(row.terminates ?? row.Terminates),
      isExclusive: yes(row.isExclusive ?? row.IsExclusive),
    })
  }

  const items = []
  let rowNum = 1
  for (const row of itemRows) {
    rowNum += 1
    const code = String(row.code ?? row.Code ?? '').trim()
    if (!code) continue
    const itemType = String(row.itemType ?? row.ItemType ?? 'question').trim()
    const item = { code, itemType }
    if (itemType === 'question') {
      item.questionType = String(row.questionType ?? row.QuestionType ?? 'single_select').trim()
      item.text = String(row.text ?? row.Text ?? '').trim()
      item.required = !['N', 'no', 'false', '0'].includes(String(row.required ?? row.Required ?? 'Y').trim().toLowerCase())
      const opts = optionsByQuestion.get(code)
      if (opts?.length) item.options = opts.filter(o => o.code && o.text)
    }
    if (itemType === 'page_break') {
      items.push(item)
      continue
    }
    if (itemType === 'text_block') {
      item.title = String(row.title ?? row.Title ?? '').trim()
      item.content = String(row.content ?? row.Content ?? '').trim()
    }
    items.push(item)
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