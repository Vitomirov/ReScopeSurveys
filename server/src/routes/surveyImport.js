/**
 * Enterprise survey import — file upload and JSON canonical payloads.
 */
import { randomUUID } from 'node:crypto'
import multipart from '@fastify/multipart'
import { surveyScope } from '../lib/auth/authz.js'
import { assertSurveyImportAllowed } from '../lib/survey/assertSurveyImport.js'
import { parseTextOutline } from '../../../shared/surveyImport/parseTextOutline.js'
import { parseWorkbookBuffer } from '../lib/survey/import/parseWorkbook.js'
import { runImport } from '../lib/survey/import/importEngine.js'
import {
  importPayloadSchema,
  formatZodErrors,
  importValidationSummary,
  normalizeImportPayload,
} from '../lib/survey/import/schema.js'

const IMPORT_BODY_LIMIT = 10 * 1024 * 1024

function denyWithoutBuilder(request, reply) {
  if (request.auth?.canUseBuilder === false) {
    return reply.code(403).send({
      error: 'This account cannot edit surveys.',
      code: 'BUILDER_DISABLED',
    })
  }
  return null
}

async function recordSurveyImport(prisma, row) {
  try {
    return await prisma.surveyImport.create({ data: row })
  } catch {
    return null
  }
}

export async function registerSurveyImportRoutes(app) {
  await app.register(multipart, {
    limits: { fileSize: IMPORT_BODY_LIMIT },
  })

  app.get('/api/surveys/import/capabilities', async (request) => {
    const gate = await assertSurveyImportAllowed(app.prisma, request.organizationId)
    return { surveyImport: gate.ok }
  })

  app.post('/api/surveys/import', {
    bodyLimit: IMPORT_BODY_LIMIT,
  }, async (request, reply) => {
    const denied = denyWithoutBuilder(request, reply)
    if (denied) return denied

    const gate = await assertSurveyImportAllowed(app.prisma, request.organizationId)
    if (!gate.ok) {
      return reply.code(403).send({ error: gate.error, code: gate.code })
    }

    const contentType = request.headers['content-type'] || ''

    let canonical = null
    let source = 'file'
    let parserWarnings = []
    let mode = 'create'
    let surveyId = null
    let revision = null
    let dryRun = false
    let externalId = null

    if (contentType.includes('application/json')) {
      const body = request.body ?? {}
      mode = body.mode === 'append' ? 'append' : 'create'
      surveyId = body.surveyId
      revision = body.revision
      dryRun = Boolean(body.dryRun)
      externalId = body.externalId
      source = 'webhook'
      if (body.schemaVersion) {
        canonical = body
      } else if (body.text) {
        source = 'text'
        const parsed = parseTextOutline(body.text)
        canonical = { schemaVersion: 1, survey: parsed.survey, items: parsed.items }
        parserWarnings = parsed.warnings
      } else {
        return reply.code(400).send({ error: 'JSON body must include canonical import or text field' })
      }
    } else {
      const parts = request.parts()
      let fileBuffer = null
      let format = 'xlsx'
      for await (const part of parts) {
        if (part.type === 'file') {
          fileBuffer = await part.toBuffer()
        } else if (part.fieldname === 'format') {
          format = String(await part.value).trim()
        } else if (part.fieldname === 'mode') {
          mode = (await part.value) === 'append' ? 'append' : 'create'
        } else if (part.fieldname === 'surveyId') {
          surveyId = String(await part.value).trim()
        } else if (part.fieldname === 'revision') {
          revision = Number(await part.value)
        } else if (part.fieldname === 'dryRun') {
          dryRun = ['1', 'true', 'yes'].includes(String(await part.value).toLowerCase())
        } else if (part.fieldname === 'text') {
          const text = String(await part.value)
          const parsed = parseTextOutline(text)
          canonical = { schemaVersion: 1, survey: parsed.survey, items: parsed.items }
          source = 'text'
          parserWarnings = parsed.warnings
        }
      }

      if (!canonical) {
        if (format === 'text' || !fileBuffer) {
          return reply.code(400).send({ error: 'Provide a file or text field for import' })
        }
        if (format === 'json') {
          try {
            canonical = JSON.parse(fileBuffer.toString('utf8'))
            source = 'file'
          } catch {
            return reply.code(400).send({ error: 'Invalid JSON file' })
          }
        } else {
          const wb = parseWorkbookBuffer(fileBuffer)
          canonical = wb
          parserWarnings = wb.warnings || []
          source = 'file'
        }
      }
    }

    if (externalId) {
      const prior = await app.prisma.surveyImport.findFirst({
        where: {
          organizationId: request.organizationId,
          externalId,
          status: 'succeeded',
        },
      })
      if (prior?.surveyId) {
        return reply.code(200).send({
          ok: true,
          surveyId: prior.surveyId,
          idempotent: true,
          status: 'pending_review',
        })
      }
    }

    const importId = randomUUID()
    const result = await runImport(
      app.prisma,
      {
        organizationId: request.organizationId,
        userId: request.auth.userId,
        surveyId,
        revision,
        surveyScope: surveyScope(request),
      },
      {
        ...canonical,
        mode,
        ...(surveyId ? { surveyId } : {}),
        ...(externalId ? { externalId } : {}),
      },
      { source, mode, parserWarnings, externalId },
      { cache: app.cache, dryRun },
    )

    if (!result.ok) {
      await recordSurveyImport(app.prisma, {
        id: importId,
        organizationId: request.organizationId,
        source,
        status: 'failed',
        externalId: externalId || null,
        errorReport: result.errors,
        createdById: request.auth.userId,
      })
      return reply.code(result.status || result.httpStatus || 422).send({
        ok: false,
        error: importValidationSummary(result.errors),
        errors: result.errors,
        warnings: result.warnings,
      })
    }

    if (!dryRun) {
      await recordSurveyImport(app.prisma, {
        id: importId,
        organizationId: request.organizationId,
        surveyId: result.surveyId,
        source,
        status: 'succeeded',
        externalId: externalId || null,
        createdById: request.auth.userId,
      })
    }

    return reply.code(result.httpStatus || result.status || 201).send({
      ok: true,
      surveyId: result.surveyId,
      revision: result.revision,
      publicPath: result.publicPath,
      status: result.surveyStatus || 'pending_review',
      warnings: result.warnings,
      importId: dryRun ? undefined : importId,
      dryRun: result.dryRun || false,
    })
  })

  app.post('/api/surveys/import/validate', async (request, reply) => {
    const gate = await assertSurveyImportAllowed(app.prisma, request.organizationId)
    if (!gate.ok) return reply.code(403).send({ error: gate.error, code: gate.code })

    const parsed = importPayloadSchema.safeParse(normalizeImportPayload(request.body))
    if (!parsed.success) {
      const errors = formatZodErrors(parsed.error)
      return reply.code(422).send({ ok: false, error: importValidationSummary(errors), errors })
    }
    return { ok: true }
  })
}