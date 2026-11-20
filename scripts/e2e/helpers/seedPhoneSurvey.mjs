/**
 * Create a live public survey for Playwright phone scenarios.
 * Requires API on BASE (default http://127.0.0.1:3003).
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeApi, provisionOrg, surveyId, createSurvey } from '../../tests/lib/rbacFixtures.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
function readPort() {
  try {
    const rootEnv = readFileSync(resolve(__dirname, '../../../.env'), 'utf8')
    return rootEnv.match(/^PORT=(\d+)/m)?.[1] || '3003'
  } catch {
    return '3003'
  }
}
export const API_BASE = `http://127.0.0.1:${readPort()}`
export const WEB_BASE = process.env.PLAYWRIGHT_WEB_BASE || 'http://127.0.0.1:5173'

const Q1 = 'q_phone_day'
const Q2 = 'q_phone_signal'

export async function seedPhoneSurvey() {
  const api = makeApi(API_BASE)
  const health = await api('/health')
  if (!health.data?.ok) {
    throw new Error(`API not reachable at ${API_BASE}. Run: npm run dev:server`)
  }

  const unique = `pw_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const { adminToken } = await provisionOrg(api, unique)
  const id = surveyId('pw_phone')

  const items = [
    {
      id: Q1,
      itemType: 'question',
      questionType: 'open_text',
      text: 'How was your day?',
      required: true,
    },
    { id: 'pb_phone', itemType: 'page_break', title: 'Almost done' },
    {
      id: Q2,
      itemType: 'question',
      questionType: 'open_text',
      text: 'Any signal issues?',
      required: false,
    },
  ]

  const created = await createSurvey(api, adminToken, id, 'Phone E2E Survey')
  const live = await api(`/api/surveys/${id}`, {
    method: 'PATCH',
    token: adminToken,
    body: {
      survey: {
        id,
        title: 'Phone E2E Survey',
        status: 'live',
        showCoverPage: true,
        startButtonText: 'Start Survey',
        settings: {
          completeTitle: 'Survey Complete',
          showProgressBar: true,
        },
      },
      items,
      revision: created.revision,
    },
  })
  if (live.status !== 200) {
    throw new Error(`Failed to publish survey: ${JSON.stringify(live.data)}`)
  }

  return {
    surveyId: id,
    takeUrl: `${WEB_BASE}/#/take/${id}`,
    question1: 'How was your day?',
    question2: 'Any signal issues?',
  }
}
