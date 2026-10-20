/**
 * Organization platform list and user management routes.
 * CRUD for clients, topics, and survey types (admin write); team member
 * provisioning with seat-limit checks and last-admin safeguards.
 */
import { hashPassword } from '../lib/auth/password.js'
import { requireRole } from '../lib/auth/authz.js'
import { ROLES, isAdminRole, ROLE_VALUES } from '../lib/auth/roles.js'
import { assertCanAddUser } from '../lib/billing/planEnforcement.js'
import { revokeAllForUser } from '../lib/auth/refreshTokens.js'
import {
  validateEmailFormat,
  assertEmailAvailable,
  assertUsernameAvailableInOrg,
  deriveUsernameForOrg,
} from '../lib/auth/userIdentity.js'
import { grantFromFlags, hasPanelGrant, resolveProductGrant } from '../lib/auth/productAccess.js'
import { appendAudit } from '../lib/audit.js'

const newId = (prefix) => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
const adminOnly = requireRole(ROLES.ADMIN)

function userResponse(user) {
  return {
    id:        user.id,
    username:  user.username || user.email,
    email:     user.email,
    name:      user.name || user.username || user.email,
    avatarUrl: user.avatarUrl || null,
    role:      user.role,
    productGrant: grantFromFlags(user.canUseBuilder !== false, hasPanelGrant(user)),
    createdAt: user.createdAt?.toISOString?.() ?? null,
  }
}

async function countAdmins(prisma, organizationId) {
  return prisma.user.count({
    where: { organizationId, role: ROLES.ADMIN },
  })
}

export async function registerPlatformRoutes(app) {
  // ─── Clients (read: all authenticated; write: admin) ───────────────────
  app.get('/api/platform/clients', async (request) => {
    const rows = await app.prisma.client.findMany({
      where: { organizationId: request.organizationId },
      orderBy: { name: 'asc' },
    })
    return { clients: rows.map(r => ({ id: r.id, name: r.name })) }
  })

  app.post('/api/platform/clients', { preHandler: adminOnly }, async (request, reply) => {
    const { name } = request.body ?? {}
    if (!name?.trim()) return reply.code(400).send({ error: 'Name is required' })

    const row = await app.prisma.client.create({
      data: {
        id: newId('c'),
        organizationId: request.organizationId,
        name: name.trim(),
      },
    })
    return { client: { id: row.id, name: row.name } }
  })

  app.patch('/api/platform/clients/:id', { preHandler: adminOnly }, async (request, reply) => {
    const { name } = request.body ?? {}
    if (!name?.trim()) return reply.code(400).send({ error: 'Name is required' })

    const existing = await app.prisma.client.findFirst({
      where: { id: request.params.id, organizationId: request.organizationId },
    })
    if (!existing) return reply.code(404).send({ error: 'Client not found' })

    const row = await app.prisma.client.update({
      where: { id: existing.id },
      data: { name: name.trim() },
    })
    return { client: { id: row.id, name: row.name } }
  })

  app.delete('/api/platform/clients/:id', { preHandler: adminOnly }, async (request, reply) => {
    const existing = await app.prisma.client.findFirst({
      where: { id: request.params.id, organizationId: request.organizationId },
    })
    if (!existing) return reply.code(404).send({ error: 'Client not found' })

    await app.prisma.client.delete({ where: { id: existing.id } })
    return { ok: true }
  })

  // ─── Topics (read: all authenticated; write: admin) ──────────────────
  app.get('/api/platform/topics', async (request) => {
    const rows = await app.prisma.topic.findMany({
      where: { organizationId: request.organizationId },
      orderBy: { name: 'asc' },
    })
    return { topics: rows.map(r => ({ id: r.id, name: r.name })) }
  })

  app.post('/api/platform/topics', { preHandler: adminOnly }, async (request, reply) => {
    const { name } = request.body ?? {}
    if (!name?.trim()) return reply.code(400).send({ error: 'Name is required' })

    const row = await app.prisma.topic.create({
      data: {
        id: newId('t'),
        organizationId: request.organizationId,
        name: name.trim(),
      },
    })
    return { topic: { id: row.id, name: row.name } }
  })

  app.patch('/api/platform/topics/:id', { preHandler: adminOnly }, async (request, reply) => {
    const { name } = request.body ?? {}
    if (!name?.trim()) return reply.code(400).send({ error: 'Name is required' })

    const existing = await app.prisma.topic.findFirst({
      where: { id: request.params.id, organizationId: request.organizationId },
    })
    if (!existing) return reply.code(404).send({ error: 'Topic not found' })

    const row = await app.prisma.topic.update({
      where: { id: existing.id },
      data: { name: name.trim() },
    })
    return { topic: { id: row.id, name: row.name } }
  })

  app.delete('/api/platform/topics/:id', { preHandler: adminOnly }, async (request, reply) => {
    const existing = await app.prisma.topic.findFirst({
      where: { id: request.params.id, organizationId: request.organizationId },
    })
    if (!existing) return reply.code(404).send({ error: 'Topic not found' })

    await app.prisma.topic.delete({ where: { id: existing.id } })
    return { ok: true }
  })

  // ─── Survey types (read: all authenticated; write: admin) ──────────────
  app.get('/api/platform/survey-types', async (request) => {
    const rows = await app.prisma.surveyType.findMany({
      where: { organizationId: request.organizationId },
      orderBy: { name: 'asc' },
    })
    return { surveyTypes: rows.map(r => ({ id: r.id, name: r.name })) }
  })

  app.post('/api/platform/survey-types', { preHandler: adminOnly }, async (request, reply) => {
    const { name } = request.body ?? {}
    if (!name?.trim()) return reply.code(400).send({ error: 'Name is required' })

    const row = await app.prisma.surveyType.create({
      data: {
        id: newId('st'),
        organizationId: request.organizationId,
        name: name.trim(),
      },
    })
    return { surveyType: { id: row.id, name: row.name } }
  })

  app.patch('/api/platform/survey-types/:id', { preHandler: adminOnly }, async (request, reply) => {
    const { name } = request.body ?? {}
    if (!name?.trim()) return reply.code(400).send({ error: 'Name is required' })

    const existing = await app.prisma.surveyType.findFirst({
      where: { id: request.params.id, organizationId: request.organizationId },
    })
    if (!existing) return reply.code(404).send({ error: 'Survey type not found' })

    const row = await app.prisma.surveyType.update({
      where: { id: existing.id },
      data: { name: name.trim() },
    })
    return { surveyType: { id: row.id, name: row.name } }
  })

  app.delete('/api/platform/survey-types/:id', { preHandler: adminOnly }, async (request, reply) => {
    const existing = await app.prisma.surveyType.findFirst({
      where: { id: request.params.id, organizationId: request.organizationId },
    })
    if (!existing) return reply.code(404).send({ error: 'Survey type not found' })

    await app.prisma.surveyType.delete({ where: { id: existing.id } })
    return { ok: true }
  })

  // ─── Users (admin only) ────────────────────────────────────────────────
  app.get('/api/platform/users', { preHandler: adminOnly }, async (request) => {
    const rows = await app.prisma.user.findMany({
      where: { organizationId: request.organizationId },
      orderBy: { name: 'asc' },
    })
    return { users: rows.map(userResponse) }
  })

  app.post('/api/platform/users', { preHandler: adminOnly }, async (request, reply) => {
    const { email, password, name, role = ROLES.EDITOR, productGrant = 'builder' } = request.body ?? {}
    if (!email?.trim() || !name?.trim() || !password) {
      return reply.code(400).send({ error: 'Email, name, and password are required.' })
    }
    if (password.length < 8) {
      return reply.code(400).send({ error: 'Password must be at least 8 characters.' })
    }
    if (!ROLE_VALUES.has(role) || role === ROLES.PLATFORM_OWNER) {
      return reply.code(400).send({ error: 'Invalid role.' })
    }
    const access = await resolveProductGrant(app.prisma, request.organizationId, productGrant)
    if (!access.ok) return reply.code(403).send({ error: access.error, code: access.code })

    const formatCheck = validateEmailFormat(email)
    if (!formatCheck.ok) return reply.code(400).send({ error: formatCheck.error })

    const emailCheck = await assertEmailAvailable(app.prisma, formatCheck.email)
    if (!emailCheck.ok) return reply.code(409).send({ error: emailCheck.error })

    const seatCheck = await assertCanAddUser(app.prisma, request.organizationId)
    if (!seatCheck.ok) {
      return reply.code(403).send({ error: seatCheck.error, code: seatCheck.code })
    }

    const username = await deriveUsernameForOrg(app.prisma, request.organizationId, emailCheck.email)

    const row = await app.prisma.user.create({
      data: {
        organizationId: request.organizationId,
        username,
        email:          emailCheck.email,
        passwordHash:   await hashPassword(password),
        name:           name.trim(),
        role,
        canUseBuilder:  access.canUseBuilder,
        canUsePanel:    access.canUsePanel,
      },
    })
    return {
      user: userResponse(row),
      temporaryPassword: password,
    }
  })

  app.patch('/api/platform/users/:id', { preHandler: adminOnly }, async (request, reply) => {
    const { name, username, password, role, avatarUrl, productGrant } = request.body ?? {}
    const existing = await app.prisma.user.findFirst({
      where: { id: request.params.id, organizationId: request.organizationId },
    })
    if (!existing) return reply.code(404).send({ error: 'User not found' })

    if (role && (!ROLE_VALUES.has(role) || role === ROLES.PLATFORM_OWNER)) {
      return reply.code(400).send({ error: 'Invalid role.' })
    }

    if (role && role !== existing.role && isAdminRole(existing.role)) {
      const admins = await countAdmins(app.prisma, request.organizationId)
      if (admins <= 1) {
        return reply.code(400).send({
          error: 'Cannot demote the last admin.',
          code: 'LAST_ADMIN',
        })
      }
    }

    const data = {}
    if (name?.trim()) data.name = name.trim()
    if (role) data.role = role

    if (username !== undefined) {
      const check = await assertUsernameAvailableInOrg(
        app.prisma,
        request.organizationId,
        username,
        { excludeUserId: existing.id },
      )
      if (!check.ok) return reply.code(409).send({ error: check.error })
      data.username = check.username
    }

    if (avatarUrl !== undefined) {
      if (avatarUrl === null || avatarUrl === '') {
        data.avatarUrl = null
      } else if (typeof avatarUrl === 'string' && avatarUrl.startsWith('data:image/')) {
        const base64 = avatarUrl.split(',')[1]
        const bytes = base64 ? Math.ceil((base64.length * 3) / 4) : 0
        if (bytes > 512 * 1024) {
          return reply.code(400).send({ error: 'Profile image must be 512 KB or smaller.' })
        }
        data.avatarUrl = avatarUrl
      } else {
        return reply.code(400).send({ error: 'Invalid profile image.' })
      }
    }

    if (productGrant !== undefined) {
      const access = await resolveProductGrant(app.prisma, request.organizationId, productGrant)
      if (!access.ok) return reply.code(403).send({ error: access.error, code: access.code })
      data.canUseBuilder = access.canUseBuilder
      data.canUsePanel = access.canUsePanel
    }

    if (password) {
      if (password.length < 8) {
        return reply.code(400).send({ error: 'Password must be at least 8 characters.' })
      }
      data.passwordHash = await hashPassword(password)
      data.tokenVersion = { increment: 1 }
    }

    const passwordChanged = Boolean(password)
    const row = passwordChanged
      ? await app.prisma.$transaction(async (tx) => {
          const updated = await tx.user.update({ where: { id: existing.id }, data })
          await revokeAllForUser(tx, existing.id)
          return updated
        })
      : await app.prisma.user.update({ where: { id: existing.id }, data })
    app.cache.invalidateUser(existing.id)
    if (role && role !== existing.role) {
      await appendAudit(app.prisma, {
        organizationId: request.organizationId,
        actorId: request.auth.userId,
        action: 'role.change',
        targetEntity: 'User',
        targetId: existing.id,
      })
    }
    const result = { user: userResponse(row) }
    if (password) result.temporaryPassword = password
    return result
  })

  app.delete('/api/platform/users/:id', { preHandler: adminOnly }, async (request, reply) => {
    const count = await app.prisma.user.count({
      where: { organizationId: request.organizationId },
    })
    if (count <= 1) {
      return reply.code(400).send({ error: 'Cannot delete the last user.' })
    }

    const existing = await app.prisma.user.findFirst({
      where: { id: request.params.id, organizationId: request.organizationId },
    })
    if (!existing) return reply.code(404).send({ error: 'User not found' })

    if (isAdminRole(existing.role)) {
      const admins = await countAdmins(app.prisma, request.organizationId)
      if (admins <= 1) {
        return reply.code(400).send({
          error: 'Cannot remove the last admin.',
          code: 'LAST_ADMIN',
        })
      }
    }

    const ownedSurveys = await app.prisma.survey.count({
      where: { organizationId: request.organizationId, createdById: existing.id },
    })
    if (ownedSurveys > 0) {
      return reply.code(400).send({
        error: 'User owns surveys. Reassign or delete their surveys first.',
        code: 'USER_OWNS_SURVEYS',
      })
    }

    await app.prisma.user.delete({ where: { id: existing.id } })
    app.cache.invalidateUser(existing.id)
    return { ok: true }
  })
}
