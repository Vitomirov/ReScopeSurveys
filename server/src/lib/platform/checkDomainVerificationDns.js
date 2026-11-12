/**
 * DNS lookup for enterprise custom-domain verification.
 * The client publishes a CNAME for surveys.{domain} and a TXT ownership token.
 */
import { Resolver, resolveTxt, resolveCname, resolve4 } from 'node:dns/promises'
import { SURVEY_CNAME_TARGET } from '../../../../shared/domainVerification.js'

const PUBLIC_DNS = ['8.8.8.8', '1.1.1.1']

/** Flatten DNS TXT chunks into full string values. */
export function flattenTxtRecords(chunks) {
  if (!Array.isArray(chunks)) return []
  return chunks.map(parts => parts.join(''))
}

function createPublicResolver() {
  const resolver = new Resolver()
  resolver.setServers(PUBLIC_DNS)
  return resolver
}

/**
 * Look up TXT records for a hostname.
 * Uses public DNS — Docker's embedded resolver (127.0.0.11) often lags on new records.
 * Returns an empty array when the record does not exist.
 */
export async function lookupTxtRecords(hostname, { resolveTxt: resolver = resolveTxt } = {}) {
  const host = String(hostname || '').trim().toLowerCase()
  if (!host) return []

  const lookup = async (fn) => {
    try {
      const chunks = await fn(host)
      return flattenTxtRecords(chunks)
    } catch (err) {
      if (err?.code === 'ENOTFOUND' || err?.code === 'ENODATA') return null
      throw err
    }
  }

  const publicResolver = createPublicResolver()
  const fromPublic = await lookup((h) => publicResolver.resolveTxt(h))
  if (fromPublic?.length) return fromPublic

  const fromSystem = await lookup(resolver)
  return fromSystem ?? []
}

export function txtRecordMatches(records, expectedValue) {
  const expected = String(expectedValue || '').trim()
  if (!expected) return false
  return records.some(record => String(record).trim() === expected)
}

export function normalizeDnsName(value) {
  return String(value || '').trim().toLowerCase().replace(/\.$/, '')
}

export function cnameTargetMatches(records, expectedTarget) {
  const expected = normalizeDnsName(expectedTarget)
  if (!expected) return false
  return records.some(record => normalizeDnsName(record) === expected)
}

async function lookupDns(hostname, resolvers) {
  const host = normalizeDnsName(hostname)
  if (!host) return []

  const read = async (fn) => {
    try {
      const records = await fn(host)
      return (Array.isArray(records) ? records : []).map(record => String(record).trim()).filter(Boolean)
    } catch (err) {
      if (err?.code === 'ENOTFOUND' || err?.code === 'ENODATA') return null
      throw err
    }
  }

  for (const fn of resolvers) {
    const found = await read(fn)
    if (found?.length) return found
  }
  return []
}

function publicThenSystem(method, injected) {
  if (injected) return [injected]
  const resolver = createPublicResolver()
  return [
    (host) => resolver[method](host),
    method === 'resolveCname' ? resolveCname : resolve4,
  ]
}

export function lookupCnameRecords(hostname, { resolveCname: injected } = {}) {
  return lookupDns(hostname, publicThenSystem('resolveCname', injected))
}

export function lookupIpv4Records(hostname, { resolve4: injected } = {}) {
  return lookupDns(hostname, publicThenSystem('resolve4', injected))
}

/**
 * surveys.{domain} must CNAME to the platform host, or resolve to the same addresses.
 */
export async function checkSurveyRoutingDns(domain, options = {}) {
  const host = normalizeDnsName(domain)
  const surveyHost = host ? `surveys.${host}` : ''
  if (!surveyHost) {
    return { matched: false, failureReason: 'Survey domain is missing.' }
  }

  const cnames = await lookupCnameRecords(surveyHost, options)
  if (cnameTargetMatches(cnames, SURVEY_CNAME_TARGET)) {
    return { matched: true, failureReason: null }
  }

  const [hostAddrs, targetAddrs] = await Promise.all([
    lookupIpv4Records(surveyHost, options),
    lookupIpv4Records(SURVEY_CNAME_TARGET, options),
  ])
  const targets = new Set(targetAddrs)
  if (hostAddrs.some(ip => targets.has(ip))) {
    return { matched: true, failureReason: null }
  }

  return {
    matched: false,
    failureReason: cnames.length || hostAddrs.length
      ? `surveys host does not point at ${SURVEY_CNAME_TARGET}.`
      : 'CNAME record for surveys was not found.',
  }
}

/**
 * Check whether the expected verification token is published in DNS.
 * @returns {{ matched: boolean, records: string[], failureReason: string|null }}
 */
export async function checkDomainVerificationDns(verification, options = {}) {
  const hostname = verification?.txtRecord
    || (verification?.domain ? `_rescope-verify.${verification.domain}` : '')

  if (!hostname || !verification?.txtValue) {
    return {
      matched: false,
      records: [],
      failureReason: 'Domain verification is not initialized.',
    }
  }

  const records = await lookupTxtRecords(hostname, options)
  const txtMatched = txtRecordMatches(records, verification.txtValue)
  if (!txtMatched) {
    return {
      matched: false,
      records,
      failureReason: records.length
        ? 'DNS TXT record found but value does not match.'
        : 'DNS TXT record not found.',
    }
  }

  const routing = await checkSurveyRoutingDns(verification.domain, options)
  return {
    matched: routing.matched,
    records,
    failureReason: routing.failureReason,
  }
}
