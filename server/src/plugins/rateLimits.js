/**
 * Central rate-limit service.
 * Uses Redis when configured so limits are shared across API replicas, with a
 * bounded in-memory fallback if Redis becomes temporarily unavailable.
 */
import { createClient } from 'redis'
import { createRouteLimiters } from '../lib/survey/rateLimit.js'

const REDIS_CONNECT_TIMEOUT_MS = 3_000
const REDIS_WARNING_INTERVAL_MS = 30_000

function createRedisClient(url) {
  return createClient({
    url,
    disableOfflineQueue: true,
    socket: {
      connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
      reconnectStrategy: retries => Math.min(100 * (retries + 1), 3_000),
    },
  })
}

export async function registerRateLimits(app, config) {
  let redisClient = null
  let lastWarningAt = 0

  if (config.redisUrl) {
    redisClient = createRedisClient(config.redisUrl)
    redisClient.on('error', () => {
      // Request-time failures are reported by the throttled fallback callback.
    })

    try {
      await redisClient.connect()
      app.log.info('Distributed rate limiting connected to Redis')
    } catch (error) {
      redisClient.destroy()
      redisClient = null
      if (config.rateLimitRedisRequired) {
        throw new Error(`Required Redis rate-limit store is unavailable: ${error.message}`)
      }
      app.log.warn('Redis unavailable at startup; using in-memory rate limiting')
    }
  }

  const onRedisError = (error) => {
    const now = Date.now()
    if (now - lastWarningAt < REDIS_WARNING_INTERVAL_MS) return
    lastWarningAt = now
    app.log.warn(
      { err: error },
      'Redis rate-limit operation failed; using in-memory fallback',
    )
  }

  app.decorate('redis', redisClient)
  app.decorate('rateLimits', createRouteLimiters({
    relaxed: config.rateLimitRelaxed,
    disabled: config.rateLimitDisabled,
    redisClient,
    onRedisError,
  }))

  app.addHook('onClose', async () => {
    if (redisClient?.isOpen) await redisClient.quit()
  })
}
