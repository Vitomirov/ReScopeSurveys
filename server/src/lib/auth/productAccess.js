/**
 * Which products an employee may open. An organization admin can use the
 * builder and the panel. Other employees need an explicit grant. Panel still
 * requires an active Enterprise subscription. Platform owners never get it.
 */
import { isEnterprisePlan } from '../../../../shared/surveyUrl.js'
import { isAdminRole, isPlatformOwnerRole } from './roles.js'
import { assertOrgActive } from '../billing/planEnforcement.js'

export const PRODUCT_GRANTS = ['builder', 'panel', 'both']

export function flagsFromGrant(grant) {
  if (grant === 'builder') return { canUseBuilder: true, canUsePanel: false }
  if (grant === 'panel') return { canUseBuilder: false, canUsePanel: true }
  if (grant === 'both') return { canUseBuilder: true, canUsePanel: true }
  return null
}

export function grantFromFlags(canUseBuilder, canUsePanel) {
  if (canUseBuilder && canUsePanel) return 'both'
  if (canUsePanel) return 'panel'
  if (canUseBuilder) return 'builder'
  return null
}

/** Live Enterprise check. Does not create a missing subscription row. */
export async function assertPanelAllowed(prisma, organizationId) {
  const active = await assertOrgActive(prisma, organizationId, { provision: false })
  if (!active.ok) return active
  if (!isEnterprisePlan(active.subscription.planId)) {
    return {
      ok: false,
      error: 'Panel is included with the Enterprise plan.',
      code: 'PANEL_NOT_INCLUDED',
    }
  }
  return { ok: true, subscription: active.subscription }
}

/**
 * Validate an invite or team-edit grant.
 * `grant` omitted means builder only, matching accounts created before this flag.
 */
export async function resolveProductGrant(prisma, organizationId, grant = 'builder') {
  const flags = flagsFromGrant(grant)
  if (!flags) {
    return { ok: false, error: 'Access must be builder, panel, or both.', code: 'INVALID_GRANT' }
  }
  if (flags.canUsePanel) {
    const panel = await assertPanelAllowed(prisma, organizationId)
    if (!panel.ok) return panel
  }
  return { ok: true, ...flags }
}

/** Organization admins always have the panel grant. Editors use the stored flag. */
export function hasPanelGrant(user) {
  if (!user || isPlatformOwnerRole(user.role)) return false
  if (isAdminRole(user.role)) return true
  return Boolean(user.canUsePanel)
}

/** Session fields. Platform owners never receive the customer panel. */
export async function loadProductSession(prisma, user) {
  const canUseBuilder = user.canUseBuilder !== false
  if (!hasPanelGrant(user)) {
    return { canUseBuilder, canUsePanel: false, panelEnabled: false }
  }
  const panel = await assertPanelAllowed(prisma, user.organizationId)
  return { canUseBuilder, canUsePanel: true, panelEnabled: panel.ok }
}
