import { test } from 'node:test'
import assert from 'node:assert/strict'
import { panelSurveyLink } from '../../../server/src/lib/platform/organizationSurveys.js'
import { surveyMatchesRequestHost } from '../../../server/src/lib/survey/surveyPublicPath.js'

const survey = {
  id: 'survey-1',
  title: 'Brand study',
  status: 'live',
  publicPath: 'brand-study-160326',
}

test('dev links use the local taker, not the creator', () => {
  assert.equal(
    panelSurveyLink(survey, {
      planId: 'starter',
      surveyDomain: '',
      appUrl: 'http://localhost:5173',
      isDev: true,
    }),
    'http://localhost:5173/#/take/survey-1',
  )
})

test('production links use the survey id so a renamed draft still opens', () => {
  assert.equal(
    panelSurveyLink(survey, {
      planId: 'enterprise',
      surveyDomain: 'dejanvitomirov.com',
      appUrl: 'https://app.rescopesurveys.com',
      isDev: false,
    }),
    'https://surveys.dejanvitomirov.com/#/take/survey-1',
  )
})

test('platform host still opens a survey after the custom domain changes', () => {
  const org = {
    subscription: { planId: 'enterprise' },
    settings: {
      surveyDomain: 'imperatorconsulting.com',
      domainVerification: { status: 'pending', domain: 'imperatorconsulting.com' },
    },
  }
  assert.equal(surveyMatchesRequestHost({}, 'rescopesurveys.com', org), true)
  assert.equal(surveyMatchesRequestHost({}, 'dejanvitomirov.com', org), false)
})

test('enterprise without a verified domain still gets a platform taker link', () => {
  assert.equal(
    panelSurveyLink(survey, {
      planId: 'enterprise',
      surveyDomain: '',
      appUrl: 'https://app.rescopesurveys.com',
      isDev: false,
    }),
    'https://surveys.rescopesurveys.com/#/take/survey-1',
  )
})
