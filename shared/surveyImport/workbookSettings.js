/**
 * Survey sheet key → import survey meta / settings.
 * Flat workbook keys keep Excel authoring simple; runtime nests fingerprinting / locks.
 */

export const SURVEY_META_KEYS = new Set([
  'title',
  'internalName',
  'surveyCode',
  'description',
  'clientName',
  'topicName',
  'surveyTypeName',
  'startButtonText',
  'showCoverPage',
])

/** Keys that land under survey.settings (except nested fingerprinting / locks). */
export const SURVEY_SETTING_KEYS = new Set([
  'onePerPage',
  'disableBackButton',
  'showProgressBar',
  'completeTitle',
  'terminateTitle',
  'terminateMessage',
  'closedTitle',
  'closedMessage',
  'redirectTitle',
  'redirectMessage',
])

export const DEFAULT_IMPORT_FINGERPRINT_SIGNALS = {
  ip: true,
  browser: true,
  os: true,
  deviceType: true,
  screen: true,
  timezone: true,
  language: true,
  hardware: false,
  connection: false,
  canvas: true,
  webgl: false,
  cookies: false,
  doNotTrack: false,
  userAgent: false,
}

export function parseYesNo(value, { defaultValue = false } = {}) {
  const raw = String(value ?? '').trim().toLowerCase()
  if (!raw) return defaultValue
  if (['y', 'yes', 'true', '1'].includes(raw)) return true
  if (['n', 'no', 'false', '0'].includes(raw)) return false
  return defaultValue
}

/**
 * Split Survey sheet key/value rows into survey fields + settings object.
 * @param {Record<string, string>} flat
 */
export function splitSurveySheetFlat(flat) {
  const survey = {}
  const settings = {}

  for (const [key, raw] of Object.entries(flat || {})) {
    const value = String(raw ?? '').trim()
    if (!key || value === '') continue

    if (key === 'fingerprinting' || key === 'fingerprint') {
      settings.fingerprinting = {
        enabled: parseYesNo(value),
        signals: { ...DEFAULT_IMPORT_FINGERPRINT_SIGNALS },
      }
      continue
    }

    if (key === 'navigationLockAllPagesSeconds' || key === 'forceStayAllPagesSeconds') {
      const seconds = Number(value)
      if (Number.isFinite(seconds) && seconds > 0) {
        settings.navigationLockAllPages = { enabled: true, seconds: Math.round(seconds) }
      }
      continue
    }

    if (key === 'showCoverPage') {
      survey.showCoverPage = parseYesNo(value, { defaultValue: true })
      continue
    }

    if (SURVEY_META_KEYS.has(key)) {
      survey[key] = value
      continue
    }

    if (SURVEY_SETTING_KEYS.has(key)) {
      if (['onePerPage', 'disableBackButton', 'showProgressBar'].includes(key)) {
        settings[key] = parseYesNo(value, {
          defaultValue: key === 'onePerPage' || key === 'showProgressBar',
        })
      } else {
        settings[key] = value
      }
      continue
    }

    // Unknown keys stay on survey for forward-compat / human notes (ignored by persist if unused)
    survey[key] = value
  }

  if (Object.keys(settings).length) survey.settings = settings
  return survey
}
