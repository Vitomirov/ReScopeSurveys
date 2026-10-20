/**
 * Cookie that binds a new public response to the browser that created it.
 * One cookie holds up to eight id/key pairs so two open surveys still save.
 * Legacy rows have no hash and do not consult this cookie.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export const RESPONSE_WRITE_COOKIE = 'rs_response_write'
const MAX_PAIRS = 8

export function hashWriteKey(raw) {
  return createHash('sha256').update(String(raw), 'utf8').digest('hex')
}

export function newWriteKey() {
  return randomBytes(32).toString('base64url')
}

export function writeKeyMatches(storedHash, presentedKey) {
  if (!storedHash || !presentedKey) return false
  const got = hashWriteKey(presentedKey)
  const a = Buffer.from(String(storedHash))
  const b = Buffer.from(got)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function parsePairs(value) {
  if (!value || typeof value !== 'string') return []
  const pairs = []
  for (const part of value.split('|')) {
    const dot = part.indexOf('.')
    if (dot <= 0) continue
    const id = part.slice(0, dot)
    const key = part.slice(dot + 1)
    if (!id || !key) continue
    pairs.push({ id, key })
  }
  return pairs
}

export function presentedKeyFor(cookieValue, responseId) {
  if (!responseId) return null
  const found = parsePairs(cookieValue).find((pair) => pair.id === responseId)
  return found ? found.key : null
}

export function rememberWriteKey(cookieValue, responseId, rawKey) {
  const pairs = parsePairs(cookieValue).filter((pair) => pair.id !== responseId)
  pairs.push({ id: responseId, key: rawKey })
  return pairs.slice(-MAX_PAIRS).map((pair) => `${pair.id}.${pair.key}`).join('|')
}
