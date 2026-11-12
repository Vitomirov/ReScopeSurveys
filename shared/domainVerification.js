// ─── Custom domain verification lifecycle (enterprise) ─────────────────────

import { RESCOPESURVEYS_HOST } from './surveyUrl.js'

export const DOMAIN_VERIFICATION_STATUSES = ['pending', 'verified', 'failed']

/** Client CNAME target. The server address stays on this host. */
export const SURVEY_CNAME_TARGET = `surveys.${RESCOPESURVEYS_HOST}`

function routingRecords(domain) {
  const host = String(domain || '').trim().toLowerCase()
  if (!host) return { cnameHost: '', cnameValue: '' }
  return {
    cnameHost: `surveys.${host}`,
    cnameValue: SURVEY_CNAME_TARGET,
  }
}

export function defaultDomainVerification(domain) {
  return {
    domain: domain || '',
    status: 'pending',
    ...routingRecords(domain),
    txtRecord: domain ? `_rescope-verify.${domain}` : '',
    txtValue: '',
    verifiedAt: null,
    lastCheckedAt: null,
    failureReason: null,
  }
}

export function normalizeDomainVerification(input, { domain } = {}) {
  const raw = input && typeof input === 'object' ? input : {}
  const status = DOMAIN_VERIFICATION_STATUSES.includes(raw.status) ? raw.status : 'pending'
  const host = String(raw.domain || domain || '').trim().toLowerCase()
  return {
    domain: host,
    status,
    ...routingRecords(host),
    txtRecord: raw.txtRecord || (host ? `_rescope-verify.${host}` : ''),
    txtValue: String(raw.txtValue || '').trim(),
    verifiedAt: raw.verifiedAt || null,
    lastCheckedAt: raw.lastCheckedAt || null,
    failureReason: raw.failureReason || null,
  }
}

/** Custom domain is active only when verified (enterprise plan checked elsewhere). */
export function isDomainVerified(verification) {
  return verification?.status === 'verified' && Boolean(verification.domain)
}

/** Resolve effective survey domain respecting verification state. */
export function resolveVerifiedSurveyDomain({ surveyDomain, domainVerification, planAllowsCustomDomain }) {
  if (!planAllowsCustomDomain) return ''
  const verification = normalizeDomainVerification(domainVerification, { domain: surveyDomain })
  if (!isDomainVerified(verification)) return ''
  return verification.domain
}
