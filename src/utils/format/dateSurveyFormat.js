import { DEFAULT_DATE_FORMAT } from '@/constants/survey/surveyDefaults'
import { parseISODate } from '@/utils/survey/conditions/dateOperators'

export const SURVEY_DATE_FORMAT_OPTIONS = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY', example: '06/25/2025', region: 'US' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY', example: '25/06/2025', region: 'EU / UK' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD', example: '2025-06-25', region: 'ISO 8601' },
]

const FORMAT_LAYOUT = {
  'MM/DD/YYYY': { sep: '/', parts: ['m', 'd', 'y'], sizes: [2, 2, 4] },
  'DD/MM/YYYY': { sep: '/', parts: ['d', 'm', 'y'], sizes: [2, 2, 4] },
  'YYYY-MM-DD': { sep: '-', parts: ['y', 'm', 'd'], sizes: [4, 2, 2] },
}

/** DD + MM + YYYY = 8 digits (year is always 4). */
export const DATE_DIGIT_COUNT = 8

function layoutFor(format) {
  return FORMAT_LAYOUT[format] ?? FORMAT_LAYOUT[DEFAULT_DATE_FORMAT]
}

function splitDigits(digits, format) {
  const { sizes } = layoutFor(format)
  let pos = 0
  return sizes.map(size => digits.slice(pos, (pos += size)))
}

function isoFromParts({ y, m, d }) {
  const iso = `${y.padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  return parseISODate(iso) ?? ''
}

export function resolveDateFormat(questionFormat, surveyDefault, fallback = DEFAULT_DATE_FORMAT) {
  if (questionFormat === 'inherit' || questionFormat == null || questionFormat === '') {
    return surveyDefault || fallback
  }
  return questionFormat
}

/** Digits only, max 8 — separators in the UI are ignored. */
export function extractDateDigits(input) {
  return String(input ?? '').replace(/\D/g, '').slice(0, DATE_DIGIT_COUNT)
}

/** Digits only in the value; `/` or `-` appear as each segment completes (no `_`). */
export function formatDateInputMasked(digits, format) {
  if (!digits) return ''
  const { sep, sizes } = layoutFor(format)
  let pos = 0
  const parts = []
  for (let i = 0; i < sizes.length; i++) {
    const chunk = digits.slice(pos, pos + sizes[i])
    if (!chunk) break
    parts.push(chunk)
    pos += sizes[i]
  }
  let out = parts.join(sep)
  const last = parts.length - 1
  if (last >= 0 && parts.length < sizes.length && parts[last].length === sizes[last]) {
    out += sep
  }
  return out
}

export function digitsFromISO(iso, format) {
  const normalized = parseISODate(iso)
  if (!normalized) return ''
  const [y, m, d] = normalized.split('-')
  const { parts } = layoutFor(format)
  const map = { y, m, d }
  return parts.map(key => map[key]).join('')
}

export function isoFromDateDigits(digits, format) {
  if (digits.length !== DATE_DIGIT_COUNT) return ''
  const { parts, sizes } = layoutFor(format)
  const segs = splitDigits(digits, format)
  if (!segs.every((seg, i) => seg.length === sizes[i])) return ''
  return isoFromParts(Object.fromEntries(parts.map((key, i) => [key, segs[i]])))
}