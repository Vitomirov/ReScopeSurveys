/**
 * Phase 0 — plan features, brand theme, embed protocol, domain verification
 * Run: node --test scripts/phase-brand-phase0.test.mjs
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  canUseBrandKit,
  canEmbedOnOwnSites,
  canUseCustomDomain,
  embedOriginLimit,
  maxSurveys,
  planFeatureSummary,
} from '../../../shared/planFeatures.js'
import {
  validateBrandTheme,
  mergeBrandThemes,
  brandThemeToCssVars,
  meetsContrast,
  stripSurveyBrandingFields,
  DEFAULT_BRAND_THEME,
} from '../../../shared/brandTheme.js'
import {
  buildEmbedUrl,
  buildEmbedSnippet,
  buildFrameAncestorsDirective,
  buildEmbedMessage,
  EMBED_EVENTS,
} from '../../../shared/embedProtocol.js'
import {
  isDomainVerified,
  resolveVerifiedSurveyDomain,
  normalizeDomainVerification,
} from '../../../shared/domainVerification.js'
import {
  PLAN_CATALOG,
  selfServiceTargetPlanIds,
  listMarketingPricingPlans,
  planPriceDisplay,
  normalizeSignupPlanId,
  signupIntentSummary,
} from '../../../shared/planCatalog.js'
import {
  APP_HOST,
  MARKETING_HOSTS,
  isMarketingSiteHost,
  isAppSiteHost,
  usesSplitSiteHosts,
  marketingSiteOrigin,
  appSiteOrigin,
} from '../../../shared/siteHosts.js'

test('plan feature matrix gates by tier', () => {
  assert.equal(canUseBrandKit('free_trial'), false)
  assert.equal(canUseBrandKit('starter'), false)
  assert.equal(canUseBrandKit('professional'), true)
  assert.equal(canUseBrandKit('enterprise'), true)
  assert.equal(canEmbedOnOwnSites('free_trial'), false)
  assert.equal(canEmbedOnOwnSites('starter'), false)
  assert.equal(canEmbedOnOwnSites('professional'), true)
  assert.equal(canUseCustomDomain('professional'), false)
  assert.equal(canUseCustomDomain('enterprise'), true)
  assert.equal(planFeatureSummary('enterprise').surveyImport, true)
  assert.equal(planFeatureSummary('starter').surveyImport, false)
  assert.equal(embedOriginLimit('professional'), 10)
  assert.equal(embedOriginLimit('enterprise'), null)
  assert.equal(maxSurveys('free_trial'), 5)
  assert.equal(maxSurveys('starter'), null)
})

test('production host split: marketing apex vs app subdomain', () => {
  assert.equal(APP_HOST, 'app.rescopesurveys.com')
  assert.deepEqual(MARKETING_HOSTS, ['rescopesurveys.com', 'www.rescopesurveys.com'])
  assert.equal(isMarketingSiteHost('www.rescopesurveys.com'), true)
  assert.equal(isMarketingSiteHost('app.rescopesurveys.com'), false)
  assert.equal(isAppSiteHost('app.rescopesurveys.com'), true)
  assert.equal(isAppSiteHost('rescopesurveys.com'), false)
  assert.equal(usesSplitSiteHosts('app.rescopesurveys.com'), true)
  assert.equal(usesSplitSiteHosts('localhost'), false)
  assert.equal(marketingSiteOrigin(), 'https://rescopesurveys.com')
  assert.equal(appSiteOrigin(), 'https://app.rescopesurveys.com')
})

test('marketing pricing reads from catalog only', () => {
  const cards = listMarketingPricingPlans()
  assert.equal(cards.length, 3)
  assert.deepEqual(cards.map(c => c.id), ['starter', 'professional', 'enterprise'])
  assert.equal(planPriceDisplay('starter').amount, '$49')
  assert.equal(planPriceDisplay('professional').amount, '$149')
  assert.equal(planPriceDisplay('enterprise').type, 'label')
  assert.equal(normalizeSignupPlanId('bogus'), 'free_trial')
  assert.equal(signupIntentSummary('professional').planId, 'professional')
  assert.equal(cards[0].cta.label, 'Choose Starter')
  assert.equal(cards[1].cta.label, 'Choose Professional')
})

test('no paid plan is self-service until checkout exists', () => {
  for (const plan of Object.values(PLAN_CATALOG)) {
    if (plan.priceCents > 0) assert.equal(plan.selfService, false)
  }
  assert.deepEqual(selfServiceTargetPlanIds('free_trial'), [])
  assert.deepEqual(selfServiceTargetPlanIds('starter'), [])
  assert.deepEqual(selfServiceTargetPlanIds('enterprise'), [])
})

test('planFeatureSummary returns stable shape', () => {
  const trial = planFeatureSummary('free_trial')
  assert.equal(trial.brandKit, false)
  assert.equal(trial.maxSurveys, 5)
  assert.equal(trial.isFreeTrial, true)

  const pro = planFeatureSummary('professional')
  assert.equal(pro.brandKit, true)
  assert.equal(pro.customDomain, false)
  assert.equal(pro.embedOriginLimit, 10)
  assert.equal(pro.maxSurveys, null)
})

test('validateBrandTheme rejects inaccessible colors', () => {
  const { errors } = validateBrandTheme({
    textColor: '#ffffff',
    backgroundColor: '#fefefe',
  })
  assert.ok(errors.length > 0)
})

test('validateBrandTheme accepts accessible palette', () => {
  const { theme, errors } = validateBrandTheme({
    primaryColor: '#1d4ed8',
    textColor: '#0f172a',
    backgroundColor: '#f8fafc',
    buttonTextColor: '#ffffff',
  })
  assert.equal(errors.length, 0)
  assert.equal(theme.primaryColor, '#1d4ed8')
})

test('mergeBrandThemes applies survey overrides', () => {
  const org = { ...DEFAULT_BRAND_THEME, primaryColor: '#111111' }
  const merged = mergeBrandThemes(org, { primaryColor: '#ff0000' })
  assert.equal(merged.primaryColor, '#ff0000')
})

test('brandThemeToCssVars maps to CSS custom properties', () => {
  const vars = brandThemeToCssVars(DEFAULT_BRAND_THEME)
  assert.equal(vars['--sf-primary'], '#1791e0')
  assert.match(vars['--sf-font'], /DM Sans/)
})

test('meetsContrast enforces WCAG threshold', () => {
  assert.equal(meetsContrast('#ffffff', '#000000'), true)
  assert.equal(meetsContrast('#ffff00', '#ffffff'), false)
})

test('stripSurveyBrandingFields removes gated survey fields', () => {
  const survey = { id: 's1', title: 'T', companyLogo: 'x', themeOverrides: { primaryColor: '#000' } }
  const stripped = stripSurveyBrandingFields(survey, { allowLogo: false, allowThemeOverrides: false })
  assert.equal(stripped.companyLogo, undefined)
  assert.equal(stripped.themeOverrides, undefined)
  assert.equal(stripped.title, 'T')
})

test('buildEmbedUrl converts public URL to embed path', () => {
  const url = buildEmbedUrl('https://surveys.rescopesurveys.com/my-survey-110826')
  assert.equal(url, 'https://surveys.rescopesurveys.com/embed/my-survey-110826?v=1')
})

test('buildEmbedSnippet includes sandbox attributes', () => {
  const snippet = buildEmbedSnippet('https://surveys.example.com/embed/foo?v=1')
  assert.match(snippet, /sandbox="allow-scripts allow-same-origin allow-forms allow-popups"/)
  assert.match(snippet, /src="https:\/\/surveys\.example\.com\/embed\/foo\?v=1"/)
})

test('buildFrameAncestorsDirective uses none when empty', () => {
  assert.equal(buildFrameAncestorsDirective([]), "'none'")
  assert.equal(
    buildFrameAncestorsDirective(['https://app.client.com']),
    'https://app.client.com',
  )
})

test('buildEmbedMessage never includes response payload', () => {
  const msg = buildEmbedMessage(EMBED_EVENTS.COMPLETED, { surveyId: 'abc' })
  assert.equal(msg.type, EMBED_EVENTS.COMPLETED)
  assert.equal(msg.surveyId, 'abc')
  assert.equal(msg.responses, undefined)
})

test('domain verification resolves only when verified', () => {
  const pending = normalizeDomainVerification({ domain: 'client.com', status: 'pending' })
  assert.equal(isDomainVerified(pending), false)
  assert.equal(
    resolveVerifiedSurveyDomain({
      surveyDomain: 'client.com',
      domainVerification: pending,
      planAllowsCustomDomain: true,
    }),
    '',
  )

  const verified = { domain: 'client.com', status: 'verified' }
  assert.equal(
    resolveVerifiedSurveyDomain({
      surveyDomain: 'client.com',
      domainVerification: verified,
      planAllowsCustomDomain: true,
    }),
    'client.com',
  )
})
