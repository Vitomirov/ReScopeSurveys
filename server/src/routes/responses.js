/**
 * Survey response routes (authenticated).
 * Lists, creates, and deletes response entries for surveys the caller can
 * access. Exports `upsertResponse()` shared by the public response endpoint.
 */
import { randomUUID } from 'node:crypto'
import { findAccessibleSurvey } from '../lib/auth/surveyAccess.js'
import { resolveDncStatus } from '../lib/survey/dncCheck.js'
import { normalizeResponseEntry } from '../lib/survey/responseNormalization.js'
import { validateCompleteAnswers } from '../lib/survey/completeValidation.js'
import { sendIfRateLimited } from '../lib/survey/rateLimit.js'
import { appendAudit } from '../lib/audit.js'
import { newWriteKey, hashWriteKey, writeKeyMatches } from '../lib/survey/responseWriteKey.js'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200
const ALLOWED_RESPONSE_STATUSES = new Set(['partial', 'complete', 'terminated', 'dnc'])
const TERMINAL_STATUSES = new Set(['complete', 'terminated', 'dnc'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function knownQuestionIds(surveyItems) {
  const ids = new Set()
  for (const item of surveyItems || []) {
    if (item?.itemType === 'question' && item.id) ids.add(item.id)
  }
  return ids
}

function hasUnknownQuestionIds(entry, surveyItems) {
  const known = knownQuestionIds(surveyItems)
  for (const bag of [entry?.responses, entry?.companions]) {
    if (!bag || typeof bag !== 'object' || Array.isArray(bag)) continue
    for (const key of Object.keys(bag)) {
      if (!known.has(key)) return true
    }
  }
  return false
}

function rowToEntry(row) {
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {}
  return {
    id:           row.id,
    surveyId:     row.surveyId,
    timestamp:    row.timestamp.toISOString(),
    status:       row.status,
    pageReached:  payload.pageReached ?? 0,
    responses:    payload.responses ?? {},
    companions:   payload.companions ?? {},
    terminatedBy: payload.terminatedBy ?? null,
    fingerprint:  payload.fingerprint ?? null,
  }
}

function entryToDbFields(entry, surveyId, organizationId) {
  const { id, status, timestamp, pageReached, responses, companions, terminatedBy, fingerprint } = entry
  if (!id || !status) return null

  return {
    id,
    surveyId,
    organizationId,
    status,
    timestamp: new Date(timestamp || Date.now()),
    payload: {
      pageReached:  pageReached ?? 0,
      responses:    responses ?? {},
      companions:   companions ?? {},
      terminatedBy: terminatedBy ?? null,
      fingerprint:  fingerprint ?? null,
      answerSchemaVersion: entry.answerSchemaVersion ?? 2,
    },
  }
}

export async function upsertResponse(app, {
  surveyId,
  organizationId,
  entry,
  surveyItems = [],
  publicWriter = null,
}) {
  const normalized = normalizeResponseEntry(entry, surveyItems)
  if (!normalized || typeof normalized !== 'object') return null

  if (hasUnknownQuestionIds(normalized, surveyItems)) {
    return { unknownQuestions: true }
  }

  let id = typeof normalized.id === 'string' ? normalized.id.trim() : ''
  if (!id) {
    id = randomUUID()
    normalized.id = id
  } else if (!UUID_RE.test(id)) {
    return { invalidId: true }
  }

  const data = entryToDbFields(normalized, surveyId, organizationId)
  if (!data) return null
  if (!ALLOWED_RESPONSE_STATUSES.has(data.status)) {
    return { invalidStatus: true }
  }

  const existing = await app.prisma.response.findUnique({
    where: { id: data.id },
    select: { id: true, surveyId: true, organizationId: true, status: true, writeKeyHash: true },
  })
  if (existing && (existing.surveyId !== surveyId || existing.organizationId !== organizationId)) {
    return { conflict: true }
  }

  if (existing && TERMINAL_STATUSES.has(existing.status)) {
    if (TERMINAL_STATUSES.has(data.status)) {
      return { row: existing }
    }
    return { finalized: true }
  }

  if (existing?.writeKeyHash && publicWriter) {
    if (!writeKeyMatches(existing.writeKeyHash, publicWriter.presentedKey)) {
      return { writeKeyRejected: true }
    }
  }

  let issuedWriteKey = null
  if (!existing && publicWriter) {
    issuedWriteKey = newWriteKey()
    data.writeKeyHash = hashWriteKey(issuedWriteKey)
  }

  if (data.status === 'complete' || data.status === 'dnc') {
    const completeness = validateCompleteAnswers(normalized, surveyItems)
    if (!completeness.ok) {
      return { incomplete: true, code: completeness.code }
    }
  }

  data.status = await resolveDncStatus(app.prisma, {
    surveyId,
    entry: normalized,
    surveyItems,
    status: data.status,
  })

  const row = await app.prisma.response.upsert({
    where: { id: data.id },
    create: data,
    update: {
      status:    data.status,
      timestamp: data.timestamp,
      payload:   data.payload,
    },
  })
  return { row, issuedWriteKey }
}

/** Map upsertResponse() outcomes to an HTTP reply. Returns true when sent. */
export function sendUpsertResult(reply, result) {
  if (!result) {
    reply.code(400).send({ error: 'Response entry must include status' })
    return true
  }
  if (result.invalidId) {
    reply.code(400).send({ error: 'Response id must be a UUID' })
    return true
  }
  if (result.unknownQuestions) {
    reply.code(400).send({ error: 'Response contains unknown question ids' })
    return true
  }
  if (result.conflict) {
    reply.code(409).send({ error: 'Response id belongs to another survey' })
    return true
  }
  if (result.invalidStatus) {
    reply.code(400).send({ error: 'Invalid response status' })
    return true
  }
  if (result.finalized) {
    reply.code(409).send({ error: 'Response is finalized' })
    return true
  }
  if (result.incomplete) {
    const emailRequired = result.code === 'EMAIL_REQUIRED'
    reply.code(400).send({
      error: emailRequired
        ? 'Complete responses require a valid email answer'
        : 'Complete responses require answers to required questions',
      code: emailRequired ? 'EMAIL_REQUIRED' : 'INCOMPLETE_ANSWERS',
    })
    return true
  }
  if (result.writeKeyRejected) {
    reply.code(401).send({ error: 'Response write key required', code: 'WRITE_KEY_REQUIRED' })
    return true
  }
  return false
}

export async function registerResponseRoutes(app) {
  const limits = app.rateLimits

  app.get('/api/surveys/:id/responses/stats', async (request, reply) => {
    const survey = await findAccessibleSurvey(
      app.prisma, request, request.params.id, reply, { id: true }
    )
    if (!survey) return

    const cached = app.cache.getStats(survey.id)
    if (cached) return cached

    const stats = await app.cache.loadOnce(`stats:${survey.id}`, async () => {
      const hit = app.cache.getStats(survey.id)
      if (hit) return hit

      const groups = await app.prisma.response.groupBy({
        by: ['status'],
        where: { surveyId: survey.id, organizationId: request.organizationId },
        _count: { _all: true },
      })

      const next = { total: 0, complete: 0, terminated: 0, partial: 0, dnc: 0 }
      for (const row of groups) {
        const count = row._count._all
        if (next[row.status] !== undefined) next[row.status] = count
        next.total += count
      }
      app.cache.setStats(survey.id, next)
      return next
    })
    return stats
  })

  app.get('/api/surveys/:id/responses', async (request, reply) => {
    const survey = await findAccessibleSurvey(
      app.prisma, request, request.params.id, reply, { id: true }
    )
    if (!survey) return

    const page  = Math.max(1, Number(request.query.page) || 1)
    const limit = Math.min(MAX_LIMIT, Math.max(1, Number(request.query.limit) || DEFAULT_LIMIT))
    const skip  = (page - 1) * limit

    const where = { surveyId: survey.id, organizationId: request.organizationId }

    const [total, rows] = await Promise.all([
      app.prisma.response.count({ where }),
      app.prisma.response.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
      }),
    ])

    return {
      responses: rows.map(rowToEntry),
      total,
      page,
      limit,
    }
  })

  app.post('/api/surveys/:id/responses', async (request, reply) => {
    const surveyLimited = await sendIfRateLimited(
      limits.surveyResponses,
      request,
      reply,
      'authenticated-responses-survey',
      { discriminator: request.params.id, includeIp: false },
    )
    if (surveyLimited) return surveyLimited

    const limited = await sendIfRateLimited(
      limits.responses,
      request,
      reply,
      'authenticated-responses',
    )
    if (limited) return limited

    const survey = await findAccessibleSurvey(
      app.prisma, request, request.params.id, reply, { id: true, items: true }
    )
    if (!survey) return

    const result = await upsertResponse(app, {
      surveyId: survey.id,
      organizationId: request.organizationId,
      entry: request.body,
      surveyItems: survey.items || [],
    })
    if (sendUpsertResult(reply, result)) return

    return { ok: true, id: result.row.id }
  })

  app.delete('/api/surveys/:id/responses/:responseId', async (request, reply) => {
    const survey = await findAccessibleSurvey(
      app.prisma, request, request.params.id, reply, { id: true }
    )
    if (!survey) return

    const existing = await app.prisma.response.findFirst({
      where: {
        id: request.params.responseId,
        surveyId: survey.id,
        organizationId: request.organizationId,
      },
    })
    if (!existing) return reply.code(404).send({ error: 'Response not found' })

    await app.prisma.response.delete({ where: { id: existing.id } })
    await appendAudit(app.prisma, {
      organizationId: request.organizationId,
      actorId: request.auth.userId,
      action: 'response.delete',
      targetEntity: 'Response',
      targetId: existing.id,
    })
    return { ok: true }
  })

  app.delete('/api/surveys/:id/responses', async (request, reply) => {
    const survey = await findAccessibleSurvey(
      app.prisma, request, request.params.id, reply, { id: true }
    )
    if (!survey) return

    await app.prisma.response.deleteMany({
      where: { surveyId: survey.id, organizationId: request.organizationId },
    })
    await appendAudit(app.prisma, {
      organizationId: request.organizationId,
      actorId: request.auth.userId,
      action: 'response.delete',
      targetEntity: 'Survey',
      targetId: survey.id,
    })
    return { ok: true }
  })
}
