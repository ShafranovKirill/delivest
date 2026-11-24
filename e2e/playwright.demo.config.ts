import { defineConfig, devices } from '@playwright/test'

// Read-only browser smoke against an already-running local demo. No webServer
// and no globalSetup: this configuration never starts services or seeds a DB.
export default defineConfig({
  testDir: './demo-smoke',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: process.env.DEMO_ADMIN_URL ?? 'http://localhost:4000',
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
