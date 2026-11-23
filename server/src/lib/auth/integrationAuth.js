/**
 * Integration API key preHandler for webhook + MCP routes.
 */
import { assertSurveyImportAllowed } from '../survey/assertSurveyImport.js'
import { extractIntegrationKey, verifyIntegrationKey } from './integrationApiKey.js'

export function buildIntegrationAuth(app) {
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
