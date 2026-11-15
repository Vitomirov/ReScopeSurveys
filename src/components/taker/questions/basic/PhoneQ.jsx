import { useMemo } from 'react'
import { TAKER_INPUT_CLASS } from '@/constants/classNames'
import { getSortedPhoneCountries } from '@/utils/format/phoneSurveyFormat'

const DEFAULT_COUNTRY = 'GB'

export function PhoneQ({ value, onChange }) {
  const countries = useMemo(() => getSortedPhoneCountries(), [])
  const country = (value && typeof value === 'object' && value.country) || DEFAULT_COUNTRY
  const number = value && typeof value === 'object'
    ? (value.number || '')
    : (typeof value === 'string' ? value : '')

  const commit = (nextCountry, nextNumber) => onChange({ country: nextCountry, number: nextNumber })

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <select
        value={country}
        onChange={e => commit(e.target.value, number)}
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
        autoComplete="tel"
        value={number}
        placeholder="Phone number"
        aria-label="Phone number"
        onChange={e => commit(country, e.target.value)}
        className={`${TAKER_INPUT_CLASS} flex-1`}
      />
    </div>
  )
}

export default PhoneQ
