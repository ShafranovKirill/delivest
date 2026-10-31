import { defineConfig, devices } from '@playwright/test'

const serverPort = 4100
const clientPort = 3100

export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${clientPort}`,
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'mix phx.server',
      cwd: '../server',
      url: `http://localhost:${serverPort}/staff/auth/login`,
      env: {
        DEV_DATABASE: 'delivest_e2e',
        PORT: String(serverPort),
        CLIENT_ORIGIN: `http://localhost:${clientPort}`,
        DEFAULT_LOCALE: 'ru',
        ATOL_HOST: `http://localhost:${serverPort}/dev/atol/possystem/v5/`,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
    {
      command: 'pnpm exec vite --strictPort',
      cwd: '../client',
      url: `http://localhost:${clientPort}`,
      env: {
        VITE_PORT_WEB: String(clientPort),
        VITE_API_BASE_URL: `http://localhost:${serverPort}`,
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
})
