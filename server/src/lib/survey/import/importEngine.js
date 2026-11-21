import { randomUUID } from 'node:crypto'
import { importPayloadSchema, formatZodErrors, normalizeImportPayload } from './schema.js'
import { collectCodes, mapCodesToIds } from './mapCodes.js'
import { buildRuntimeItems } from './buildItems.js'
import { IMPORT_PENDING_STATUS } from '../../../../../shared/surveyImport/questionTiers.js'
import { persistNewSurvey, persistSurveyAppend } from '../persistSurvey.js'
import { loadPlatformLists } from '../platformLists.js'

const APPEND_ALLOWED = new Set(['draft', 'pending_review'])

export function buildImportSurveyMeta(surveyInput, meta) {
  const now = new Date().toISOString()
  return {
    title: surveyInput?.title || 'Imported survey',
    internalName: surveyInput?.internalName || '',
    surveyCode: surveyInput?.surveyCode || '',
    description: surveyInput?.description || '',
    clientName: surveyInput?.clientName,
    topicName: surveyInput?.topicName,
    surveyTypeName: surveyInput?.surveyTypeName,
    status: IMPORT_PENDING_STATUS,
    clientId: '',
    topicId: '',
    surveyType: '',
    showCoverPage: true,
    startButtonText: surveyInput?.startButtonText,
    createdAt: now,
    updatedAt: now,
    importMeta: {
      source: meta.source,
      importedAt: now,
      mode: meta.mode,
      warnings: meta.warnings,
      externalId: meta.externalId || null,
    },
    settings: {
      onePerPage: surveyInput?.settings?.onePerPage ?? true,
      ...(surveyInput?.settings || {}),
    },
  }
}

function insertPageBreaks(items, onePerPage) {
  if (!onePerPage) return items
  const out = []
  let pb = 0
  for (const item of items) {
    if (item.itemType === 'question' && out.length > 0) {
      const last = out[out.length - 1]
      if (last.itemType !== 'page_break') {
        pb += 1
        out.push({
          id: randomUUID(),
          itemType: 'page_break',
          visibility: { enabled: false, mode: 'show_if', conditions: [] },
          navigationLock: { enabled: false, message: '' },
        })
      }
    }
    out.push(item)
  }
  return out
}

export async function runImport(prisma, ctx, rawPayload, meta, { cache, dryRun = false } = {}) {
  const parsed = importPayloadSchema.safeParse(normalizeImportPayload(rawPayload))
  if (!parsed.success) {
    return { ok: false, status: 422, errors: formatZodErrors(parsed.error) }
  }

  const payload = parsed.data
  const mode = meta.mode || payload.mode || 'create'
  const warnings = [...(meta.parserWarnings || [])]

  const { errors: codeErrors } = collectCodes(payload.items)
  if (codeErrors.length) {
    return { ok: false, status: 422, errors: codeErrors, warnings }
  }

  const { codeToId } = mapCodesToIds(payload.items)
  let runtimeItems = buildRuntimeItems(payload.items, codeToId, { warnings })
  const surveyMeta = buildImportSurveyMeta(payload.survey, {
    ...meta,
    mode,
    warnings,
  })

  const { clients, topics, surveyTypes } = await loadPlatformLists(prisma, ctx.organizationId)
  if (surveyMeta.clientName) {
    const match = clients.find(c => c.name.toLowerCase() === String(surveyMeta.clientName).toLowerCase())
    if (match) surveyMeta.clientId = match.id
    delete surveyMeta.clientName
  }
  if (surveyMeta.topicName) {
    const match = topics.find(t => t.name.toLowerCase() === String(surveyMeta.topicName).toLowerCase())
    if (match) surveyMeta.topicId = match.id
    delete surveyMeta.topicName
  }
  if (surveyMeta.surveyTypeName) {
    const match = surveyTypes.find(t => t.name.toLowerCase() === String(surveyMeta.surveyTypeName).toLowerCase())
    if (match) surveyMeta.surveyType = match.id
    delete surveyMeta.surveyTypeName
  }

  if (surveyMeta.settings?.onePerPage) {
    runtimeItems = insertPageBreaks(runtimeItems, true)
  }

  if (dryRun) {
    return { ok: true, status: 200, dryRun: true, warnings, itemCount: runtimeItems.length }
  }

  if (mode === 'append') {
    const surveyId = payload.surveyId || ctx.surveyId
    if (!surveyId) {
      return { ok: false, status: 400, errors: [{ code: 'MISSING_SURVEY', message: 'surveyId required for append' }] }
    }
    const scope = ctx.surveyScope && Object.keys(ctx.surveyScope).length
      ? ctx.surveyScope
      : { organizationId: ctx.organizationId }
    const existing = await prisma.survey.findFirst({
      where: { id: surveyId, ...scope },
    })
    if (!existing) {
      return { ok: false, status: 404, errors: [{ code: 'NOT_FOUND', message: 'Survey not found' }] }
    }
    const status = existing.survey?.status || 'draft'
    if (!APPEND_ALLOWED.has(status)) {
      return {
        ok: false,
        status: 422,
        errors: [{ code: 'IMPORT_STATUS_LOCKED', message: 'Import append is only allowed on draft or in-review surveys.' }],
      }
    }

    const revision = ctx.revision
    if (typeof revision !== 'number') {
      return { ok: false, status: 400, errors: [{ code: 'REVISION_REQUIRED', message: 'revision required for append' }] }
    }

    const result = await persistSurveyAppend(prisma, {
      organizationId: ctx.organizationId,
      surveyId,
      revision,
      surveyPatch: null,
      items: runtimeItems,
      existingSurvey: existing.survey,
      existingItems: existing.items,
      cache,
    })
    if (!result.ok) return { ok: false, status: result.status, errors: [{ code: 'PERSIST', message: result.body.error }] }

    return {
      ok: true,
      httpStatus: result.status,
      surveyId,
      revision: result.body.revision,
      warnings,
      surveyStatus: status,
    }
  }

  const surveyId = randomUUID()
  const result = await persistNewSurvey(prisma, {
    organizationId: ctx.organizationId,
    userId: ctx.userId,
    surveyId,
    survey: surveyMeta,
    items: runtimeItems,
    cache,
    auditActorId: ctx.userId,
  })

  if (!result.ok) {
    return { ok: false, status: result.status, errors: [{ code: result.body.code || 'PERSIST', message: result.body.error }] }
  }

  return {
    ok: true,
    httpStatus: 201,
    surveyId: result.body.id,
    revision: result.body.revision,
    publicPath: result.body.publicPath,
    surveyStatus: IMPORT_PENDING_STATUS,
    warnings,
  }
}