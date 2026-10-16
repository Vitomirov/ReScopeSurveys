/**
 * Local authorization-code login for the panel.
 * The panel is a confidential client: PKCE plus a shared secret.
 * Disabled unless PANEL_OAUTH_CLIENT_ID, SECRET, and REDIRECT_URI are set.
 */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { ACCESS_COOKIE } from '../lib/auth/cookies.js'
import { assertPanelAllowed, hasPanelGrant } from '../lib/auth/productAccess.js'
import { hashToken } from '../lib/auth/refreshTokens.js'

const CODE_TTL_MS = 60_000

function oauthReady(config) {
  const { clientId, clientSecret, redirectUri } = config.panelOauth
  return Boolean(clientId && clientSecret && redirectUri)
}

function sameSecret(left, right) {
  const a = Buffer.from(String(left))
  const b = Buffer.from(String(right))
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

function s256(verifier) {
  return createHash('sha256').update(verifier).digest('base64url')
}

function denyRedirect(redirectUri, state) {
  const url = new URL(redirectUri)
  url.searchParams.set('error', 'access_denied')
  if (state) url.searchParams.set('state', state)
  return url.toString()
}

export async function registerPanelOauthRoutes(app) {
  app.get('/api/oauth/authorize', async (request, reply) => {
    if (!oauthReady(app.config)) {
      return reply.code(404).send({ error: 'Panel login is not configured.' })
    }

    const {
      response_type: responseType,
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: method,
    } = request.query ?? {}

    const expected = app.config.panelOauth
    if (clientId !== expected.clientId || redirectUri !== expected.redirectUri) {
      return reply.code(400).send({ error: 'Unknown panel client.' })
    }
    if (responseType !== 'code' || method !== 'S256' || !codeChallenge) {
      return reply.code(400).send({ error: 'PKCE S256 is required.' })
    }

    const token = request.cookies?.[ACCESS_COOKIE]
    if (!token) {
      return reply.redirect(`${app.config.appUrl}/#/login`)
    }

    let payload
    try {
      payload = await app.jwt.verify(token)
    } catch {
      return reply.redirect(`${app.config.appUrl}/#/login`)
    }

    const user = await app.prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        organizationId: true,
        role: true,
        canUsePanel: true,
        tokenVersion: true,
      },
    })
    const version = payload.tv ?? 0
    if (!user || user.organizationId !== payload.organizationId || version !== (user.tokenVersion ?? 0)) {
      return reply.redirect(`${app.config.appUrl}/#/login`)
    }

    if (!hasPanelGrant(user)) {
      return reply.redirect(denyRedirect(redirectUri, state))
    }
    const panel = await assertPanelAllowed(app.prisma, user.organizationId)
    if (!panel.ok) {
      return reply.redirect(denyRedirect(redirectUri, state))
    }

    const rawCode = randomBytes(32).toString('base64url')
    await app.prisma.panelOauthCode.create({
      data: {
        codeHash: hashToken(rawCode),
        userId: user.id,
        organizationId: user.organizationId,
        redirectUri,
        codeChallenge,
        expiresAt: new Date(Date.now() + CODE_TTL_MS),
      },
    })

    const back = new URL(redirectUri)
    back.searchParams.set('code', rawCode)
    if (state) back.searchParams.set('state', state)
    return reply.redirect(back.toString())
  })

  app.post('/api/oauth/token', async (request, reply) => {
    if (!oauthReady(app.config)) {
      return reply.code(404).send({ error: 'Panel login is not configured.' })
    }

    const {
      grant_type: grantType,
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: codeVerifier,
    } = request.body ?? {}

    const expected = app.config.panelOauth
    if (
      grantType !== 'authorization_code'
      || clientId !== expected.clientId
      || redirectUri !== expected.redirectUri
      || !sameSecret(clientSecret, expected.clientSecret)
      || !code
      || !codeVerifier
    ) {
      return reply.code(400).send({ error: 'Invalid panel login request.' })
    }

    const row = await app.prisma.panelOauthCode.findUnique({
      where: { codeHash: hashToken(code) },
    })
    if (!row || row.usedAt || row.expiresAt <= new Date() || row.redirectUri !== redirectUri) {
      return reply.code(400).send({ error: 'Invalid or expired code.' })
    }
    if (!sameSecret(s256(codeVerifier), row.codeChallenge)) {
      return reply.code(400).send({ error: 'Invalid code verifier.' })
    }

    const claimed = await app.prisma.panelOauthCode.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    })
    if (claimed.count !== 1) {
      return reply.code(400).send({ error: 'Invalid or expired code.' })
    }

    const user = await app.prisma.user.findUnique({
      where: { id: row.userId },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        organizationId: true,
        role: true,
        canUsePanel: true,
      },
    })
    if (
      !user
      || user.organizationId !== row.organizationId
      || !hasPanelGrant(user)
    ) {
      return reply.code(403).send({ error: 'Panel access denied.', code: 'PANEL_DENIED' })
    }
    const panel = await assertPanelAllowed(app.prisma, user.organizationId)
    if (!panel.ok) {
      return reply.code(403).send({ error: panel.error, code: panel.code })
    }

    return {
      sub: user.id,
      email: user.email,
      name: user.name || user.username || user.email,
      organizationId: user.organizationId,
    }
  })
}
