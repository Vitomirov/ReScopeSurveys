/**
 * Surveys the panel may attach to a project.
 * Scoped to the organization, never to the staff user who created the survey.
 * Panel-only employees have no surveys of their own.
 */
import { buildShareableSurveyUrl } from '../../../../shared/surveyUrl.js'

export const ORG_SURVEY_LIST_LIMIT = 200

/** Public link stored on a panel project. Dev uses the local taker. */
export function panelSurveyLink(survey, { planId, surveyDomain, appUrl, isDev }) {
  if (!survey?.id) return null
  if (!isDev) {
    const share = buildShareableSurveyUrl({ survey, planId, surveyDomain })
    if (share) return share
  }
  const base = String(appUrl || '').replace(/\/$/, '')
  if (!base) return null
  return `${base}/#/take/${survey.id}`
}

export async function listOrganizationSurveyLinks(prisma, organizationId, linkContext) {
  const rows = await prisma.$queryRaw`
    SELECT
      id,
      survey_public_path AS "publicPath",
      COALESCE(survey_data->>'title', 'Untitled Survey') AS title,
      COALESCE(survey_data->>'status', 'draft') AS status
    FROM surveys
    WHERE organization_id = ${organizationId}
    ORDER BY survey_updated_at DESC
    LIMIT ${ORG_SURVEY_LIST_LIMIT}
  `

  return rows.flatMap((row) => {
    const url = panelSurveyLink({
      id: row.id,
      title: row.title,
      status: row.status,
      publicPath: row.publicPath,
    }, linkContext)
    if (!url) return []
    return [{ id: row.id, title: row.title, status: row.status, url }]
  })
}
