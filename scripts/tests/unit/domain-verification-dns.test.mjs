/**
 * DNS TXT verification helpers
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  flattenTxtRecords,
  txtRecordMatches,
  cnameTargetMatches,
  checkDomainVerificationDns,
} from '../../../server/src/lib/platform/checkDomainVerificationDns.js'
import { normalizeDomainVerification, SURVEY_CNAME_TARGET } from '../../../shared/domainVerification.js'
import { isAllowedCaddySurveyHost, surveysHostnameForDomain } from '../../../server/src/lib/platform/caddyAsk.js'

test('flattenTxtRecords joins chunked TXT values', () => {
  assert.deepEqual(flattenTxtRecords([['hello', ' world']]), ['hello world'])
  assert.deepEqual(flattenTxtRecords([['token-a'], ['token-b']]), ['token-a', 'token-b'])
})

test('txtRecordMatches compares trimmed values', () => {
  assert.equal(txtRecordMatches(['rescope-verify-abc'], 'rescope-verify-abc'), true)
  assert.equal(txtRecordMatches([' other '], 'rescope-verify-abc'), false)
})

test('normalizeDomainVerification includes the shared surveys CNAME', () => {
  const verification = normalizeDomainVerification({
    domain: 'dejanvitomirov.com',
    txtValue: 'rescope-verify-6afc0a54',
  })
  assert.equal(verification.cnameHost, 'surveys.dejanvitomirov.com')
  assert.equal(verification.cnameValue, SURVEY_CNAME_TARGET)
  assert.equal(verification.txtRecord, '_rescope-verify.dejanvitomirov.com')
})

test('cnameTargetMatches ignores a trailing dot', () => {
  assert.equal(cnameTargetMatches(['surveys.rescopesurveys.com.'], SURVEY_CNAME_TARGET), true)
  assert.equal(cnameTargetMatches(['other.example.com'], SURVEY_CNAME_TARGET), false)
})

test('checkDomainVerificationDns matches TXT and surveys CNAME', async () => {
  const result = await checkDomainVerificationDns(
    {
      domain: 'client.com',
      txtRecord: '_rescope-verify.client.com',
      txtValue: 'rescope-verify-abc',
    },
    {
      resolveTxt: async () => [['rescope-verify-abc']],
      resolveCname: async () => [SURVEY_CNAME_TARGET],
    },
  )

  assert.equal(result.matched, true)
  assert.equal(result.failureReason, null)
})

test('checkDomainVerificationDns accepts an A record that reaches the platform', async () => {
  const result = await checkDomainVerificationDns(
    {
      domain: 'client.com',
      txtRecord: '_rescope-verify.client.com',
      txtValue: 'rescope-verify-abc',
    },
    {
      resolveTxt: async () => [['rescope-verify-abc']],
      resolveCname: async () => {
        const err = new Error('not a cname')
        err.code = 'ENODATA'
        throw err
      },
      resolve4: async () => ['203.0.113.10'],
    },
  )

  assert.equal(result.matched, true)
})

test('checkDomainVerificationDns reports a surveys host that points elsewhere', async () => {
  const result = await checkDomainVerificationDns(
    {
      domain: 'client.com',
      txtRecord: '_rescope-verify.client.com',
      txtValue: 'rescope-verify-abc',
    },
    {
      resolveTxt: async () => [['rescope-verify-abc']],
      resolveCname: async () => ['surveys.elsewhere.example'],
      resolve4: async (host) => host === SURVEY_CNAME_TARGET ? ['203.0.113.10'] : ['198.51.100.20'],
    },
  )

  assert.equal(result.matched, false)
  assert.match(result.failureReason, /does not point/i)
})

test('checkDomainVerificationDns reports missing TXT record', async () => {
  const result = await checkDomainVerificationDns(
    {
      domain: 'client.com',
      txtRecord: '_rescope-verify.client.com',
      txtValue: 'rescope-verify-abc',
    },
    {
      resolveTxt: async () => {
        const err = new Error('not found')
        err.code = 'ENOTFOUND'
        throw err
      },
    },
  )

  assert.equal(result.matched, false)
  assert.match(result.failureReason, /not found/i)
})

test('checkDomainVerificationDns reports mismatched TXT value', async () => {
  const result = await checkDomainVerificationDns(
    {
      domain: 'client.com',
      txtRecord: '_rescope-verify.client.com',
      txtValue: 'rescope-verify-abc',
    },
    {
      resolveTxt: async () => [['wrong-token']],
    },
  )

  assert.equal(result.matched, false)
  assert.match(result.failureReason, /does not match/i)
})

test('caddy ask allows only verified enterprise survey hosts', () => {
  assert.equal(
    isAllowedCaddySurveyHost('surveys.imperatorconsulting.com', ['imperatorconsulting.com']),
    true,
  )
  assert.equal(
    isAllowedCaddySurveyHost('surveys.evil.com', ['imperatorconsulting.com']),
    false,
  )
  assert.equal(surveysHostnameForDomain('imperatorconsulting.com'), 'surveys.imperatorconsulting.com')
})
