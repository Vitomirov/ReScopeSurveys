import { useEffect, useState } from 'react'
import { DEFAULT_DATE_FORMAT } from '@/constants/survey/surveyDefaults'
import { TAKER_INPUT_CLASS } from '@/constants/ui/classNames'
import {
  DATE_DIGIT_COUNT,
  digitsFromISO,
  extractDateDigits,
  formatDateInputMasked,
  isoFromDateDigits,
  resolveDateFormat,
} from '@/utils/format/dateSurveyFormat'

export function DateQ({ question, value = '', onChange, surveyDateFormat }) {
  const cfg = question.dateConfig
  const format = resolveDateFormat(cfg?.format, surveyDateFormat, DEFAULT_DATE_FORMAT)
  const [digits, setDigits] = useState(() => digitsFromISO(value, format))
  const [invalid, setInvalid] = useState(false)
  const text = formatDateInputMasked(digits, format)

  useEffect(() => {
    setDigits(digitsFromISO(value, format))
    setInvalid(false)
  }, [value, format])

  const applyDigits = (nextDigits) => {
    setDigits(nextDigits)
    setInvalid(false)

    if (!nextDigits) {
      onChange('')
      return
    }
    if (nextDigits.length !== DATE_DIGIT_COUNT) return

    const iso = isoFromDateDigits(nextDigits, format)
    const outOfRange = iso && ((cfg?.minDate && iso < cfg.minDate) || (cfg?.maxDate && iso > cfg.maxDate))
    if (!iso || outOfRange) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    onChange(iso)
  }

  const handleKeyDown = (e) => {
    if (e.key !== 'Backspace' && e.key !== 'Delete') return
    const selStart = e.target.selectionStart
    const selEnd = e.target.selectionEnd
    const atEnd = selStart === text.length && selEnd === text.length
    if (!atEnd && selStart !== selEnd) return

    if (digits.length === 0) return
    e.preventDefault()
    applyDigits(digits.slice(0, -1))
  }

  return (
    <div>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="bday"
        value={text}
        placeholder={format}
        aria-label={`Date (${format}). Type digits only.`}
        aria-invalid={invalid || undefined}
        onKeyDown={handleKeyDown}
        onChange={e => applyDigits(extractDateDigits(e.target.value))}
        onBlur={() => applyDigits(digits)}
        onPaste={e => {
          e.preventDefault()
          applyDigits(extractDateDigits(e.clipboardData.getData('text')))
        }}
        className={`${TAKER_INPUT_CLASS} font-mono tracking-wide ${invalid ? 'border-rose-400 focus:ring-rose-400' : ''}`}
      />
      {invalid && (
        <p className="text-xs text-rose-500 mt-1">
          Enter a valid date in {format}
          {(cfg?.minDate || cfg?.maxDate) && ' within the allowed range'}
        </p>
      )}
    </div>
  )
}

export default DateQ