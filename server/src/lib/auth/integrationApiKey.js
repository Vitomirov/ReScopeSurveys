import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { hashToken } from './refreshTokens.js'

export const INTEGRATION_KEY_PREFIX = 'rsk_live_'

export function generateIntegrationKey() {
  const secret = randomBytes(32).toString('base64url')
  const raw = `${INTEGRATION_KEY_PREFIX}${secret}`
  const prefix = raw.slice(0, 16)
  return { raw, prefix, keyHash: hashToken(raw) }
}

export function extractIntegrationKey(request) {
  const header = request.headers.authorization
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7).trim()
    if (token.startsWith(INTEGRATION_KEY_PREFIX)) return token
  }
  const alt = request.headers['x-rescope-api-key']
  if (typeof alt === 'string' && alt.startsWith(INTEGRATION_KEY_PREFIX)) return alt.trim()
  return null
}

export async function verifyIntegrationKey(prisma, rawKey) {
  if (!rawKey) return null
  const keyHash = hashToken(rawKey)
  const row = await prisma.organizationIntegrationKey.findFirst({
    where: {
      keyHash,
      revokedAt: null,
    },
  })
  return row || null
}

export function hashLookupPrefix(raw) {
  return createHash('sha256').update(String(raw || ''), 'utf8').digest('hex').slice(0, 16)
}