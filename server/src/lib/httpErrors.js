/**
 * HTTP error response shaping.
 * Maps thrown errors (including Prisma / infra) to safe JSON bodies for API
 * clients, hiding internal details in production while preserving status codes
 * and client-facing messages where they are safe to expose.
 */
import { Prisma } from '@prisma/client'

const GENERIC_500 = 'Internal server error'
const SERVICE_UNAVAILABLE = 'Service temporarily unavailable. Please try again.'

/** Prisma request errors that indicate the database is unreachable or overloaded. */
const PRISMA_UNAVAILABLE_CODES = new Set([
  'P1000', // auth failed against DB
  'P1001', // can't reach server
  'P1002', // server timed out
  'P1008', // operations timed out
  'P1017', // server closed connection
  'P1034', // full disk / space (host-dependent)
  'P2024', // timed out fetching connection from pool
])

function uniqueConstraintMessage(error) {
  const target = error.meta?.target
  const fields = Array.isArray(target) ? target : []
  if (fields.includes('email')) return 'That email is already registered.'
  if (fields.includes('username')) return 'That username is already taken.'
  return 'That value is already in use.'
}

/**
 * Map Prisma / DB errors to HTTP status + safe client copy.
 * Returns null when the error is not a recognized database error.
 */
export function mapDatabaseError(error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      return {
        statusCode: 409,
        message: uniqueConstraintMessage(error),
        code: 'CONFLICT',
      }
    }
    if (error.code === 'P2025') {
      return {
        statusCode: 404,
        message: 'Record not found.',
        code: 'NOT_FOUND',
      }
    }
    if (error.code === 'P2034') {
      return {
        statusCode: 409,
        message: 'Request conflict. Please try again.',
        code: 'TRANSACTION_CONFLICT',
      }
    }
    if (PRISMA_UNAVAILABLE_CODES.has(error.code)) {
      return {
        statusCode: 503,
        message: SERVICE_UNAVAILABLE,
        code: 'DB_UNAVAILABLE',
      }
    }
    return null
  }

  if (
    error instanceof Prisma.PrismaClientInitializationError
    || error instanceof Prisma.PrismaClientRustPanicError
  ) {
    return {
      statusCode: 503,
      message: SERVICE_UNAVAILABLE,
      code: 'DB_UNAVAILABLE',
    }
  }

  return null
}

function isClientSafeApiCode(code) {
  return typeof code === 'string'
    && code.length > 0
    && !code.startsWith('P')
    && !code.startsWith('FST_')
}

function resolveErrorShape(error) {
  const mapped = mapDatabaseError(error)
  if (mapped) {
    return {
      status: mapped.statusCode,
      message: mapped.message,
      code: mapped.code,
      hideInProduction: false,
    }
  }

  if (error.statusCode === 413 || error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
    return {
      status: 413,
      message: 'Payload too large',
      code: null,
      hideInProduction: false,
    }
  }

  const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500
  return {
    status,
    message: error.message || GENERIC_500,
    code: error.code,
    hideInProduction: status >= 500,
  }
}

export function publicErrorResponse(error, { isDev }) {
  const { status, message, code, hideInProduction } = resolveErrorShape(error)

  if (hideInProduction && !isDev) {
    return { status: 500, body: { error: GENERIC_500 } }
  }

  if (status >= 503 && !isDev) {
    return {
      status,
      body: {
        error: message || SERVICE_UNAVAILABLE,
        ...(isClientSafeApiCode(code) ? { code } : {}),
      },
    }
  }

  const body = { error: message || GENERIC_500 }
  if (isClientSafeApiCode(code)) body.code = code
  return { status, body }
}
