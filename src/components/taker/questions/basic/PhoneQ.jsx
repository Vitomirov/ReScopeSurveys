import { useEffect, useMemo, useState } from 'react'
import { TAKER_INPUT_CLASS } from '@/constants/classNames'
import {
  countryFromE164,
  examplePlaceholderForCountry,
  formatPhoneAsYouType,
  getSortedPhoneCountries,
  parsePhoneToE164,
} from '@/utils/format/phoneSurveyFormat'

const DEFAULT_COUNTRY = 'GB'

export function PhoneQ({ value = '', onChange }) {
  const countries = useMemo(() => getSortedPhoneCountries(), [])
  const [countryIso, setCountryIso] = useState(() => countryFromE164(value) || DEFAULT_COUNTRY)
  const [nationalInput, setNationalInput] = useState('')
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    const iso = countryFromE164(value)
    if (!iso) return
    setCountryIso(iso)
    setNationalInput(prev => (
      parsePhoneToE164(prev, iso) === value ? prev : formatPhoneAsYouType(value, iso)
    ))
    setInvalid(false)
  }, [value])

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <select
        value={countryIso}
        onChange={e => {
          const iso = e.target.value
          setCountryIso(iso)
          setNationalInput('')
          setInvalid(false)
          onChange('')
        }}
        aria-label="Country"
        className={`${TAKER_INPUT_CLASS} sm:w-56 shrink-0`}
      >
        {countries.map(c => (
          <option key={c.iso} value={c.iso}>
            {c.flag} {c.name} ({c.dialCode})
          </option>
        ))}
      </select>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={nationalInput}
        placeholder={examplePlaceholderForCountry(countryIso)}
        aria-label="Phone number"
        aria-invalid={invalid || undefined}
        onChange={e => {
          const next = formatPhoneAsYouType(e.target.value, countryIso)
          setNationalInput(next)
          setInvalid(false)
          const e164 = parsePhoneToE164(next, countryIso)
          onChange(e164 || next.trim())
        }}
        onBlur={() => setInvalid(Boolean(nationalInput.trim()) && !parsePhoneToE164(nationalInput, countryIso))}
        className={`${TAKER_INPUT_CLASS} flex-1 font-mono tracking-wide ${invalid ? 'border-rose-400 focus:ring-rose-400' : ''}`}
      />
    </div>
  )
}

export default PhoneQ
