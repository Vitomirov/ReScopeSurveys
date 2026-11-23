/**
 * Remote MCP (Streamable HTTP) for Claude custom connectors.
 * Auth: same Enterprise integration API keys as the import webhook.
 */
import { createMcpHandler } from '@modelcontextprotocol/server'
import { toNodeHandler } from '@modelcontextprotocol/node'
import { buildIntegrationAuth } from '../lib/auth/integrationAuth.js'
import { buildRescopeMcpServer } from '../lib/mcp/buildRescopeMcpServer.js'

const MCP_PATH = '/api/integrations/v1/mcp'

export async function registerMcpRoutes(app) {
  const limiter = app.rateLimits?.importWebhook
  const integrationAuth = buildIntegrationAuth(app)

  app.route({
    method: ['GET', 'POST', 'DELETE'],
    url: MCP_PATH,
    preHandler: [
      integrationAuth,
      async function mcpRateLimit(request, reply) {
        if (!limiter) return
        const { sendIfRateLimited } = await import('../lib/survey/rateLimit.js')
        return sendIfRateLimited(
          limiter,
          request,
          reply,
          'import-webhook',
          { discriminator: request.integrationAuth.organizationId, includeIp: true },
        )
      },
    ],
    handler: async (request, reply) => {
      const auth = request.integrationAuth
      const appUrl = app.config?.appUrl || 'https://app.rescopesurveys.com'

      const handler = createMcpHandler(() => buildRescopeMcpServer({
        prisma: app.prisma,
        organizationId: auth.organizationId,
        createdById: auth.createdById,
        appUrl,
        cache: app.cache,
      }))
      const node = toNodeHandler(handler)

      reply.hijack()
      await node(request.raw, reply.raw, request.body)
    },
  })
}
