/**
 * Shared survey create / append persistence for PATCH and import engine.
 */
import { randomUUID } from 'node:crypto'
import { normalizeSurveyPlatformIds } from '../platform/platformIds.js'
import { assignPublicPath } from './surveyPublicPath.js'
import { enforceSurveyBranding, loadOrgPlanContext } from '../branding/brandEnforcement.js'
import { assertCanCreateSurvey } from '../billing/planEnforcement.js'
import { sanitizeSurveyHtml, sanitizeSurveyItems } from './sanitizeHtml.js'
import { appendAudit } from '../audit.js'
import { loadPlatformLists } from './platformLists.js'

export async function prepareSurveyData(prisma, organizationId, survey, surveyId) {
  const { clients, topics, surveyTypes } = await loadPlatformLists(prisma, organizationId)
  const { planId } = await loadOrgPlanContext(prisma, organizationId)
  const branded = enforceSurveyBranding(
    { ...sanitizeSurveyHtml(survey), id: surveyId, updatedAt: new Date().toISOString() },
    planId,
  )
  const { survey: withPath, publicPath } = await assignPublicPath(prisma, branded)
  const surveyData = normalizeSurveyPlatformIds(withPath, clients, topics, surveyTypes)
  return { surveyData, publicPath, clients, topics, surveyTypes }
}

export async function persistNewSurvey(prisma, {
  organizationId,
  userId,
  surveyId = randomUUID(),
  survey,
  items,
  cache,
  auditActorId,
}) {
  const limit = await assertCanCreateSurvey(prisma, organizationId)
  if (!limit.ok) return { ok: false, status: 403, body: { error: limit.error, code: limit.code } }

  const { surveyData, publicPath } = await prepareSurveyData(prisma, organizationId, survey, surveyId)
  const cleanItems = sanitizeSurveyItems(items)

  const created = await prisma.survey.create({
    data: {
      id: surveyId,
      organizationId,
      createdById: userId,
      publicPath,
      survey: surveyData,
      items: cleanItems,
      revision: 1,
    },
  })

  cache?.invalidateSurvey(created.id, organizationId)
  if (surveyData?.status === 'live') {
    await appendAudit(prisma, {
      organizationId,
      actorId: auditActorId ?? userId,
      action: 'survey.publish',
      targetEntity: 'Survey',
      targetId: created.id,
    })
  }

  return {
    ok: true,
    status: 201,
    body: {
      id: created.id,
      revision: created.revision,
      updatedAt: created.updatedAt.toISOString(),
      publicPath: created.publicPath,
      status: surveyData?.status,
    },
  }
}

export async function persistSurveyAppend(prisma, {
  organizationId,
  surveyId,
  revision,
  surveyPatch,
  items,
  existingSurvey,
  existingItems,
  cache,
}) {
  const mergedItems = sanitizeSurveyItems([...(Array.isArray(existingItems) ? existingItems : []), ...items])
  let surveyData = existingSurvey

  if (surveyPatch && typeof surveyPatch === 'object') {
    const { surveyData: prepared } = await prepareSurveyData(
      prisma,
      organizationId,
      { ...existingSurvey, ...surveyPatch, id: surveyId },
      surveyId,
    )
    surveyData = prepared
  }

  const { count } = await prisma.survey.updateMany({
    where: { id: surveyId, organizationId, revision },
    data: {
      survey: surveyData,
      items: mergedItems,
      revision: revision + 1,
    },
  })

  if (count === 0) {
    return { ok: false, status: 409, body: { error: 'Revision conflict' } }
  }

  cache?.invalidateSurvey(surveyId, organizationId)
  const updated = await prisma.survey.findFirst({
    where: { id: surveyId, organizationId },
    select: { id: true, revision: true, updatedAt: true, publicPath: true, survey: true },
  })

  return {
    ok: true,
    status: 200,
    body: {
      id: updated.id,
      revision: updated.revision,
      updatedAt: updated.updatedAt.toISOString(),
      publicPath: updated.publicPath,
      status: updated.survey?.status,
    },
  }
}