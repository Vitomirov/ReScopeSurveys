import { defineConfig, devices } from '@playwright/test'

const WEB_BASE = process.env.PLAYWRIGHT_WEB_BASE || 'http://127.0.0.1:5173'
const reuse = !process.env.CI

export default defineConfig({
  testDir: './scripts/e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: WEB_BASE,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'iphone-14',
      use: {
        ...devices['iPhone 14'],
      },
    },
  ],
  webServer: [
    {
      command: 'npm run dev:server',
      url: 'http://127.0.0.1:3003/health',
      reuseExistingServer: reuse,
      timeout: 120_000,
    },
    {
      command: 'VITE_USE_API=true npm run dev -- --host 127.0.0.1 --port 5173',
      url: WEB_BASE,
      reuseExistingServer: reuse,
      timeout: 120_000,
    },
  ],
})
