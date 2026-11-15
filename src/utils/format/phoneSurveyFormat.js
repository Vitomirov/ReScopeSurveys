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

/** Countries whose English name starts with this letter (a–z). */
export function countriesByNameLetter(countries, letter) {
  if (!letter || letter.length !== 1) return []
  const prefix = letter.toLowerCase()
  return countries.filter(c => c.name.toLowerCase().startsWith(prefix))
}

/** Next match when typing the same letter again (F → France, Finland, …). */
export function nextCountryByLetter(countries, letter, currentIso = null) {
  const matches = countriesByNameLetter(countries, letter)
  if (!matches.length) return null
  if (!currentIso) return matches[0]
  const idx = matches.findIndex(c => c.iso === currentIso)
  if (idx < 0) return matches[0]
  return matches[(idx + 1) % matches.length]
}

/** Country plus the number exactly as typed. No length or format check. */
export function formatPhoneAnswer(answer) {
  if (answer == null || answer === '') return ''
  if (typeof answer !== 'object') return String(answer)
  const country = getSortedPhoneCountries().find(c => c.iso === answer.country)
  const number = String(answer.number || '').trim()
  return [country?.dialCode, number].filter(Boolean).join(' ')
}
