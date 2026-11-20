import { test, expect, devices } from '@playwright/test'
import { seedPhoneSurvey } from './helpers/seedPhoneSurvey.mjs'

// Real iPhone 14 profile: WebKit-sized viewport, touch, mobile UA
test.use({ ...devices['iPhone 14'] })

const SAVE_REJECTED = 'We could not save your response. Your answers are kept in this tab.'
const WRITE_KEY_PREFIX = 'rs_response_write_key:'

test('real phone user on flaky 4G with blocked cookies still finishes the survey', async ({ page, context }) => {
  const survey = await seedPhoneSurvey()

  // 1. Open the public taker like a respondent on a phone
  await page.goto(survey.takeUrl)
  const start = page.getByRole('button', { name: 'Start Survey' })
  await expect(start).toBeVisible()
  await start.tap()

  // 2. Answer page 1 and go next (Next does not save yet — same as production)
  await expect(page.getByText(survey.question1)).toBeVisible()
  await page.getByPlaceholder('Type your answer…').fill('Odlično, ali slab signal')
  await page.getByRole('button', { name: 'Next' }).tap()

  await expect(page.getByText(survey.question2)).toBeVisible()
  await page.getByPlaceholder('Type your answer…').fill('4G pada usred Submit')

  // 3. Safari ITP / in-app browser: cookies wiped mid-session
  await context.clearCookies()

  // 4. Flaky 4G: first save reaches the API and is stored, but the phone never
  //    receives the HTTP response. Later attempts continue normally.
  let attempts = 0
  await page.route('**/api/public/surveys/*/responses', async (route) => {
    attempts += 1
    if (attempts === 1) {
      await route.fetch()
      await route.abort('failed')
      return
    }
    await route.continue()
  })

  // 5. Submit — first attempt "fails" on the wire; auto-retry should recover
  await page.getByRole('button', { name: 'Submit survey' }).tap()

  // Must not stick on the fatal rejection wall
  await expect(page.getByText(SAVE_REJECTED)).toHaveCount(0)

  // If the UI exposed Try again (non-retryable path), tap it once
  const tryAgain = page.getByRole('button', { name: 'Try again' })
  if (await tryAgain.isVisible().catch(() => false)) {
    await tryAgain.tap()
  }

  await expect(page.getByRole('heading', { name: 'Survey Complete' })).toBeVisible({
    timeout: 20_000,
  })
  await expect(page.getByText(SAVE_REJECTED)).toHaveCount(0)

  // First POST was aborted after the server stored the row; the retry is an
  // idempotent complete (no new writeKey issued). The phone still finishes.
  expect(attempts).toBeGreaterThanOrEqual(2)
})

test('phone stores writeKey in sessionStorage when the save response arrives', async ({ page, context }) => {
  const survey = await seedPhoneSurvey()

  await page.goto(survey.takeUrl)
  await page.getByRole('button', { name: 'Start Survey' }).tap()
  await page.getByPlaceholder('Type your answer…').fill('Signal ok')
  await page.getByRole('button', { name: 'Next' }).tap()
  await page.getByPlaceholder('Type your answer…').fill('nema problema')

  await context.clearCookies()
  await page.getByRole('button', { name: 'Submit survey' }).tap()

  await expect(page.getByRole('heading', { name: 'Survey Complete' })).toBeVisible({
    timeout: 20_000,
  })

  const writeKeys = await page.evaluate((prefix) => {
    const keys = []
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const key = sessionStorage.key(i)
      if (key && key.startsWith(prefix)) keys.push(key)
    }
    return keys
  }, WRITE_KEY_PREFIX)
  expect(writeKeys.length).toBeGreaterThan(0)
})
