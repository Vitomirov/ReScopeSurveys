/**
 * Enterprise integration API keys (admin) and webhook import route.
 */
import { requireRole } from '../lib/auth/authz.js'
import { ROLES } from '../lib/auth/roles.js'
import { assertSurveyImportAllowed } from '../lib/survey/assertSurveyImport.js'
import { generateIntegrationKey } from '../lib/auth/integrationApiKey.js'
import { buildIntegrationAuth } from '../lib/auth/integrationAuth.js'
import { createSurveyFromIntegration } from '../lib/survey/import/createFromIntegration.js'

const adminOnly = requireRole(ROLES.ADMIN)

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

    const headerIdempotency = request.headers['idempotency-key']
    const result = await createSurveyFromIntegration(
      app.prisma,
      {
        organizationId: request.integrationAuth.organizationId,
        createdById: request.integrationAuth.createdById,
      },
      request.body,
      {
        source: 'webhook',
        // Prefer body.externalId (via helper); header fills in when body omits it.
        ...(headerIdempotency ? { externalIdFallback: String(headerIdempotency) } : {}),
        cache: app.cache,
      },
    )

    if (!result.ok) {
      return reply.code(result.httpStatus || 422).send({
        ok: false,
        ...(result.error ? { error: result.error } : {}),
        errors: result.errors,
      })
    }

    return reply.code(result.httpStatus || 201).send({
      ok: true,
      surveyId: result.surveyId,
      revision: result.revision,
      publicPath: result.publicPath,
      status: result.status || 'pending_review',
      warnings: result.warnings,
      ...(result.idempotent ? { idempotent: true } : {}),
    })
  })
}
