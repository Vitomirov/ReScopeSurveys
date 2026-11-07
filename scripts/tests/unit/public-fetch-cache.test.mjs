import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHotCache } from '../../../server/src/plugins/hotCache.js'
import { countsSurveyWideFetch } from '../../../server/src/lib/survey/publicFetch.js'
import { hashWriteKey, newWriteKey, resolveWriteKey } from '../../../server/src/lib/survey/responseWriteKey.js'

test('a cached public survey skips the survey-wide fetch cap', () => {
  assert.equal(countsSurveyWideFetch(true), false)
  assert.equal(countsSurveyWideFetch(false), true)
  assert.equal(countsSurveyWideFetch(undefined), true)
})

test('public path cache is dropped with the survey and the organization', () => {
  const cache = createHotCache()
  const row = {
    id: 'survey-1',
    organizationId: 'org-1',
    survey: { status: 'live' },
    items: [],
    revision: 1,
  }
  cache.setPublicPath('client.example', 'my-survey', row)
  cache.setLiveSurvey(row.id, row)
  assert.equal(cache.getPublicPath('client.example', 'my-survey').id, 'survey-1')
  assert.equal(cache.getPublicPath('other.example', 'my-survey'), undefined)

  cache.invalidateSurvey('survey-1', 'org-1')
  assert.equal(cache.getPublicPath('client.example', 'my-survey'), undefined)
  assert.equal(cache.getLiveSurvey('survey-1'), undefined)

  cache.setPublicPath('client.example', 'my-survey', row)
  cache.invalidateOrg('org-1')
  assert.equal(cache.getPublicPath('client.example', 'my-survey'), undefined)
})

test('a trusted inbox hash is stored once and must match on update', () => {
  const issued = newWriteKey()
  const trustedHash = hashWriteKey(issued)
  const created = resolveWriteKey(null, { trustedHash })
  assert.equal(created.writeKeyHash, trustedHash)
  assert.equal(created.issuedWriteKey, null)

  const existing = { writeKeyHash: trustedHash }
  assert.equal(resolveWriteKey(existing, { trustedHash }).writeKeyRejected, undefined)
  assert.equal(resolveWriteKey(existing, { trustedHash: 'nope' }).writeKeyRejected, true)
  assert.equal(resolveWriteKey(existing, { presentedKey: issued }).writeKeyRejected, undefined)
})
