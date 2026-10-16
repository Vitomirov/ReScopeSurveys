/**
 * Session issuance shared by every route that signs a user in
 * (login, signup, refresh, accept invite, password reset).
 * Builds the client-facing session object, signs the lean access JWT, and
 * sets the HttpOnly access/refresh cookies.
 */
import { setAuthCookies } from './cookies.js'
import { createRefreshToken } from './refreshTokens.js'
import { loadProductSession } from './productAccess.js'

export function buildSession(user, organizationName = null, product = {}) {
  return {
    userId:           user.id,
    organizationId:   user.organizationId,
    organizationName: organizationName,
    username:         user.username || user.email,
    name:             user.name || user.username || user.email,
    avatarUrl:        user.avatarUrl || null,
    role:             user.role,
    emailVerified:    Boolean(user.emailVerifiedAt),
    canUseBuilder:    product.canUseBuilder !== false,
    canUsePanel:      Boolean(product.canUsePanel),
    panelEnabled:     Boolean(product.panelEnabled),
    loginAt:          new Date().toISOString(),
  }
}

export function signToken(app, session, tokenVersion = 0) {
  // Keep JWT lean — never embed avatarUrl (base64 images blow up Authorization headers).
  return app.jwt.sign({
    userId:           session.userId,
    organizationId:   session.organizationId,
    organizationName: session.organizationName,
    username:         session.username,
    name:             session.name,
    role:             session.role,
    tv:               tokenVersion,
  })
}

export async function issueAuthSession(app, reply, user, organizationName = null) {
  const product = await loadProductSession(app.prisma, user)
  const session = buildSession(user, organizationName, product)
  const accessToken = signToken(app, session, user.tokenVersion ?? 0)
  const { rawToken } = await createRefreshToken(app.prisma, user.id)
  setAuthCookies(reply, { accessToken, refreshToken: rawToken })
  return session
}
