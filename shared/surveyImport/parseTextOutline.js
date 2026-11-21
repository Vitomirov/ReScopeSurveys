/**
 * ReScope text outline format — infer questions from plain text blocks.
 * () = single_select, [] = multi_select, ____ lines = open_text.
 */

const OPTION_SINGLE = /^\(\)\s*(.+)$/
const OPTION_MULTI = /^\[\]\s*(.+)$/
const BLANK_LINE = /^_{2,}\s*$/
const SELECT_ALL = /select all that apply/i

function nextQuestionCode(n) {
  return `Q${n}`
}

function nextOptionCode(qCode, n) {
  return `${qCode}_O${n}`
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

  for (const block of blocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(l => l.length > 0)
    if (!lines.length) continue

    const stemLines = []
    const optionLines = []
    const blankLines = []
    let pendingStem = true

    for (const line of lines) {
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
    if (!stem && !optionLines.length && !blankLines.length) {
      warnings.push({ code: 'EMPTY_BLOCK', message: 'Skipped empty question block.' })
      continue
    }

    qIndex += 1
    const qCode = nextQuestionCode(qIndex)

    if (optionLines.length) {
      const firstMulti = optionLines.some(l => OPTION_MULTI.test(l))
      const stemMulti = SELECT_ALL.test(stem)
      const questionType = (firstMulti || stemMulti) ? 'multi_select' : 'single_select'
      const options = optionLines.map((line, i) => {
        const m = line.match(OPTION_SINGLE) || line.match(OPTION_MULTI)
        return {
          code: nextOptionCode(qCode, i + 1),
          text: (m?.[1] || '').trim(),
          terminates: false,
        }
      })
      items.push({
        code: qCode,
        itemType: 'question',
        questionType,
        text: stem || `Question ${qIndex}`,
        required: true,
        options,
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
    survey: { title: items[0]?.text ? `Imported survey` : 'Imported survey' },
    items,
    warnings,
  }
}