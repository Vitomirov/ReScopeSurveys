/**
 * Public (unauthenticated) survey taker routes.
 * Serves live survey definitions by public path or ID, DNC email checks,
 * accepts response submissions, and applies embed CSP headers and branding.
 */
import { sendUpsertResult } from './responses.js'
import { clientDomainFromRequest, findPublicSurvey } from '../lib/survey/surveyPublicPath.js'
import { buildPublicBrandingPayload } from '../lib/branding/publicBranding.js'
import { readEmbedAllowedOrigins } from '../lib/platform/orgSettings.js'
import { resolvePlanId } from '../../../shared/planFeatures.js'
import { buildFrameAncestorsDirective } from '../../../shared/embedProtocol.js'
import { sendIfRateLimited } from '../lib/survey/rateLimit.js'
import { countsSurveyWideFetch } from '../lib/survey/publicFetch.js'
import { isEmailOnDncList, normalizeEmail } from '../lib/survey/dncCheck.js'
import { assertOrgActive } from '../lib/billing/planEnforcement.js'
import {
  RESPONSE_WRITE_COOKIE,
  presentedKeyFor,
  rememberWriteKey,
} from '../lib/survey/responseWriteKey.js'

const LIVE_SURVEY_SELECT = {
  id: true,
  organizationId: true,
  survey: true,
  items: true,
  revision: true,
}

async function loadOrgBrandingContext(app, organizationId) {
  const cached = app.cache.getOrgBranding(organizationId)
  if (cached) return cached

  return app.cache.loadOnce(`org:${organizationId}`, async () => {
    const hit = app.cache.getOrgBranding(organizationId)
    if (hit) return hit
    const [org, subscription] = await Promise.all([
      app.prisma.organization.findUnique({
        where: { id: organizationId },
        select: { settings: true },
      }),
      app.prisma.subscription.findUnique({
        where: { organizationId },
        select: { planId: true },
      }),
    ])
    const value = {
      settings: org?.settings,
      planId: resolvePlanId(subscription?.planId),
    }
    app.cache.setOrgBranding(organizationId, value)
    return value
  })
}

function applyEmbedSecurityHeaders(reply, { isEmbed, embedOrigins }) {
  // Non-embed taker must not be iframed (clickjacking). Embed mode uses the org allowlist.
  const directive = isEmbed ? buildFrameAncestorsDirective(embedOrigins) : "'none'"
  reply.header('Content-Security-Policy', `frame-ancestors ${directive}`)
}

function publicSurveyPayload(row, branding, { embedOrigins = [] } = {}) {
  return {
    survey: row.survey,
    items:  row.items,
    branding: {
      ...branding,
      embedAllowedOrigins: embedOrigins,
    },
  }
}

function surveyIsClosed(row) {
  return row?.survey?.status === 'closed'
}

function liveCached(row) {
  return row?.survey?.status === 'live' ? row : null
}

function slimPublicRow(row) {
  return {
    id: row.id,
    organizationId: row.organizationId,
    survey: row.survey,
    items: row.items,
    revision: row.revision,
  }
}

function setWriteCookie(app, request, reply, responseId, issuedWriteKey) {
  if (!issuedWriteKey || !responseId) return
  const { cookieSecure } = app.config
  reply.setCookie(
    RESPONSE_WRITE_COOKIE,
    rememberWriteKey(request.cookies?.[RESPONSE_WRITE_COOKIE], responseId, issuedWriteKey),
    {
      httpOnly: true,
      secure: cookieSecure,
      sameSite: 'lax',
      path: '/api/public/surveys/',
      maxAge: 60 * 60 * 24 * 30,
    },
  )
}

async function ensurePublicOrgActive(app, organizationId, reply) {
  const active = await assertOrgActive(app.prisma, organizationId, { provision: false })
  if (active.ok) return true
  reply.code(404).send({ error: 'Survey not found' })
  return false
}

async function loadLivePublicSurvey(app, id, reply) {
  const cached = app.cache.getLiveSurvey(id)
  if (cached) {
    if (!(await ensurePublicOrgActive(app, cached.organizationId, reply))) return null
    return cached
  }

  const row = await app.cache.loadOnce(`survey:${id}`, async () => {
    const hit = app.cache.getLiveSurvey(id)
    if (hit) return hit
    const loaded = await app.prisma.survey.findUnique({
      where: { id },
      select: {
        ...LIVE_SURVEY_SELECT,
        organization: {
          select: {
            settings: true,
            subscription: { select: { planId: true } },
          },
        },
      },
    })
    if (loaded?.organization) {
      app.cache.setOrgBranding(loaded.organizationId, {
        settings: loaded.organization.settings,
        planId: resolvePlanId(loaded.organization.subscription?.planId),
      })
    }
    const row = loaded
      ? {
        id: loaded.id,
        organizationId: loaded.organizationId,
        survey: loaded.survey,
        items: loaded.items,
        revision: loaded.revision,
      }
      : null
    if (row?.survey?.status === 'live') app.cache.setLiveSurvey(id, row)
    return row
  })
  if (!row) {
    reply.code(404).send({ error: 'Survey not found' })
    return null
  }
  if (!(await ensurePublicOrgActive(app, row.organizationId, reply))) return null
  return row
}

async function sendPublicSurvey(app, request, reply, row) {
  const isEmbed = request.query?.embed === '1' || request.query?.embed === 'true'
  const { settings, planId } = await loadOrgBrandingContext(app, row.organizationId)
  const branding = buildPublicBrandingPayload(settings, row.survey, planId)
  const embedOrigins = readEmbedAllowedOrigins(settings)
  applyEmbedSecurityHeaders(reply, { isEmbed, embedOrigins })
  return publicSurveyPayload(row, branding, { embedOrigins: isEmbed ? embedOrigins : [] })
}

async function enforcePublicLimits(
  request,
  reply,
  { ipLimiter, resourceLimiter, scope, resourceId },
) {
  const resourceLimited = await sendIfRateLimited(
    resourceLimiter,
    request,
    reply,
    `${scope}-resource`,
    { discriminator: resourceId, includeIp: false },
  )
  if (resourceLimited) return resourceLimited

  return sendIfRateLimited(ipLimiter, request, reply, scope)
}

export async function registerPublicRoutes(app) {
  const limits = app.rateLimits

  async function limitPublicRead(request, reply, { cacheHit, resourceId }) {
    if (countsSurveyWideFetch(cacheHit)) {
      return enforcePublicLimits(request, reply, {
        ipLimiter: limits.publicFetch,
        resourceLimiter: limits.surveyFetch,
        scope: 'public-fetch',
        resourceId,
      })
    }
    return sendIfRateLimited(limits.publicFetch, request, reply, 'public-fetch')
  }

  app.get('/api/public/s/:publicPath', async (request, reply) => {
    const clientDomain = clientDomainFromRequest(request)
    const cached = liveCached(app.cache.getPublicPath(clientDomain, request.params.publicPath))
    const limited = await limitPublicRead(request, reply, {
      cacheHit: Boolean(cached),
      resourceId: request.params.publicPath,
    })
    if (limited) return limited
    if (cached) return sendPublicSurvey(app, request, reply, cached)

    const row = await findPublicSurvey(app.prisma, request.params.publicPath, clientDomain)
    if (!row) return reply.code(404).send({ error: 'Survey not found' })
    if (!(await ensurePublicOrgActive(app, row.organizationId, reply))) return

    const slim = slimPublicRow(row)
    if (slim.survey?.status === 'live') {
      app.cache.setLiveSurvey(slim.id, slim)
      app.cache.setPublicPath(clientDomain, request.params.publicPath, slim)
    }
    return sendPublicSurvey(app, request, reply, slim)
  })

  app.get('/api/public/surveys/:id', async (request, reply) => {
    const cached = liveCached(app.cache.getLiveSurvey(request.params.id))
    const limited = await limitPublicRead(request, reply, {
      cacheHit: Boolean(cached),
      resourceId: request.params.id,
    })
    if (limited) return limited
    if (cached) return sendPublicSurvey(app, request, reply, cached)

    const row = await loadLivePublicSurvey(app, request.params.id, reply)
    if (!row) return

    return sendPublicSurvey(app, request, reply, row)
  })

  app.post('/api/public/surveys/:id/dnc/check', async (request, reply) => {
    const limited = await enforcePublicLimits(request, reply, {
      ipLimiter: limits.dnc,
      resourceLimiter: limits.surveyDnc,
      scope: 'public-dnc',
      resourceId: request.params.id,
    })
    if (limited) return limited

    const row = await loadLivePublicSurvey(app, request.params.id, reply)
    if (!row) return
    if (surveyIsClosed(row)) return reply.code(404).send({ error: 'Survey not found' })

    const email = normalizeEmail(request.body?.email)
    if (!email || !email.includes('@')) {
      return reply.code(400).send({ error: 'Body must include a valid email' })
    }

    const onList = await isEmailOnDncList(app.prisma, row.id, email)
    return { onList }
  })

  app.post('/api/public/surveys/:id/responses', async (request, reply) => {
    const limited = await sendIfRateLimited(limits.responses, request, reply, 'responses')
    if (limited) return limited

    const row = await loadLivePublicSurvey(app, request.params.id, reply)
    if (!row) return
    if (surveyIsClosed(row)) return reply.code(404).send({ error: 'Survey not found' })

    const entry = request.body
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      return reply.code(400).send({ error: 'Response entry is required' })
    }

    const bodyId = typeof entry.id === 'string' ? entry.id.trim() : ''
    const outcome = await app.responseInbox.savePublic({
      surveyId: row.id,
      organizationId: row.organizationId,
      entry,
      surveyItems: row.items || [],
      presentedKey: presentedKeyFor(request.cookies?.[RESPONSE_WRITE_COOKIE], bodyId),
    })

    if (outcome.queued) {
      setWriteCookie(app, request, reply, outcome.id, outcome.issuedWriteKey)
      return reply.code(202).send({ ok: true, accepted: true, id: outcome.id })
    }

    const result = outcome.result
    if (sendUpsertResult(reply, result)) return
    setWriteCookie(app, request, reply, result.row.id, result.issuedWriteKey)
    return { ok: true, id: result.row.id }
  })
}
