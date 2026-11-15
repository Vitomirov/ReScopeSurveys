import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { TAKER_INPUT_CLASS } from '@/constants/classNames'
import { getSortedPhoneCountries, nextCountryByLetter } from '@/utils/format/phoneSurveyFormat'

const DEFAULT_COUNTRY = 'GB'
const TYPEAHEAD_MS = 800

function jumpByLetter(countries, letter, currentIso, typeaheadRef) {
  const now = Date.now()
  const { letter: prev, iso: prevIso, at } = typeaheadRef.current
  const sameBurst = prev === letter && now - at < TYPEAHEAD_MS
  const next = nextCountryByLetter(
    countries,
    letter,
    sameBurst && prevIso === currentIso ? currentIso : null
  )
  if (!next) return null
  typeaheadRef.current = { letter, iso: next.iso, at: now }
  return next.iso
}

function PhoneCountrySelect({ countries, value, onChange }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const typeahead = useRef({ letter: '', iso: '', at: 0 })
  const triggerId = useId()
  const selected = countries.find(c => c.iso === value)
    || countries.find(c => c.iso === DEFAULT_COUNTRY)
    || countries[0]

  useEffect(() => {
    if (!open) return undefined
    const close = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
      if (!open) {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key.length !== 1 || !/^[a-z]$/i.test(e.key) || e.ctrlKey || e.metaKey || e.altKey) return
    const iso = jumpByLetter(countries, e.key.toLowerCase(), value, typeahead)
    if (!iso) return
    e.preventDefault()
    onChange(iso)
  }

  return (
    <div ref={rootRef} className="relative w-full sm:w-72 shrink-0">
      <button
        type="button"
        id={triggerId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Country"
        title="Type a letter to jump (e.g. F for France, S for Serbia)"
        onClick={() => setOpen(v => !v)}
        onKeyDown={handleKeyDown}
        className={`${TAKER_INPUT_CLASS} w-full flex items-center justify-between gap-2 text-left`}
      >
        <span className="truncate">
          {selected.flag} {selected.name} ({selected.dialCode})
        </span>
        <span className="text-ink-400 text-xs shrink-0" aria-hidden>▾</span>
      </button>
      {open && (
        <ul
          role="listbox"
          aria-labelledby={triggerId}
          className="absolute z-20 mt-1 w-full max-h-[min(22rem,70vh)] overflow-y-auto bg-white border border-ink-200 rounded-xl shadow-lg py-1.5"
        >
          {countries.map(c => (
            <li key={c.iso} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={c.iso === value}
                onClick={() => {
                  onChange(c.iso)
                  setOpen(false)
                }}
                className={`w-full text-left px-3 py-2.5 text-sm hover:bg-ink-50 ${
                  c.iso === value ? 'bg-brand-50 text-brand-800 font-medium' : 'text-ink-700'
                }`}
              >
                {c.flag} {c.name} ({c.dialCode})
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function PhoneQ({ value, onChange }) {
  const countries = useMemo(() => getSortedPhoneCountries(), [])
  const country = (value && typeof value === 'object' && value.country) || DEFAULT_COUNTRY
  const number = value && typeof value === 'object'
    ? (value.number || '')
    : (typeof value === 'string' ? value : '')

  const commit = (nextCountry, nextNumber) => onChange({ country: nextCountry, number: nextNumber })

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <PhoneCountrySelect
        countries={countries}
        value={country}
        onChange={iso => commit(iso, number)}
      />
      <input
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        value={number}
        placeholder="Phone number"
        aria-label="Phone number"
        onChange={e => commit(country, e.target.value.replace(/\D/g, ''))}
        className={`${TAKER_INPUT_CLASS} flex-1`}
      />
    </div>
  )
}

export default PhoneQ