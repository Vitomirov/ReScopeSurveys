/**
 * One-time auth tokens (invite, password reset, email verification).
 * Raw tokens are random, emailed once, and stored only as SHA-256 hashes.
 * Issuing a new token voids earlier pending ones for the same purpose/email;
 * consuming is atomic so a link can never be redeemed twice.
 */
import { randomBytes } from 'node:crypto'
import { hashToken } from './refreshTokens.js'

export const AUTH_TOKEN_TYPES = {
  INVITE:         'invite',
  PASSWORD_RESET: 'password_reset',
  EMAIL_VERIFY:   'email_verify',
}

const HOUR_MS = 60 * 60 * 1000
export const AUTH_TOKEN_TTL_MS = {
  [AUTH_TOKEN_TYPES.INVITE]:         7 * 24 * HOUR_MS,
  [AUTH_TOKEN_TYPES.PASSWORD_RESET]: HOUR_MS,
  [AUTH_TOKEN_TYPES.EMAIL_VERIFY]:   48 * HOUR_MS,
}

export class AuthTokenError extends Error {
  constructor(message = 'This link is invalid or has expired.') {
    super(message)
    this.name = 'AuthTokenError'
    this.code = 'INVALID_TOKEN'
  }
}

function isPending(row) {
  return row && !row.usedAt && row.expiresAt > new Date()
}

/** Void pending tokens of one type for an email (e.g. before re-sending). */
export async function voidPendingTokens(prisma, type, email) {
  await prisma.authToken.updateMany({
    where: { type, email, usedAt: null },
    data: { usedAt: new Date() },
  })
}

export async function issueAuthToken(prisma, {
  type, email, userId, organizationId, role, invitedById, canUseBuilder, canUsePanel,
}) {
  const ttlMs = AUTH_TOKEN_TTL_MS[type]
  if (!ttlMs) throw new Error(`Unknown auth token type: ${type}`)

  await voidPendingTokens(prisma, type, email)
  const rawToken = randomBytes(32).toString('base64url')
  const row = await prisma.authToken.create({
    data: {
      type,
      email,
      tokenHash: hashToken(rawToken),
      userId: userId ?? null,
      organizationId: organizationId ?? null,
      role: role ?? null,
      canUseBuilder: canUseBuilder !== false,
      canUsePanel: Boolean(canUsePanel),
      invitedById: invitedById ?? null,
      expiresAt: new Date(Date.now() + ttlMs),
    },
  })
  return { rawToken, row }
}

/** Look up a token without consuming it (e.g. invite preview). */
export async function peekAuthToken(prisma, type, rawToken) {
  if (!rawToken || typeof rawToken !== 'string') throw new AuthTokenError()
  const row = await prisma.authToken.findUnique({ where: { tokenHash: hashToken(rawToken) } })
  if (!row || row.type !== type || !isPending(row)) throw new AuthTokenError()
  return row
}

/** Mark a token used. Atomic: exactly one caller wins even under concurrent requests. */
export async function consumeAuthToken(prisma, type, rawToken) {
  const row = await peekAuthToken(prisma, type, rawToken)
  const claimed = await prisma.authToken.updateMany({
    where: { id: row.id, usedAt: null },
    data: { usedAt: new Date() },
  })
  if (claimed.count !== 1) throw new AuthTokenError()
  return row
}

export async function listPendingInvites(prisma, organizationId) {
  return prisma.authToken.findMany({
    where: {
      organizationId,
      type: AUTH_TOKEN_TYPES.INVITE,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      email: true,
      role: true,
      canUseBuilder: true,
      canUsePanel: true,
      expiresAt: true,
      createdAt: true,
    },
  })
}
