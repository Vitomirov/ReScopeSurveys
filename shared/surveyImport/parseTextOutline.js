/**
 * ReScope text outline — plain text → canonical import items.
 * () = single_select, [] = multi_select, ____ = open_text, @type = explicit directive.
 */

import { normalizeImportQuestionType } from './questionTiers.js'

const OPTION_SINGLE = /^\(\)\s*(.+)$/
const OPTION_MULTI = /^\[\]\s*(.+)$/
const BLANK_LINE = /^_{2,}\s*$/
const SELECT_ALL = /select all that apply/i
const COMMENT_LINE = /^#/
const TYPE_DIRECTIVE = /^@([a-z][a-z0-9_]*)\s*(.*)$/i
const TYPE_BRACKET = /^\[type:\s*([a-z][a-z0-9_]*)\s*\]\s*(.*)$/i
const MATRIX_ROW = /^row:\s*(.+)$/i
const MATRIX_COL = /^col:\s*(.+)$/i
const MOD_SCREENOUT = /\{screenout\}\s*$/i
const MOD_TERMINATES = /\{terminates\}\s*$/i
const MOD_EXCLUSIVE = /\{exclusive\}\s*$/i

const CHOICE_QUESTION_TYPES = new Set(['single_select', 'multi_select', 'dropdown'])
const OPTION_LIST_TYPES = new Set([
  'single_select', 'multi_select', 'dropdown', 'ranking', 'constant_sum', 'card_sort', 'maxdiff', 'textbox_list',
])

function nextQuestionCode(n) {
  return `Q${n}`
}

function nextOptionCode(qCode, n) {
  return `${qCode}_O${n}`
}

function stripLineMods(text) {
  return String(text || '')
    .replace(MOD_SCREENOUT, '')
    .replace(MOD_TERMINATES, '')
    .replace(MOD_EXCLUSIVE, '')
    .trim()
}

function optionFlags(rawLine) {
  const line = String(rawLine || '')
  return {
    terminates: MOD_SCREENOUT.test(line) || MOD_TERMINATES.test(line),
    isExclusive: MOD_EXCLUSIVE.test(line),
  }
}

function parseDirective(line) {
  const bracket = line.match(TYPE_BRACKET)
  if (bracket) {
    return { type: normalizeImportQuestionType(bracket[1]), stem: (bracket[2] || '').trim() }
  }
  const at = line.match(TYPE_DIRECTIVE)
  if (at) {
    return { type: normalizeImportQuestionType(at[1]), stem: (at[2] || '').trim() }
  }
  return null
}

function parseChoiceOptions(optionLines, qCode, questionType) {
  return optionLines.map((line, i) => {
    const m = line.match(OPTION_SINGLE) || line.match(OPTION_MULTI)
    const flags = optionFlags(line)
    return {
      code: nextOptionCode(qCode, i + 1),
      text: stripLineMods((m?.[1] || '').trim()),
      terminates: flags.terminates,
      isExclusive: flags.isExclusive,
    }
  })
}

/**
 * @param {string} text
 * @returns {{ survey: { title?: string }, items: object[], warnings: object[] }}
 */
export function parseTextOutline(text) {
  const warnings = []
  const normalized = String(text || '').replace(/\r\n/g, '\n').trim()
  if (!normalized) {
    return { survey: {}, items: [], warnings: [{ code: 'EMPTY', message: 'No content to import.' }] }
  }

  const blocks = normalized.split(/\n\s*\n+/).map(b => b.trim()).filter(Boolean)
  const items = []
  let qIndex = 0
  let pbIndex = 0

  for (const block of blocks) {
    const rawLines = block.split('\n').map(l => l.trimEnd())
    const lines = rawLines
      .map(l => l.trim())
      .filter(l => l.length > 0 && !COMMENT_LINE.test(l))

    if (!lines.length) continue

    const directive = parseDirective(lines[0])
    if (directive?.type === 'page_break') {
      pbIndex += 1
      items.push({ code: `PB${pbIndex}`, itemType: 'page_break' })
      continue
    }

    if (directive?.type === 'text_block') {
      pbIndex += 1
      const title = directive.stem || lines[1] || ''
      const bodyLines = directive.stem ? lines.slice(1) : lines.slice(2)
      items.push({
        code: `TB${pbIndex}`,
        itemType: 'text_block',
        title,
        content: bodyLines.join('\n'),
      })
      continue
    }

    const stemLines = []
    const optionLines = []
    const blankLines = []
    const matrixRows = []
    const matrixCols = []
    let pendingStem = true
    let explicitType = directive?.type && directive.type !== 'page_break' && directive.type !== 'text_block'
      ? directive.type
      : null
    let firstLineConsumed = Boolean(directive)

    if (directive?.stem) {
      stemLines.push(directive.stem)
      pendingStem = false
    }

    for (let li = firstLineConsumed ? 1 : 0; li < lines.length; li += 1) {
      const line = lines[li]
      if (MATRIX_ROW.test(line)) {
        pendingStem = false
        matrixRows.push(line.replace(MATRIX_ROW, '$1').trim())
        continue
      }
      if (MATRIX_COL.test(line)) {
        pendingStem = false
        matrixCols.push(line.replace(MATRIX_COL, '$1').trim())
        continue
      }
      if (OPTION_SINGLE.test(line) || OPTION_MULTI.test(line)) {
        pendingStem = false
        optionLines.push(line)
        continue
      }
      if (BLANK_LINE.test(line)) {
        pendingStem = false
        blankLines.push(line)
        continue
      }
      if (pendingStem) stemLines.push(line)
      else warnings.push({ code: 'AMBIGUOUS_LINE', message: `Unexpected line after options: ${line.slice(0, 60)}` })
    }

    const stem = stemLines.join(' ').trim()
    if (!stem && !optionLines.length && !blankLines.length && !matrixRows.length) {
      warnings.push({ code: 'EMPTY_BLOCK', message: 'Skipped empty question block.' })
      continue
    }

    if (explicitType === 'matrix' || (matrixRows.length || matrixCols.length)) {
      qIndex += 1
      const qCode = nextQuestionCode(qIndex)
      const item = {
        code: qCode,
        itemType: 'question',
        questionType: 'matrix',
        text: stem || `Question ${qIndex}`,
        required: true,
      }
      if (matrixRows.length || matrixCols.length) {
        item.importMeta = { matrixRows, matrixCols }
      }
      items.push(item)
      continue
    }

    qIndex += 1
    const qCode = nextQuestionCode(qIndex)

    if (optionLines.length) {
      const firstMulti = optionLines.some(l => OPTION_MULTI.test(l))
      const stemMulti = SELECT_ALL.test(stem)
      let questionType = explicitType
      if (!questionType) {
        questionType = (firstMulti || stemMulti) ? 'multi_select' : 'single_select'
      } else if (!CHOICE_QUESTION_TYPES.has(questionType) && OPTION_LIST_TYPES.has(questionType)) {
        // ranking, constant_sum, etc. — options are labels for builder partial setup
      } else if (!CHOICE_QUESTION_TYPES.has(questionType)) {
        warnings.push({
          code: 'TYPE_OPTION_MISMATCH',
          message: `${qCode}: @${questionType} with options — imported as single_select options.`,
        })
        questionType = (firstMulti || stemMulti) ? 'multi_select' : 'single_select'
      }
      const options = parseChoiceOptions(optionLines, qCode, questionType)
      items.push({
        code: qCode,
        itemType: 'question',
        questionType,
        text: stem || `Question ${qIndex}`,
        required: true,
        options: CHOICE_QUESTION_TYPES.has(questionType) || OPTION_LIST_TYPES.has(questionType) ? options : undefined,
      })
      continue
    }

    if (blankLines.length) {
      items.push({
        code: qCode,
        itemType: 'question',
        questionType: 'open_text',
        text: stem || `Question ${qIndex}`,
        required: false,
        multiline: blankLines.length > 1,
      })
      continue
    }

    if (explicitType) {
      items.push({
        code: qCode,
        itemType: 'question',
        questionType: explicitType,
        text: stem || `Question ${qIndex}`,
        required: !['open_text'].includes(explicitType),
      })
      continue
    }

    if (stem) {
      warnings.push({ code: 'STEM_ONLY', message: `Question ${qCode} has text only; imported as short open text.` })
      items.push({
        code: qCode,
        itemType: 'question',
        questionType: 'open_text',
        text: stem,
        required: false,
        multiline: false,
      })
    }
  }

  return {
    survey: { title: 'Imported survey' },
    items,
    warnings,
  }
}