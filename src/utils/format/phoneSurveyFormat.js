import { getCountries, getCountryCallingCode } from 'libphonenumber-js'

const PRIORITY_COUNTRIES = ['GB', 'US']

const displayNames =
  typeof Intl !== 'undefined' && Intl.DisplayNames
    ? new Intl.DisplayNames(['en'], { type: 'region' })
    : null

let sortedCountriesCache = null

/** Regional-indicator flag for an ISO 3166-1 alpha-2 code. */
export function countryFlag(iso) {
  if (!iso || iso.length !== 2) return ''
  return [...iso.toUpperCase()]
    .map(char => String.fromCodePoint(0x1F1E6 - 65 + char.charCodeAt(0)))
    .join('')
}

export function getSortedPhoneCountries() {
  if (sortedCountriesCache) return sortedCountriesCache

  const all = getCountries().map(iso => ({
    iso,
    name: displayNames?.of(iso) || iso,
    dialCode: `+${getCountryCallingCode(iso)}`,
    flag: countryFlag(iso),
  }))

  const byIso = Object.fromEntries(all.map(c => [c.iso, c]))
  const priority = PRIORITY_COUNTRIES.map(iso => byIso[iso]).filter(Boolean)
  const rest = all
    .filter(c => !PRIORITY_COUNTRIES.includes(c.iso))
    .sort((a, b) => a.name.localeCompare(b.name, 'en'))

  sortedCountriesCache = [...priority, ...rest]
  return sortedCountriesCache
}

/** Country plus the number exactly as typed. No length or format check. */
export function formatPhoneAnswer(answer) {
  if (answer == null || answer === '') return ''
  if (typeof answer !== 'object') return String(answer)
  const country = getSortedPhoneCountries().find(c => c.iso === answer.country)
  const number = String(answer.number || '').trim()
  return [country?.dialCode, number].filter(Boolean).join(' ')
}
