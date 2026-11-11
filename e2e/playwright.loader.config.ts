import { defineConfig, devices } from '@playwright/test'

const serverPort = 4203
const clientPort = 3203
process.env.E2E_ADMIN_URL = `http://localhost:${serverPort}`

export default defineConfig({
  testDir: './tests',
  testMatch: 'loader-brand-color.spec.ts',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  workers: 1,
  use: { baseURL: `http://localhost:${clientPort}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'mix phx.server',
      cwd: process.env.P3_SERVER_PATH ?? '../server',
      url: `http://localhost:${serverPort}/seo/head`,
      env: {
        DEV_DATABASE: process.env.DEV_DATABASE ?? 'delivest_e2e_p3',
        ERL_FLAGS: '+S 4:4',
        PORT: String(serverPort),
        CLIENT_ORIGIN: `http://localhost:${clientPort}`,
      },
      reuseExistingServer: false,
      timeout: 240_000,
    },
    {
      command: `pnpm build && pnpm exec vite preview --port ${clientPort} --strictPort`,
      cwd: process.env.P3_CLIENT_PATH ?? '../client',
      url: `http://localhost:${clientPort}`,
      env: { VITE_API_BASE_URL: `http://localhost:${serverPort}` },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
})
