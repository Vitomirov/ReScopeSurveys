import { test } from 'node:test'
import assert from 'node:assert/strict'
import { panelSurveyLink } from '../../../server/src/lib/platform/organizationSurveys.js'

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

test('production links use the organization share URL', () => {
  assert.equal(
    panelSurveyLink(survey, {
      planId: 'enterprise',
      surveyDomain: 'dejanvitomirov.com',
      appUrl: 'https://app.rescopesurveys.com',
      isDev: false,
    }),
    'https://surveys.dejanvitomirov.com/brand-study-160326',
  )
})
