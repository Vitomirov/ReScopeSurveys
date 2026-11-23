/**
 * Shared create-from-canonical-payload for integration webhook and MCP.
 * Always creates surveys in pending_review via runImport (create mode).
 */
import { randomUUID } from 'node:crypto'
import { runImport } from './importEngine.js'
import {
  importPayloadSchema,
  formatZodErrors,
  normalizeImportPayload,
  importValidationSummary,
} from './schema.js'

/**
 * @param {import('@prisma/client').PrismaClient} prisma
 * @param {{ organizationId: string, createdById: string | null }} auth
 * @param {unknown} rawBody
 * @param {{ source?: string, externalId?: string | null, externalIdFallback?: string | null, cache?: unknown }} [opts]
 */
export async function createSurveyFromIntegration(prisma, auth, rawBody, opts = {}) {
  const source = opts.source || 'webhook'
  const parsed = importPayloadSchema.safeParse(normalizeImportPayload(rawBody))
  if (!parsed.success) {
    const errors = formatZodErrors(parsed.error)
    return {
      ok: false,
      httpStatus: 422,
      error: importValidationSummary(errors),
      errors,
    }
  }

  const externalId = opts.externalId !== undefined
    ? opts.externalId
    : (parsed.data.externalId || opts.externalIdFallback || null)

  const orgId = auth.organizationId
  if (externalId) {
    const prior = await prisma.surveyImport.findFirst({
      where: { organizationId: orgId, externalId, status: 'succeeded' },
    })
    if (prior?.surveyId) {
      return {
        ok: true,
        httpStatus: 200,
        surveyId: prior.surveyId,
        status: 'pending_review',
        idempotent: true,
      }
    }
  }

  const importId = randomUUID()
  const result = await runImport(
    prisma,
    {
      organizationId: orgId,
      userId: auth.createdById,
      surveyScope: {},
    },
    parsed.data,
    { source, mode: 'create', externalId },
    { cache: opts.cache },
  )

  if (!result.ok) {
    await prisma.surveyImport.create({
      data: {
        id: importId,
        organizationId: orgId,
        source,
        status: 'failed',
        externalId,
        errorReport: result.errors,
        createdById: auth.createdById,
      },
    }).catch(() => {})
    return {
      ok: false,
      httpStatus: result.status || result.httpStatus || 422,
      errors: result.errors,
    }
  }

  await prisma.surveyImport.create({
    data: {
      id: importId,
      organizationId: orgId,
      surveyId: result.surveyId,
      source,
      status: 'succeeded',
      externalId,
      createdById: auth.createdById,
    },
  }).catch(() => {})

  return {
    ok: true,
    httpStatus: result.httpStatus || 201,
    surveyId: result.surveyId,
    revision: result.revision,
    publicPath: result.publicPath,
    status: result.surveyStatus || 'pending_review',
    warnings: result.warnings,
  }
}
