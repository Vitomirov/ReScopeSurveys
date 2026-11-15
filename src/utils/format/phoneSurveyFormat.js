import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from 'libphonenumber-js'

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

export function formatPhoneAsYouType(rawInput, countryIso) {
  if (!countryIso) return rawInput ?? ''
  return new AsYouType(countryIso).input(String(rawInput ?? ''))
}

export function parsePhoneToE164(rawInput, countryIso) {
  if (!countryIso || !rawInput?.trim()) return null
  const parsed = parsePhoneNumberFromString(rawInput, countryIso)
  if (!parsed || !parsed.isValid()) return null
  return parsed.number
}

export function countryFromE164(value) {
  if (!value) return null
  return parsePhoneNumberFromString(value)?.country || null
}

export function examplePlaceholderForCountry(countryIso) {
  if (countryIso === 'US') return '(555) 123-4567'
  if (countryIso === 'GB') return '07700 900123'
  return 'Phone number'
}
