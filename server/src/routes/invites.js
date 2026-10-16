/**
 * Team invitations.
 * Admins invite by email + role; the invitee accepts a one-time link, chooses
 * a password, and is created inside the inviting organization with a verified
 * email. Admins never see or set another user's password.
 */
import { requireRole } from '../lib/auth/authz.js'
import { ROLES, ROLE_VALUES } from '../lib/auth/roles.js'
import { hashPassword } from '../lib/auth/password.js'
import { validatePassword } from '../lib/auth/passwordPolicy.js'
import { issueAuthSession } from '../lib/auth/session.js'
import { assertCanAddUser } from '../lib/billing/planEnforcement.js'
import { enforceAuthLimits } from '../lib/survey/rateLimit.js'
import { sendInviteEmail } from '../lib/auth/accountLinks.js'
import {
  AUTH_TOKEN_TYPES,
  AuthTokenError,
  consumeAuthToken,
  listPendingInvites,
  peekAuthToken,
} from '../lib/auth/authTokens.js'
import {
  validateEmailFormat,
  assertEmailAvailable,
  deriveUsernameForOrg,
} from '../lib/auth/userIdentity.js'
import { grantFromFlags, resolveProductGrant } from '../lib/auth/productAccess.js'

const adminOnly = requireRole(ROLES.ADMIN)

function inviteResponse(row, acceptUrl = null) {
  return {
    id:        row.id,
    email:     row.email,
    role:      row.role,
    productGrant: grantFromFlags(row.canUseBuilder !== false, row.canUsePanel),
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    ...(acceptUrl ? { acceptUrl } : {}),
  }
}

function invalidLink(reply, err) {
  const message = err instanceof AuthTokenError ? err.message : 'This link is invalid or has expired.'
  return reply.code(400).send({ error: message, code: 'INVALID_TOKEN' })
}

async function loadInviter(app, request) {
  return app.prisma.user.findUnique({
    where: { id: request.auth.userId },
    select: { id: true, name: true, username: true, email: true, emailVerifiedAt: true, organization: { select: { id: true, name: true } } },
  })
}

export async function registerInviteRoutes(app) {
  const limits = app.rateLimits

  // ─── Admin: manage invitations ─────────────────────────────────────────
  app.get('/api/platform/invites', { preHandler: adminOnly }, async (request) => {
    const rows = await listPendingInvites(app.prisma, request.organizationId)
    return { invites: rows.map(inviteResponse) }
  })

  app.post('/api/platform/invites', { preHandler: adminOnly }, async (request, reply) => {
    const limited = await enforceAuthLimits(request, reply, {
      ipLimiter: limits.invite,
      globalLimiter: limits.inviteGlobal,
      scope: 'invite',
    })
    if (limited) return limited

    const { email, role = ROLES.EDITOR, productGrant = 'builder' } = request.body ?? {}
    if (!ROLE_VALUES.has(role) || role === ROLES.PLATFORM_OWNER) {
      return reply.code(400).send({ error: 'Invalid role.' })
    }
    const access = await resolveProductGrant(app.prisma, request.organizationId, productGrant)
    if (!access.ok) return reply.code(403).send({ error: access.error, code: access.code })
    const formatCheck = validateEmailFormat(email)
    if (!formatCheck.ok) return reply.code(400).send({ error: formatCheck.error })

    const inviter = await loadInviter(app, request)
    if (!inviter.emailVerifiedAt) {
      return reply.code(403).send({
        error: 'Confirm your email address before inviting teammates.',
        code: 'EMAIL_UNVERIFIED',
      })
    }

    const emailCheck = await assertEmailAvailable(app.prisma, formatCheck.email)
    if (!emailCheck.ok) return reply.code(409).send({ error: emailCheck.error })

    const seatCheck = await assertCanAddUser(app.prisma, request.organizationId)
    if (!seatCheck.ok) {
      return reply.code(403).send({ error: seatCheck.error, code: seatCheck.code })
    }

    const sent = await sendInviteEmail(app, {
      email: emailCheck.email,
      role,
      canUseBuilder: access.canUseBuilder,
      canUsePanel: access.canUsePanel,
      organization: inviter.organization,
      invitedBy: inviter,
    })
    return reply.code(201).send({ invite: inviteResponse(sent.row, sent.acceptUrl) })
  })

  app.post('/api/platform/invites/:id/resend', { preHandler: adminOnly }, async (request, reply) => {
    const limited = await enforceAuthLimits(request, reply, {
      ipLimiter: limits.invite,
      globalLimiter: limits.inviteGlobal,
      scope: 'invite',
    })
    if (limited) return limited

    const existing = await app.prisma.authToken.findFirst({
      where: { id: request.params.id, organizationId: request.organizationId, type: AUTH_TOKEN_TYPES.INVITE, usedAt: null },
    })
    if (!existing) return reply.code(404).send({ error: 'Invitation not found.' })

    const inviter = await loadInviter(app, request)
    // Re-issuing voids the previous link and restarts the expiry window.
    const sent = await sendInviteEmail(app, {
      email: existing.email,
      role: existing.role,
      canUseBuilder: existing.canUseBuilder !== false,
      canUsePanel: Boolean(existing.canUsePanel),
      organization: inviter.organization,
      invitedBy: inviter,
    })
    return { invite: inviteResponse(sent.row, sent.acceptUrl) }
  })

  app.delete('/api/platform/invites/:id', { preHandler: adminOnly }, async (request, reply) => {
    const revoked = await app.prisma.authToken.updateMany({
      where: { id: request.params.id, organizationId: request.organizationId, type: AUTH_TOKEN_TYPES.INVITE, usedAt: null },
      data: { usedAt: new Date() },
    })
    if (revoked.count !== 1) return reply.code(404).send({ error: 'Invitation not found.' })
    return { ok: true }
  })

  // ─── Public: accept an invitation ──────────────────────────────────────
  app.post('/api/auth/invites/preview', async (request, reply) => {
    const limited = await enforceAuthLimits(request, reply, {
      ipLimiter: limits.tokenExchange,
      globalLimiter: limits.tokenExchangeGlobal,
      scope: 'token-exchange',
    })
    if (limited) return limited

    try {
      const row = await peekAuthToken(app.prisma, AUTH_TOKEN_TYPES.INVITE, request.body?.token)
      const org = await app.prisma.organization.findUnique({
        where: { id: row.organizationId },
        select: { name: true },
      })
      if (!org) throw new AuthTokenError()
      return {
        invite: {
          email: row.email,
          role: row.role,
          productGrant: grantFromFlags(row.canUseBuilder !== false, row.canUsePanel),
          organizationName: org.name,
        },
      }
    } catch (err) {
      return invalidLink(reply, err)
    }
  })

  app.post('/api/auth/invites/accept', async (request, reply) => {
    const limited = await enforceAuthLimits(request, reply, {
      ipLimiter: limits.tokenExchange,
      globalLimiter: limits.tokenExchangeGlobal,
      scope: 'token-exchange',
    })
    if (limited) return limited

    const { token, name, password } = request.body ?? {}
    if (!name?.trim()) return reply.code(400).send({ error: 'Please enter your full name.' })
    const passwordCheck = validatePassword(password)
    if (!passwordCheck.ok) return reply.code(400).send({ error: passwordCheck.error })

    let invite
    try {
      invite = await peekAuthToken(app.prisma, AUTH_TOKEN_TYPES.INVITE, token)
    } catch (err) {
      return invalidLink(reply, err)
    }

    const emailCheck = await assertEmailAvailable(app.prisma, invite.email)
    if (!emailCheck.ok) {
      return reply.code(409).send({ error: 'This email is already registered. Sign in instead.' })
    }
    const seatCheck = await assertCanAddUser(app.prisma, invite.organizationId)
    if (!seatCheck.ok) {
      return reply.code(403).send({ error: seatCheck.error, code: seatCheck.code })
    }

    const passwordHash = await hashPassword(password)
    let user
    try {
      user = await app.prisma.$transaction(async (tx) => {
        await consumeAuthToken(tx, AUTH_TOKEN_TYPES.INVITE, token)
        const username = await deriveUsernameForOrg(tx, invite.organizationId, invite.email)
        return tx.user.create({
          data: {
            organizationId:  invite.organizationId,
            username,
            email:           invite.email,
            passwordHash,
            name:            name.trim(),
            role:            invite.role || ROLES.EDITOR,
            canUseBuilder:   invite.canUseBuilder !== false,
            canUsePanel:     Boolean(invite.canUsePanel),
            // Reaching this link proves control of the invited mailbox.
            emailVerifiedAt: new Date(),
          },
          include: { organization: { select: { name: true } } },
        })
      })
    } catch (err) {
      if (err instanceof AuthTokenError) return invalidLink(reply, err)
      throw err
    }

    const session = await issueAuthSession(app, reply, user, user.organization?.name)
    return reply.code(201).send({ session })
  })
}
