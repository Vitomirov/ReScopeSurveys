/**
 * Billing and vendor administration routes.
 * Org-admin billing overview, brand kit, domain verification, plan changes,
 * and invoices. Vendor (platform owner) routes manage all organizations
 * cross-tenant.
 */
import { requireRole, requirePlatformOwner } from '../lib/auth/authz.js'
import { ROLES } from '../lib/auth/roles.js'
import {
  serializeSubscription,
  serializeInvoice,
  planById,
} from '../lib/billing/billingPlans.js'
import { ensureOrgBilling } from '../lib/billing/billingDefaults.js'
import {
  readSurveyDomain,
  readEffectiveSurveyDomain,
  patchOrgSettings,
  readBrandKit,
  readEmbedAllowedOrigins,
  readDomainVerification,
} from '../lib/platform/orgSettings.js'
import { checkDomainVerificationDns } from '../lib/platform/checkDomainVerificationDns.js'
import { sanitizeOrgBrandKit, sanitizeEmbedOrigins } from '../lib/branding/brandEnforcement.js'
import { planFeatureSummary } from '../../../shared/planFeatures.js'
import { normalizeDomainVerification, defaultDomainVerification } from '../../../shared/domainVerification.js'
import {
  countOrgBillingNotifications,
  markOrgBillingSeen,
} from '../lib/billing/billingNotifications.js'
import { buildPlanChangeOptions, applyPlanChange } from '../lib/billing/changePlan.js'
import { deleteOrganization } from '../lib/platform/deleteOrganization.js'
import { appendAudit } from '../lib/audit.js'
import { loadConfig } from '../config.js'

const adminOnly = requireRole(ROLES.ADMIN)

export async function registerBillingRoutes(app) {
  app.get('/api/billing/notifications', { preHandler: adminOnly }, async (request) => {
    return countOrgBillingNotifications(app.prisma, request.organizationId)
  })

  app.post('/api/billing/notifications/seen', { preHandler: adminOnly }, async (request) => {
    await markOrgBillingSeen(app.prisma, request.organizationId)
    return { ok: true }
  })

  app.get('/api/billing/overview', { preHandler: adminOnly }, async (request) => {
    const orgId = request.organizationId
    const [subscription, org, invoices, surveyCount, userCount] = await Promise.all([
      ensureOrgBilling(app.prisma, orgId),
      app.prisma.organization.findUnique({
        where: { id: orgId },
        select: { settings: true },
      }),
      app.prisma.invoice.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        take: 12,
      }),
      app.prisma.survey.count({ where: { organizationId: orgId } }),
      app.prisma.user.count({ where: { organizationId: orgId } }),
    ])

    return {
      subscription: serializeSubscription(subscription),
      surveyDomain: readEffectiveSurveyDomain(org?.settings, subscription.planId),
      brandKit: readBrandKit(org?.settings),
      embedAllowedOrigins: readEmbedAllowedOrigins(org?.settings),
      planFeatures: planFeatureSummary(subscription.planId),
      usage: {
        surveys: surveyCount,
        users: userCount,
      },
      invoices:     invoices.map(serializeInvoice),
    }
  })

  app.get('/api/billing/brand', { preHandler: adminOnly }, async (request) => {
    const orgId = request.organizationId
    const [subscription, org] = await Promise.all([
      ensureOrgBilling(app.prisma, orgId),
      app.prisma.organization.findUnique({
        where: { id: orgId },
        select: { settings: true },
      }),
    ])
    return {
      planFeatures: planFeatureSummary(subscription.planId),
      brandKit: readBrandKit(org?.settings),
      embedAllowedOrigins: readEmbedAllowedOrigins(org?.settings),
    }
  })

  app.patch('/api/billing/brand', { preHandler: adminOnly }, async (request, reply) => {
    const orgId = request.organizationId
    const subscription = await ensureOrgBilling(app.prisma, orgId)
    const org = await app.prisma.organization.findUnique({ where: { id: orgId } })
    const { brandKit, embedAllowedOrigins } = request.body ?? {}

    const patch = {}
    if (brandKit !== undefined) {
      const { brandKit: sanitized, errors } = sanitizeOrgBrandKit(brandKit, subscription.planId)
      if (errors.length) return reply.code(403).send({ error: errors[0] })
      patch.brandKit = sanitized
    }
    if (embedAllowedOrigins !== undefined) {
      const { embedAllowedOrigins: sanitized, errors } = sanitizeEmbedOrigins(
        embedAllowedOrigins,
        subscription.planId,
      )
      if (errors.length) return reply.code(403).send({ error: errors[0] })
      patch.embedAllowedOrigins = sanitized
    }

    const settings = patchOrgSettings(org.settings, patch)
    await app.prisma.organization.update({
      where: { id: orgId },
      data: { settings },
    })
    app.cache.invalidateOrg(orgId)

    return {
      brandKit: readBrandKit(settings),
      embedAllowedOrigins: readEmbedAllowedOrigins(settings),
      planFeatures: planFeatureSummary(subscription.planId),
    }
  })

  app.get('/api/billing/domain-verification', { preHandler: adminOnly }, async (request) => {
    const orgId = request.organizationId
    const subscription = await ensureOrgBilling(app.prisma, orgId)
    const org = await app.prisma.organization.findUnique({
      where: { id: orgId },
      select: { settings: true },
    })
    const domain = readSurveyDomain(org?.settings)
    const verification = readDomainVerification(org?.settings)
    return {
      planFeatures: planFeatureSummary(subscription.planId),
      surveyDomain: domain,
      domainVerification: domain
        ? verification
        : defaultDomainVerification(''),
    }
  })

  app.post('/api/billing/domain-verification/init', { preHandler: adminOnly }, async (request, reply) => {
    const orgId = request.organizationId
    const subscription = await ensureOrgBilling(app.prisma, orgId)
    if (!planFeatureSummary(subscription.planId).customDomain) {
      return reply.code(403).send({ error: 'Custom domain requires an Enterprise plan.' })
    }
    const org = await app.prisma.organization.findUnique({ where: { id: orgId } })
    const domain = readSurveyDomain(org?.settings)
    if (!domain) {
      return reply.code(400).send({ error: 'Survey domain must be configured first.' })
    }
    const token = `rescope-verify-${orgId.slice(0, 8)}`
    const verification = normalizeDomainVerification({
      domain,
      status: 'pending',
      txtRecord: `_rescope-verify.${domain}`,
      txtValue: token,
      verifiedAt: null,
      lastCheckedAt: null,
      failureReason: null,
    })
    const settings = patchOrgSettings(org.settings, { domainVerification: verification })
    await app.prisma.organization.update({ where: { id: orgId }, data: { settings } })
    app.cache.invalidateOrg(orgId)
    return { domainVerification: verification }
  })

  app.post('/api/billing/domain-verification/check', { preHandler: adminOnly }, async (request, reply) => {
    const orgId = request.organizationId
    const subscription = await ensureOrgBilling(app.prisma, orgId)
    if (!planFeatureSummary(subscription.planId).customDomain) {
      return reply.code(403).send({ error: 'Custom domain requires an Enterprise plan.' })
    }
    const org = await app.prisma.organization.findUnique({ where: { id: orgId } })
    const current = readDomainVerification(org?.settings)
    if (!current.domain) {
      return reply.code(400).send({ error: 'Domain verification not initialized.' })
    }

    if (request.body?.forceVerified === true && !loadConfig().isDev) {
      return reply.code(400).send({ error: 'forceVerified is not allowed in production.' })
    }

    const forceVerified = request.body?.forceVerified === true
    const now = new Date().toISOString()
    let matched = false
    let failureReason = 'DNS TXT record not found.'

    if (forceVerified && loadConfig().isDev) {
      matched = true
      failureReason = null
    } else {
      try {
        const dnsResult = await checkDomainVerificationDns(current)
        matched = dnsResult.matched
        failureReason = dnsResult.failureReason
      } catch (err) {
        request.log.error(err)
        failureReason = 'DNS lookup failed. Try again in a few minutes.'
      }
    }

    const verification = normalizeDomainVerification({
      ...current,
      status: matched ? 'verified' : 'pending',
      verifiedAt: matched ? (current.verifiedAt || now) : null,
      lastCheckedAt: now,
      failureReason: matched ? null : failureReason,
    })
    const settings = patchOrgSettings(org.settings, { domainVerification: verification })
    await app.prisma.organization.update({ where: { id: orgId }, data: { settings } })
    app.cache.invalidateOrg(orgId)
    return { domainVerification: verification }
  })

  app.get('/api/billing/invoices', { preHandler: adminOnly }, async (request) => {
    const rows = await app.prisma.invoice.findMany({
      where: { organizationId: request.organizationId },
      orderBy: { createdAt: 'desc' },
    })
    return { invoices: rows.map(serializeInvoice) }
  })

  app.get('/api/billing/plans', { preHandler: adminOnly }, async (request) => {
    return buildPlanChangeOptions(app.prisma, request.organizationId)
  })

  app.patch('/api/billing/subscription', { preHandler: adminOnly }, async (request, reply) => {
    const { planId } = request.body ?? {}
    if (!planId || typeof planId !== 'string') {
      return reply.code(400).send({ error: 'planId is required.' })
    }

    const result = await applyPlanChange(app.prisma, request.organizationId, planId)
    if (!result.ok) {
      return reply.code(result.blockers?.length ? 409 : 400).send({
        error: result.error,
        code: result.code,
        blockers: result.blockers,
      })
    }
    app.cache.invalidateOrg(request.organizationId)

    const invoices = await app.prisma.invoice.findMany({
      where: { organizationId: request.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 12,
    })

    return {
      subscription: result.subscription,
      planFeatures: result.planFeatures,
      usage: result.usage,
      invoice: result.invoice,
      direction: result.direction,
      invoices: invoices.map(serializeInvoice),
    }
  })
}

export async function registerVendorRoutes(app) {
  app.get('/api/vendor/organizations', { preHandler: requirePlatformOwner }, async () => {
    const orgs = await app.prisma.organization.findMany({
      orderBy: { name: 'asc' },
      include: {
        subscription: true,
        _count: { select: { users: true, surveys: true } },
      },
    })

    return {
      organizations: orgs.map(org => ({
        id:           org.id,
        name:         org.name,
        createdAt:    org.createdAt.toISOString(),
        userCount:    org._count.users,
        surveyCount:  org._count.surveys,
        subscription: org.subscription
          ? serializeSubscription(org.subscription)
          : null,
      })),
    }
  })

  app.get('/api/vendor/organizations/:orgId', { preHandler: requirePlatformOwner }, async (request, reply) => {
    const org = await app.prisma.organization.findUnique({
      where: { id: request.params.orgId },
      include: {
        subscription: true,
        invoices: { orderBy: { createdAt: 'desc' }, take: 24 },
        _count: { select: { users: true, surveys: true } },
      },
    })
    if (!org) return reply.code(404).send({ error: 'Organization not found' })

    const subscription = org.subscription
      ?? await ensureOrgBilling(app.prisma, org.id)

    return {
      organization: {
        id:           org.id,
        name:         org.name,
        createdAt:    org.createdAt.toISOString(),
        userCount:    org._count.users,
        surveyCount:  org._count.surveys,
        surveyDomain: readSurveyDomain(org.settings),
      },
      subscription: serializeSubscription(subscription),
      invoices:     org.invoices.map(serializeInvoice),
    }
  })

  app.patch('/api/vendor/organizations/:orgId/subscription', { preHandler: requirePlatformOwner }, async (request, reply) => {
    const { planId, status, seats, priceCents, currentPeriodEnd, surveyDomain } = request.body ?? {}
    const org = await app.prisma.organization.findUnique({
      where: { id: request.params.orgId },
    })
    if (!org) return reply.code(404).send({ error: 'Organization not found' })

    await ensureOrgBilling(app.prisma, org.id)

    const data = {}
    if (planId != null) {
      data.planId = planId
      const plan = planById(planId)
      if (plan) {
        data.seats = plan.seats
        data.priceCents = plan.priceCents
      }
    }
    if (status != null) data.status = status
    if (seats != null && planId == null) data.seats = Number(seats)
    if (priceCents != null && planId == null) data.priceCents = Number(priceCents)
    if (currentPeriodEnd != null) data.currentPeriodEnd = new Date(currentPeriodEnd)

    const updated = await app.prisma.subscription.update({
      where: { organizationId: org.id },
      data,
    })
    app.cache.invalidateOrg(org.id)

    let organizationSurveyDomain = readSurveyDomain(org.settings)
    if (surveyDomain !== undefined) {
      const settings = patchOrgSettings(org.settings, { surveyDomain })
      await app.prisma.organization.update({
        where: { id: org.id },
        data: { settings },
      })
      app.cache.invalidateOrg(org.id)
      organizationSurveyDomain = readSurveyDomain(settings)
    }

    return {
      subscription: serializeSubscription(updated),
      surveyDomain: organizationSurveyDomain,
    }
  })

  app.post('/api/vendor/organizations/:orgId/invoices', { preHandler: requirePlatformOwner }, async (request, reply) => {
    const org = await app.prisma.organization.findUnique({
      where: { id: request.params.orgId },
    })
    if (!org) return reply.code(404).send({ error: 'Organization not found' })

    const {
      amountCents, currency, status, description,
      periodStart, periodEnd, dueDate,
    } = request.body ?? {}

    if (amountCents == null || Number.isNaN(Number(amountCents))) {
      return reply.code(400).send({ error: 'amountCents is required.' })
    }

    const row = await app.prisma.invoice.create({
      data: {
        organizationId: org.id,
        amountCents:    Number(amountCents),
        currency:       currency || 'USD',
        status:         status || 'open',
        description:    description?.trim() || null,
        periodStart:    periodStart ? new Date(periodStart) : null,
        periodEnd:      periodEnd ? new Date(periodEnd) : null,
        dueDate:        dueDate ? new Date(dueDate) : null,
      },
    })

    return { invoice: serializeInvoice(row) }
  })

  app.patch('/api/vendor/invoices/:id', { preHandler: requirePlatformOwner }, async (request, reply) => {
    const existing = await app.prisma.invoice.findUnique({
      where: { id: request.params.id },
    })
    if (!existing) return reply.code(404).send({ error: 'Invoice not found' })

    const { status, description, dueDate, paidAt } = request.body ?? {}
    const data = {}
    if (status != null) data.status = status
    if (description !== undefined) data.description = description?.trim() || null
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null
    if (paidAt !== undefined) data.paidAt = paidAt ? new Date(paidAt) : null

    const updated = await app.prisma.invoice.update({
      where: { id: existing.id },
      data,
    })

    return { invoice: serializeInvoice(updated) }
  })

  app.delete('/api/vendor/organizations/:orgId', { preHandler: requirePlatformOwner }, async (request, reply) => {
    const { confirmName } = request.body ?? {}
    const result = await deleteOrganization(app.prisma, request.params.orgId, {
      confirmName,
      actorOrganizationId: request.organizationId,
    })

    if (!result.ok) {
      return reply.code(result.status).send({
        error: result.error,
        code: result.code,
      })
    }

    for (const surveyId of result.surveyIds) {
      app.cache.invalidateSurvey(surveyId, result.deleted.organizationId)
    }
    for (const userId of result.userIds) {
      app.cache.invalidateUser(userId)
    }
    app.cache.invalidateOrg(result.deleted.organizationId)

    await appendAudit(app.prisma, {
      organizationId: result.deleted.organizationId,
      actorId: request.auth.userId,
      action: 'organization.delete',
      targetEntity: 'Organization',
      targetId: result.deleted.organizationId,
    })

    return { ok: true, deleted: result.deleted }
  })
}
