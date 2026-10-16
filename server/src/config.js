/**
 * Environment configuration loader.
 * Parses process.env into a typed config object (port, JWT, CORS, cookie flags,
 * dev toggles) and validates JWT secrets when required for production.
 */
const DEFAULT_PORT = 3003
const DEFAULT_ACCESS_TOKEN_EXPIRES_IN = '15m'
const DEFAULT_REFRESH_TOKEN_EXPIRES_IN = '30d'
const DEFAULT_DEV_CORS_ORIGIN = 'http://localhost:5173'
const DEFAULT_DEV_APP_URL = 'http://localhost:5173'
const DEFAULT_PROD_APP_URL = 'https://app.rescopesurveys.com'
const DEFAULT_EMAIL_FROM = 'Rescope Surveys <no-reply@rescopesurveys.com>'
const EMAIL_TRANSPORTS = new Set(['smtp', 'log'])
const MIN_JWT_SECRET_LENGTH = 32

const UNIT_MS = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }

const WEAK_JWT_SECRETS = new Set([
  'dev-secret-change-me',
  'change-me-in-production',
])

function parseBool(value, defaultValue) {
  if (value === undefined || value === '') return defaultValue
  const normalized = String(value).trim().toLowerCase()
  if (normalized === 'true' || normalized === '1') return true
  if (normalized === 'false' || normalized === '0') return false
  return defaultValue
}

function parseRedisUrl(value) {
  const raw = String(value || '').trim()
  if (!raw) return null
  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error('REDIS_URL must be a valid redis:// or rediss:// URL.')
  }
  if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
    throw new Error('REDIS_URL must use the redis:// or rediss:// protocol.')
  }
  return raw
}

export function durationToMs(value, fallbackMs) {
  const match = String(value ?? '').trim().match(/^(\d+)\s*(ms|s|m|h|d)$/i)
  if (!match) return fallbackMs
  return Number(match[1]) * UNIT_MS[match[2].toLowerCase()]
}

/**
 * Outbound email for account lifecycle links (invites, verification, resets).
 * Production must send real mail; `log` only prints links and is a dev/test aid.
 */
export function parseEmailConfig(env, { isDev }) {
  const transport = String(env.EMAIL_TRANSPORT || (isDev ? 'log' : 'smtp')).trim().toLowerCase()
  if (!EMAIL_TRANSPORTS.has(transport)) {
    throw new Error('EMAIL_TRANSPORT must be "smtp" or "log".')
  }
  const smtpUrl = String(env.SMTP_URL || '').trim()
  if (transport === 'smtp' && !smtpUrl) {
    throw new Error(
      'SMTP_URL is required when EMAIL_TRANSPORT=smtp '
      + '(e.g. smtps://user:pass@smtp.example.com:465). Use EMAIL_TRANSPORT=log for local development only.',
    )
  }
  const appUrl = String(env.APP_URL || (isDev ? DEFAULT_DEV_APP_URL : DEFAULT_PROD_APP_URL))
    .trim()
    .replace(/\/+$/, '')
  try {
    new URL(appUrl)
  } catch {
    throw new Error('APP_URL must be an absolute URL (e.g. https://app.rescopesurveys.com).')
  }
  return {
    emailTransport: transport,
    smtpUrl: smtpUrl || null,
    emailFrom: String(env.EMAIL_FROM || DEFAULT_EMAIL_FROM).trim(),
    appUrl,
  }
}

const CORS_WILDCARDS = new Set(['true', '*', 'reflect'])

/**
 * Explicit origin allowlist. Rejects missing values in production and never
 * accepts a wildcard / reflect-any setting (unsafe with credentialed cookies).
 */
export function parseCorsOrigin(raw, { isDev } = {}) {
  const value = String(raw ?? '').trim()
  if (!value) {
    if (isDev) return DEFAULT_DEV_CORS_ORIGIN
    throw new Error(
      'CORS_ORIGIN is required in production. Set a comma-separated allowlist '
      + '(e.g. https://rescopesurveys.com,https://www.rescopesurveys.com).',
    )
  }

  const parts = value.split(',').map(part => part.trim()).filter(Boolean)
  if (!parts.length) {
    throw new Error('CORS_ORIGIN must list at least one origin.')
  }
  for (const origin of parts) {
    if (CORS_WILDCARDS.has(origin.toLowerCase())) {
      throw new Error(
        'CORS_ORIGIN must be an explicit origin allowlist, not a wildcard or "true".',
      )
    }
  }
  return parts.length === 1 ? parts[0] : parts
}

export function validateJwtSecret(secret, { minLength = MIN_JWT_SECRET_LENGTH } = {}) {
  if (!secret || typeof secret !== 'string' || !secret.trim()) {
    throw new Error(
      'JWT_SECRET is required. Set a strong random value (32+ characters).',
    )
  }
  if (WEAK_JWT_SECRETS.has(secret)) {
    throw new Error(
      'JWT_SECRET must not use a default or placeholder value.',
    )
  }
  if (secret.length < minLength) {
    throw new Error(
      `JWT_SECRET must be at least ${minLength} characters.`,
    )
  }
}

function validateStrictProductionFlags({
  isDev,
  requireStrongJwt,
  seedDefaultAccounts,
  runPlatformListMigration,
  rateLimitRelaxed,
  rateLimitDisabled,
  cookieSecure,
  authAllowBearer,
  internalApiSecret,
  emailTransport,
}) {
  if (isDev || !requireStrongJwt) return

  const unsafe = [
    seedDefaultAccounts && 'SEED_DEFAULT_ACCOUNTS',
    runPlatformListMigration && 'RUN_PLATFORM_LIST_MIGRATION',
    rateLimitRelaxed && 'RATE_LIMIT_RELAXED',
    rateLimitDisabled && 'RATE_LIMIT_DISABLED',
    !cookieSecure && 'COOKIE_SECURE',
    authAllowBearer && 'AUTH_ALLOW_BEARER',
    !internalApiSecret && 'INTERNAL_API_SECRET',
    emailTransport === 'log' && 'EMAIL_TRANSPORT',
  ].filter(Boolean)

  if (unsafe.length) {
    throw new Error(
      `Unsafe production security configuration: ${unsafe.join(', ')}. `
      + 'Use the production Compose override and secure flag values.',
    )
  }
}

export function loadConfig(env = process.env) {
  const nodeEnv = env.NODE_ENV || 'development'
  const isDev = nodeEnv !== 'production'

  const seedDefaultAccounts = parseBool(env.SEED_DEFAULT_ACCOUNTS, isDev)
  const runPlatformListMigration = parseBool(env.RUN_PLATFORM_LIST_MIGRATION, isDev)
  const requireStrongJwt = parseBool(env.REQUIRE_STRONG_JWT, !isDev)
  const rateLimitRelaxed = parseBool(env.RATE_LIMIT_RELAXED, isDev)
  const rateLimitDisabled = parseBool(env.RATE_LIMIT_DISABLED, false)
  const rateLimitRedisRequired = parseBool(env.RATE_LIMIT_REDIS_REQUIRED, false)
  const cookieSecure = parseBool(env.COOKIE_SECURE, !isDev)
  const authAllowBearer = parseBool(env.AUTH_ALLOW_BEARER, isDev)
  const redisUrl = parseRedisUrl(env.REDIS_URL)
  const internalApiSecret = String(env.INTERNAL_API_SECRET || '').trim()

  if (rateLimitRedisRequired && !redisUrl) {
    throw new Error('REDIS_URL is required when RATE_LIMIT_REDIS_REQUIRED=true.')
  }

  let jwtSecret = env.JWT_SECRET
  if (!jwtSecret) {
    jwtSecret = isDev ? 'dev-secret-change-me' : ''
  }

  if (requireStrongJwt) {
    validateJwtSecret(jwtSecret)
  }

  const corsOrigin = parseCorsOrigin(env.CORS_ORIGIN, { isDev })
  const email = parseEmailConfig(env, { isDev })

  validateStrictProductionFlags({
    isDev,
    requireStrongJwt,
    seedDefaultAccounts,
    runPlatformListMigration,
    rateLimitRelaxed,
    rateLimitDisabled,
    cookieSecure,
    authAllowBearer,
    internalApiSecret,
    emailTransport: email.emailTransport,
  })

  const port = Number(env.PORT) || DEFAULT_PORT
  const accessTokenExpiresIn = env.ACCESS_TOKEN_EXPIRES_IN || DEFAULT_ACCESS_TOKEN_EXPIRES_IN
  const refreshTokenExpiresIn = env.REFRESH_TOKEN_EXPIRES_IN || DEFAULT_REFRESH_TOKEN_EXPIRES_IN
  // Internal compatibility alias used by the auth plugin.
  const jwtExpiresIn = accessTokenExpiresIn

  return {
    ...email,
    port,
    jwtSecret,
    jwtExpiresIn,
    accessTokenExpiresIn,
    refreshTokenExpiresIn,
    cookieSecure,
    corsOrigin,
    authAllowBearer,
    nodeEnv,
    isDev,
    seedDefaultAccounts,
    runPlatformListMigration,
    requireStrongJwt,
    rateLimitRelaxed,
    rateLimitDisabled,
    rateLimitRedisRequired,
    redisUrl,
    internalApiSecret,
    panelOauth: {
      clientId: String(env.PANEL_OAUTH_CLIENT_ID || '').trim(),
      clientSecret: String(env.PANEL_OAUTH_CLIENT_SECRET || '').trim(),
      redirectUri: String(env.PANEL_OAUTH_REDIRECT_URI || '').trim(),
    },
  }
}
