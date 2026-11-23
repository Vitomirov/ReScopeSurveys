/**
 * Enterprise plan gate for survey import (file, text, MCP / HTTP import).
 */
import { canUseSurveyImport } from '../../../../shared/planFeatures.js'
import { assertOrgActive } from '../billing/planEnforcement.js'

export async function assertSurveyImportAllowed(prisma, organizationId) {
  const active = await assertOrgActive(prisma, organizationId, { provision: false })
  if (!active.ok) return active
  if (!canUseSurveyImport(active.subscription.planId)) {
    return {
      ok: false,
      error: 'Survey import is included with the Enterprise plan.',
      code: 'IMPORT_NOT_INCLUDED',
    }
  }
  return { ok: true, subscription: active.subscription }
}