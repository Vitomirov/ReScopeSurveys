/**
 * Enterprise integration API keys (admin) and webhook import route.
 */
import { requireRole } from '../lib/auth/authz.js'
import { ROLES } from '../lib/auth/roles.js'
import { assertSurveyImportAllowed } from '../lib/survey/assertSurveyImport.js'
import {
  extractIntegrationKey,
  generateIntegrationKey,
  verifyIntegrationKey,
} from '../lib/auth/integrationApiKey.js'
import { runImport } from '../lib/survey/import/importEngine.js'
import {
  importPayloadSchema,
  formatZodErrors,
  normalizeImportPayload,
  importValidationSummary,
} from '../lib/survey/import/schema.js'
import { randomUUID } from 'node:crypto'

const adminOnly = requireRole(ROLES.ADMIN)

function buildIntegrationAuth(app) {
  return async function integrationAuth(request, reply) {
    const raw = extractIntegrationKey(request)
    const row = await verifyIntegrationKey(app.prisma, raw)
    if (!row) {
      return reply.code(401).send({ error: 'Invalid API key', code: 'INVALID_API_KEY' })
    }
    const gate = await assertSurveyImportAllowed(app.prisma, row.organizationId)
    if (!gate.ok) {
      return reply.code(403).send({ error: gate.error, code: gate.code })
    }
    request.integrationAuth = {
      organizationId: row.organizationId,
      keyId: row.id,
      createdById: row.createdById,
    }
    await app.prisma.organizationIntegrationKey.update({
      where: { id: row.id },
      data: { lastUsedAt: new Date() },
    })
  }
}

export async function registerIntegrationKeyRoutes(app) {
  app.get('/api/platform/integration-keys', { preHandler: adminOnly }, async (request) => {
    const gate = await assertSurveyImportAllowed(app.prisma, request.organizationId)
    if (!gate.ok) return { keys: [] }

    const keys = await app.prisma.organizationIntegrationKey.findMany({
      where: { organizationId: request.organizationId, revokedAt: null },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        createdAt: true,
        lastUsedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })
    return { keys }
  })

  app.post('/api/platform/integration-keys', { preHandler: adminOnly }, async (request, reply) => {
    const gate = await assertSurveyImportAllowed(app.prisma, request.organizationId)
    if (!gate.ok) return reply.code(403).send({ error: gate.error, code: gate.code })

    const name = String(request.body?.name || 'Import key').trim().slice(0, 120)
    const { raw, prefix, keyHash } = generateIntegrationKey()

    const created = await app.prisma.organizationIntegrationKey.create({
      data: {
        organizationId: request.organizationId,
        name,
        keyPrefix: prefix,
        keyHash,
        createdById: request.auth.userId,
      },
    })

    return reply.code(201).send({
      id: created.id,
      name: created.name,
      keyPrefix: created.keyPrefix,
      apiKey: raw,
    })
  })

  app.delete('/api/platform/integration-keys/:id', { preHandler: adminOnly }, async (request, reply) => {
    const row = await app.prisma.organizationIntegrationKey.findFirst({
      where: { id: request.params.id, organizationId: request.organizationId },
    })
    if (!row) return reply.code(404).send({ error: 'Key not found' })
    await app.prisma.organizationIntegrationKey.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    })
    return { ok: true }
  })
}

export async function registerIntegrationWebhookRoutes(app) {
  const limiter = app.rateLimits?.importWebhook
  const integrationAuth = buildIntegrationAuth(app)

  app.post('/api/integrations/v1/surveys/import', {
    preHandler: integrationAuth,
  }, async (request, reply) => {
    if (limiter) {
      const { sendIfRateLimited } = await import('../lib/survey/rateLimit.js')
      const limited = await sendIfRateLimited(
        limiter,
        request,
        reply,
        'import-webhook',
        { discriminator: request.integrationAuth.organizationId, includeIp: true },
      )
      if (limited) return limited
    }

    const parsed = importPayloadSchema.safeParse(normalizeImportPayload(request.body))
    if (!parsed.success) {
      const errors = formatZodErrors(parsed.error)
      return reply.code(422).send({ ok: false, error: importValidationSummary(errors), errors })
    }

    const externalId = parsed.data.externalId
      || request.headers['idempotency-key']
      || null

    const orgId = request.integrationAuth.organizationId
    if (externalId) {
      const prior = await app.prisma.surveyImport.findFirst({
        where: { organizationId: orgId, externalId, status: 'succeeded' },
      })
      if (prior?.surveyId) {
        return reply.code(200).send({
          ok: true,
          surveyId: prior.surveyId,
          status: 'pending_review',
          idempotent: true,
        })
      }
    }

    const importId = randomUUID()
    const result = await runImport(
      app.prisma,
      {
        organizationId: orgId,
        userId: request.integrationAuth.createdById,
        surveyScope: {},
      },
      parsed.data,
      { source: 'webhook', mode: 'create', externalId },
      { cache: app.cache },
    )

    if (!result.ok) {
      await app.prisma.surveyImport.create({
        data: {
          id: importId,
          organizationId: orgId,
          source: 'webhook',
          status: 'failed',
          externalId,
          errorReport: result.errors,
          createdById: request.integrationAuth.createdById,
        },
      }).catch(() => {})
      return reply.code(result.status || result.httpStatus || 422).send({ ok: false, errors: result.errors })
    }

    await app.prisma.surveyImport.create({
      data: {
        id: importId,
        organizationId: orgId,
        surveyId: result.surveyId,
        source: 'webhook',
        status: 'succeeded',
        externalId,
        createdById: request.integrationAuth.createdById,
      },
    }).catch(() => {})

    return reply.code(result.httpStatus || 201).send({
      ok: true,
      surveyId: result.surveyId,
      revision: result.revision,
      publicPath: result.publicPath,
      status: result.surveyStatus || 'pending_review',
      warnings: result.warnings,
    })
  })
}