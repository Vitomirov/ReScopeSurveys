/**
 * JWT authentication plugin.
 * Verifies access tokens from cookies (or Bearer header in dev), reloads the
 * live user row from the database, and attaches `request.auth` on protected
 * /api routes. Public auth and /api/public/* paths are excluded.
 */
import fastifyJwt from '@fastify/jwt'
import { ACCESS_COOKIE, REFRESH_COOKIE } from '../lib/auth/cookies.js'

const PUBLIC_EXACT = new Set([
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/logout',
  '/api/auth/refresh',
  // One-time-link flows: the emailed token is the credential.
  '/api/auth/invites/preview',
  '/api/auth/invites/accept',
  '/api/auth/password/forgot',
  '/api/auth/password/reset',
  '/api/auth/email/verify',
  // Panel login: the browser may not have a session yet, and the token
  // exchange is server-to-server with a client secret.
  '/api/oauth/authorize',
  '/api/oauth/token',
  '/api/oauth/org-surveys',
])
const PUBLIC_PREFIXES = ['/api/public/', '/api/internal/']

function isPublicRoute(url) {
  const path = url.split('?')[0]
  if (PUBLIC_EXACT.has(path)) return true
  return PUBLIC_PREFIXES.some(prefix => path.startsWith(prefix))
}

function authError(reply, { status = 401, error, code }) {
  return reply.code(status).send({ error, code })
}

function extractAccessToken(request, authAllowBearer) {
  const fromCookie = request.cookies?.[ACCESS_COOKIE]
  if (fromCookie) return fromCookie
  if (!authAllowBearer) return null
  const header = request.headers.authorization
  if (header?.startsWith('Bearer ')) return header.slice(7)
  return null
}

export async function registerAuth(app, { jwtSecret, jwtExpiresIn, authAllowBearer = false }) {
  await app.register(fastifyJwt, {
    secret: jwtSecret,
    sign: {
      algorithm: 'HS256',
      expiresIn: jwtExpiresIn,
    },
    verify: {
      algorithms: ['HS256'],
    },
  })

  app.addHook('onRequest', async (request, reply) => {
    if (!request.url.startsWith('/api')) return
    if (isPublicRoute(request.url)) return

    const token = extractAccessToken(request, authAllowBearer)
    if (!token) {
      // Access cookie expires with the JWT (~15m). The refresh cookie lasts
      // much longer — tell the client to rotate instead of treating this as logout.
      const hasRefresh = Boolean(request.cookies?.[REFRESH_COOKIE])
      return authError(reply, {
        error: hasRefresh ? 'Session expired. Please sign in again.' : 'Unauthorized',
        code: hasRefresh ? 'TOKEN_EXPIRED' : 'UNAUTHORIZED',
      })
    }

    try {
      await request.jwtVerify({
        verify: { extractToken: () => token },
      })
    } catch (err) {
      if (err.code === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED') {
        return authError(reply, {
          error: 'Session expired. Please sign in again.',
          code: 'TOKEN_EXPIRED',
        })
      }
      return authError(reply, {
        error: 'Unauthorized',
        code: 'UNAUTHORIZED',
      })
    }

    const payload = request.user
    // Reload role / tokenVersion from DB (cached a few seconds). Avatar is
    // not selected here — it can be a large data-URL and is only needed on /me.
    let user = app.cache.getUser(payload.userId)
    if (!user) {
      user = await app.cache.loadOnce(`user:${payload.userId}`, async () => {
        const hit = app.cache.getUser(payload.userId)
        if (hit) return hit
        const row = await app.prisma.user.findUnique({
          where: { id: payload.userId },
          select: {
            id: true,
            organizationId: true,
            role: true,
            username: true,
            email: true,
            name: true,
            tokenVersion: true,
            canUseBuilder: true,
            canUsePanel: true,
            organization: { select: { name: true } },
          },
        })
        if (row) app.cache.setUser(row.id, row)
        return row
      })
    }

    // Trust the live DB row, not the JWT snapshot — role changes, password
    // resets, and deletions take effect on the very next request (writes
    // invalidate this cache).
    if (!user || user.organizationId !== payload.organizationId) {
      return authError(reply, {
        error: 'Session is no longer valid. Please sign in again.',
        code: 'SESSION_INVALID',
      })
    }

    const tokenVersion = payload.tv ?? 0
    if (tokenVersion !== (user.tokenVersion ?? 0)) {
      return authError(reply, {
        error: 'Session is no longer valid. Please sign in again.',
        code: 'SESSION_INVALID',
      })
    }

    request.auth = {
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      canUseBuilder: user.canUseBuilder !== false,
      canUsePanel: Boolean(user.canUsePanel),
      user,
    }
    request.organizationId = user.organizationId
  })
}
