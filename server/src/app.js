/**
 * Fastify application factory.
 * Registers CORS, cookies, Prisma, JWT auth, the global error handler, and
 * all API route modules. Exported as `buildApp()` for use by index.js and tests.
 */
import Fastify from 'fastify'
import cors from '@fastify/cors'
import cookie from '@fastify/cookie'
import { registerPrisma } from './plugins/prisma.js'
import { registerHotCache } from './plugins/hotCache.js'
import { registerRateLimits } from './plugins/rateLimits.js'
import { registerCsrf } from './plugins/csrf.js'
import { registerAuth } from './plugins/auth.js'
import { registerMailer } from './plugins/mailer.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerInviteRoutes } from './routes/invites.js'
import { registerPanelOauthRoutes } from './routes/panelOauth.js'
import { registerPasswordResetRoutes } from './routes/passwordReset.js'
import { registerEmailVerificationRoutes } from './routes/emailVerification.js'
import { registerDevMailboxRoutes } from './routes/devMailbox.js'
import { registerPublicRoutes } from './routes/public.js'
import { registerSurveyRoutes } from './routes/surveys.js'
import { registerExportRoutes } from './routes/exports.js'
import { registerNotificationRoutes } from './routes/notifications.js'
import { registerDashboardRoutes } from './routes/dashboard.js'
import { registerResponseRoutes } from './routes/responses.js'
import { registerMigrateRoutes } from './routes/migrate.js'
import { registerPlatformRoutes } from './routes/platform.js'
import { registerDncRoutes } from './routes/dnc.js'
import { registerAdminRoutes } from './routes/admin.js'
import { registerBillingRoutes, registerVendorRoutes } from './routes/billing.js'
import { registerInternalRoutes } from './routes/internal.js'
import { loadConfig } from './config.js'
import { publicErrorResponse } from './lib/httpErrors.js'

const BODY_LIMIT_BYTES = 2 * 1024 * 1024

export async function buildApp() {
  const config = loadConfig()

  const app = Fastify({
    logger: true,
    // nginx is the only hop in front of this process (Caddy terminates TLS
    // on the host). Do not trust client-supplied forwarded headers beyond that.
    trustProxy: 1,
    bodyLimit: BODY_LIMIT_BYTES,
  })

  app.setErrorHandler((error, request, reply) => {
    request.log.error(error)
    const { status, body } = publicErrorResponse(error, { isDev: config.isDev })
    return reply.code(status).send(body)
  })

  await app.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
  })
  await app.register(cookie)

  await registerPrisma(app)
  await registerHotCache(app)
  await registerRateLimits(app, config)
  await registerMailer(app, config)
  await registerCsrf(app, config)
  await registerAuth(app, {
    jwtSecret: config.jwtSecret,
    jwtExpiresIn: config.accessTokenExpiresIn,
    authAllowBearer: config.authAllowBearer,
  })

  app.get('/health', async (request, reply) => {
    try {
      await app.prisma.$queryRaw`SELECT 1`
      return {
        ok: true,
        service: 'rescopesurveys-api',
        timestamp: new Date().toISOString(),
      }
    } catch (err) {
      request.log.error(err)
      return reply.code(503).send({
        ok: false,
        service: 'rescopesurveys-api',
      })
    }
  })

  await registerAuthRoutes(app)
  await registerInviteRoutes(app)
  await registerPanelOauthRoutes(app)
  await registerPasswordResetRoutes(app)
  await registerEmailVerificationRoutes(app)
  await registerPublicRoutes(app)
  await registerDashboardRoutes(app)
  await registerNotificationRoutes(app)
  await registerSurveyRoutes(app)
  await registerExportRoutes(app)
  await registerResponseRoutes(app)
  await registerPlatformRoutes(app)
  await registerAdminRoutes(app)
  await registerBillingRoutes(app)
  await registerVendorRoutes(app)
  await registerInternalRoutes(app)
  await registerDncRoutes(app)
  await registerMigrateRoutes(app, { isDev: config.isDev })
  await registerDevMailboxRoutes(app, config)

  return app
}
