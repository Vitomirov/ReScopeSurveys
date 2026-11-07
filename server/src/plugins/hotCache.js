/**
 * In-process caches for the live-survey and author read paths.
 *
 * TTLs bound staleness if a write forgets to invalidate. Writes that change
 * authorization, survey definition, or org branding always invalidate.
 * Response stats / dashboard aggregates use TTL only — a second of lag is
 * accepted so GROUP BY does not run on every concurrent author poll.
 */
import { createTtlCache } from '../lib/cache/ttlCache.js'

const LIVE_SURVEY_TTL_MS = 5_000
const ORG_BRANDING_TTL_MS = 5_000
const USER_TTL_MS = 2_000
const STATS_TTL_MS = 1_500
const DASHBOARD_TTL_MS = 1_500

export function publicPathCacheKey(clientDomain, publicPath) {
  return `${clientDomain || ''}\n${publicPath}`
}

function track(index, id, key) {
  if (!id) return
  let keys = index.get(id)
  if (!keys) {
    keys = new Set()
    index.set(id, keys)
  }
  keys.add(key)
}

function dropIndexed(index, id, cache) {
  const keys = index.get(id)
  if (!keys) return
  for (const key of keys) cache.del(key)
  index.delete(id)
}

export function createHotCache() {
  const liveSurveys = createTtlCache({ max: 2_000, ttlMs: LIVE_SURVEY_TTL_MS })
  const publicPaths = createTtlCache({ max: 2_000, ttlMs: LIVE_SURVEY_TTL_MS })
  const orgBranding = createTtlCache({ max: 1_000, ttlMs: ORG_BRANDING_TTL_MS })
  const users = createTtlCache({ max: 4_000, ttlMs: USER_TTL_MS })
  const stats = createTtlCache({ max: 4_000, ttlMs: STATS_TTL_MS })
  const dashboards = createTtlCache({ max: 2_000, ttlMs: DASHBOARD_TTL_MS })
  const pathKeysBySurvey = new Map()
  const pathKeysByOrg = new Map()
  const inflight = new Map()

  function loadOnce(key, fn) {
    const existing = inflight.get(key)
    if (existing) return existing
    const promise = Promise.resolve().then(fn).finally(() => inflight.delete(key))
    inflight.set(key, promise)
    return promise
  }

  return {
    getLiveSurvey: (id) => liveSurveys.get(id),
    setLiveSurvey: (id, row) => liveSurveys.set(id, row),

    getPublicPath(clientDomain, publicPath) {
      return publicPaths.get(publicPathCacheKey(clientDomain, publicPath))
    },
    setPublicPath(clientDomain, publicPath, row) {
      const key = publicPathCacheKey(clientDomain, publicPath)
      publicPaths.set(key, row)
      track(pathKeysBySurvey, row?.id, key)
      track(pathKeysByOrg, row?.organizationId, key)
    },

    getOrgBranding: (orgId) => orgBranding.get(orgId),
    setOrgBranding: (orgId, value) => orgBranding.set(orgId, value),

    getUser: (id) => users.get(id),
    setUser: (id, value) => users.set(id, value),

    getStats: (surveyId) => stats.get(surveyId),
    setStats: (surveyId, value) => stats.set(surveyId, value),

    getDashboard: (orgId, userId) => dashboards.get(`${orgId}:${userId}`),
    setDashboard: (orgId, userId, value) => dashboards.set(`${orgId}:${userId}`, value),
    loadOnce,

    invalidateSurvey(id, organizationId) {
      liveSurveys.del(id)
      dropIndexed(pathKeysBySurvey, id, publicPaths)
      stats.del(id)
      if (organizationId) dashboards.delByPrefix(`${organizationId}:`)
    },

    invalidateOrg(orgId) {
      orgBranding.del(orgId)
      dropIndexed(pathKeysByOrg, orgId, publicPaths)
      dashboards.delByPrefix(`${orgId}:`)
    },

    invalidateUser(id) {
      users.del(id)
    },
  }
}

export async function registerHotCache(app) {
  app.decorate('cache', createHotCache())
}
