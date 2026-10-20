/**
 * Optional authenticator codes. Password login never reads the encryption
 * key. The key is used only while enrolling or checking a code.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { authenticator } from 'otplib'

const ISSUER = 'ReScope'

export function totpKeyMissingError() {
  const err = new Error('TOTP_ENCRYPTION_KEY is not set')
  err.code = 'TOTP_KEY_MISSING'
  return err
}

function keyBytes() {
  const raw = String(process.env.TOTP_ENCRYPTION_KEY || '').trim()
  if (raw.length < 16) throw totpKeyMissingError()
  return createHash('sha256').update(raw, 'utf8').digest()
}

export function sealTotpSecret(plain) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', keyBytes(), iv)
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${enc.toString('base64url')}`
}

export function openTotpSecret(stored) {
  const parts = String(stored || '').split('.')
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Stored authenticator secret is unreadable')
  }
  const iv = Buffer.from(parts[1], 'base64url')
  const tag = Buffer.from(parts[2], 'base64url')
  const enc = Buffer.from(parts[3], 'base64url')
  const decipher = createDecipheriv('aes-256-gcm', keyBytes(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8')
}

export function generateTotpSecret() {
  return authenticator.generateSecret()
}

export function totpKeyUri(accountLabel, secret) {
  return authenticator.keyuri(accountLabel, ISSUER, secret)
}

export function verifyTotpToken(token, secret) {
  try {
    return authenticator.verify({ token: String(token || '').trim(), secret })
  } catch {
    return false
  }
}

/**
 * Password-only accounts return ok without touching the encryption key.
 * @returns {{ ok: true } | { ok: false, code: string, error: string }}
 */
export function assertTotpIfEnabled(user, code) {
  if (!user?.totpEnabled) return { ok: true }
  if (!String(code || '').trim()) {
    return { ok: false, code: 'TOTP_REQUIRED', error: 'Authenticator code required.' }
  }
  let secret
  try {
    secret = openTotpSecret(user.totpSecret)
  } catch (err) {
    if (err.code === 'TOTP_KEY_MISSING') {
      return { ok: false, code: 'TOTP_KEY_MISSING', error: 'Authenticator is not available.' }
    }
    return { ok: false, code: 'TOTP_INVALID', error: 'Invalid authenticator code.' }
  }
  if (!verifyTotpToken(code, secret)) {
    return { ok: false, code: 'TOTP_INVALID', error: 'Invalid authenticator code.' }
  }
  return { ok: true }
}
