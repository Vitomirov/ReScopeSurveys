/**
 * Rate-limit policies shared by auth and survey routes.
 * Production can use Redis for cross-process counters; development and Redis
 * outages retain a bounded in-memory fallback.
 */
import { createHash } from 'node:crypto'

const buckets = new Map()
const RELAXED_FACTOR = 100
const MAX_BUCKETS = 20_000
const SWEEP_MS = 30_000
const MINUTE_MS = 60_000
const REDIS_KEY_PREFIX = 'rescope:rate-limit:'

const INCREMENT_SCRIPT = `
  local count = redis.call('INCR', KEYS[1])
  if count == 1 then
    redis.call('PEXPIRE', KEYS[1], ARGV[1])
  end
  local ttl = redis.call('PTTL', KEYS[1])
  return { count, ttl }
`

let sweepTimer = null

function ensureSweep() {
  if (sweepTimer) return
  sweepTimer = setInterval(() => pruneExpiredRateLimitBuckets(), SWEEP_MS)
  if (typeof sweepTimer.unref === 'function') sweepTimer.unref()
}

export function pruneExpiredRateLimitBuckets(now = Date.now()) {
  for (const [key, entry] of buckets) {
    if (now - entry.start >= entry.windowMs) buckets.delete(key)
  }
}

export function rateLimitBucketCount() {
  return buckets.size
}

function setBucket(key, entry) {
  if (buckets.size >= MAX_BUCKETS && !buckets.has(key)) {
    pruneExpiredRateLimitBuckets(entry.start)
    if (buckets.size >= MAX_BUCKETS) {
      const oldest = buckets.keys().next().value
      if (oldest !== undefined) buckets.delete(oldest)
    }
  }
  buckets.set(key, entry)
}

export function createRateLimiter({ windowMs = 60_000, max = 60 } = {}) {
  ensureSweep()
  return function rateLimit(key) {
    const now = Date.now()
    const entry = buckets.get(key)
    if (!entry || now - entry.start >= windowMs) {
      setBucket(key, { start: now, count: 1, windowMs })
      return {
        allowed: true,
        limit: max,
        remaining: max - 1,
        resetMs: windowMs,
      }
    }
    entry.count += 1
    const resetMs = Math.max(1, windowMs - (now - entry.start))
    if (entry.count > max) {
      return { allowed: false, limit: max, remaining: 0, resetMs }
    }
    return {
      allowed: true,
      limit: max,
      remaining: max - entry.count,
      resetMs,
    }
  }
}

export function createRedisRateLimiter(
  redisClient,
  { windowMs = MINUTE_MS, max = 60, onError } = {},
) {
  const fallback = createRateLimiter({ windowMs, max })

  return async function rateLimit(key) {
    try {
      const digest = createHash('sha256').update(key).digest('hex')
      const result = await redisClient.eval(INCREMENT_SCRIPT, {
        keys: [`${REDIS_KEY_PREFIX}${digest}`],
        arguments: [String(windowMs)],
      })
      const count = Number(result?.[0]) || 1
      const resetMs = Math.max(1, Number(result?.[1]) || windowMs)
      return {
        allowed: count <= max,
        limit: max,
        remaining: Math.max(0, max - count),
        resetMs,
      }
    } catch (error) {
      onError?.(error)
      return fallback(key)
    }
  }
}

/** Client IP from the socket / trusted proxy. Never read X-Forwarded-For here. */
export function clientIp(request) {
  return request.ip || 'unknown'
}

export function opaqueRateLimitKey(value) {
  return createHash('sha256')
    .update(String(value || '').trim().toLowerCase())
    .digest('hex')
}

function noLimit() {
  return {
    allowed: true,
    limit: Number.MAX_SAFE_INTEGER,
    remaining: Number.MAX_SAFE_INTEGER,
    resetMs: MINUTE_MS,
  }
}

export function createRouteLimiters({
  relaxed = false,
  disabled = false,
  redisClient = null,
  onRedisError,
} = {}) {
  const factor = relaxed ? RELAXED_FACTOR : 1
  const create = (options) => {
    if (disabled) return noLimit
    if (redisClient) {
      return createRedisRateLimiter(redisClient, { ...options, onError: onRedisError })
    }
    return createRateLimiter(options)
  }

  return {
    login: create({ windowMs: MINUTE_MS, max: 10 * factor }),
    loginGlobal: create({ windowMs: MINUTE_MS, max: 300 * factor }),
    loginAccount: create({ windowMs: 15 * MINUTE_MS, max: 30 * factor }),
    signup: create({ windowMs: MINUTE_MS, max: 10 * factor }),
    signupGlobal: create({ windowMs: MINUTE_MS, max: 60 * factor }),
    refresh: create({ windowMs: MINUTE_MS, max: 30 * factor }),
    refreshGlobal: create({ windowMs: MINUTE_MS, max: 1_000 * factor }),
    // Account lifecycle: emails that leave the system (forgot password, resend verification).
    recovery: create({ windowMs: 15 * MINUTE_MS, max: 5 * factor }),
    recoveryGlobal: create({ windowMs: MINUTE_MS, max: 200 * factor }),
    // One-time link redemption (accept invite, reset password, verify email).
    tokenExchange: create({ windowMs: MINUTE_MS, max: 20 * factor }),
    tokenExchangeGlobal: create({ windowMs: MINUTE_MS, max: 500 * factor }),
    invite: create({ windowMs: MINUTE_MS, max: 30 * factor }),
    inviteGlobal: create({ windowMs: MINUTE_MS, max: 300 * factor }),
    publicFetch: create({ windowMs: MINUTE_MS, max: 60 * factor }),
    surveyFetch: create({ windowMs: MINUTE_MS, max: 600 * factor }),
    dnc: create({ windowMs: MINUTE_MS, max: 20 * factor }),
    surveyDnc: create({ windowMs: MINUTE_MS, max: 120 * factor }),
    responses: create({ windowMs: MINUTE_MS, max: 30 * factor }),
    surveyResponses: create({ windowMs: MINUTE_MS, max: 300 * factor }),
    caddyAsk: create({ windowMs: MINUTE_MS, max: 60 * factor }),
    importWebhook: create({ windowMs: MINUTE_MS, max: 30 * factor }),
  }
}

function applyRateLimitHeaders(reply, limit) {
  const resetSeconds = Math.max(1, Math.ceil(limit.resetMs / 1000))
  reply.header('RateLimit-Limit', String(limit.limit))
  reply.header('RateLimit-Remaining', String(limit.remaining))
  reply.header('RateLimit-Reset', String(resetSeconds))
  return resetSeconds
}

export async function sendIfRateLimited(
  limiter,
  request,
  reply,
  key,
  { discriminator, includeIp = true } = {},
) {
  const parts = [key]
  if (includeIp) parts.push(clientIp(request))
  if (discriminator !== undefined && discriminator !== null) {
    parts.push(opaqueRateLimitKey(discriminator))
  }

  const limit = await limiter(parts.join(':'))
  const resetSeconds = applyRateLimitHeaders(reply, limit)
  if (!limit.allowed) {
    reply.header('Retry-After', String(resetSeconds))
    return reply.code(429).send({ error: 'Too many requests. Please try again later.' })
  }
  return null
}

/** Global (all clients) then per-IP limit for one auth scope. Returns the 429 reply or null. */
export async function enforceAuthLimits(request, reply, { ipLimiter, globalLimiter, scope }) {
  const globallyLimited = await sendIfRateLimited(
    globalLimiter,
    request,
    reply,
    `${scope}-global`,
    { includeIp: false },
  )
  if (globallyLimited) return globallyLimited

  return sendIfRateLimited(ipLimiter, request, reply, scope)
}
