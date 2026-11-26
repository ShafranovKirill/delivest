import { defineConfig } from '@playwright/test'
import base from './playwright.config'

export default defineConfig({
  ...base,
  testMatch: ['menu-performance.spec.ts', 'menu-icon-transfer.spec.ts', 'checkout-layout.spec.ts'],
  grep: /menu-performance|menu-icon-transfer|checkout payment and time dialogs/,
  outputDir: '../artifacts/menu-performance/ui',
  use: { ...base.use, video: 'on', screenshot: 'on' },
})
