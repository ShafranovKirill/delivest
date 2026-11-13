import { expect } from '@playwright/test'
import { adminUrl } from '../support/env'
import { test } from '../support/test'

test('Frontpad exposes saved configuration and sending status on desktop and mobile', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.goto(`${adminUrl}/staff/b/e2e/integrations/frontpad`)
  await page.locator('[data-phx-main].phx-connected').waitFor()
  await page.locator('button[phx-value-tab="settings"]').click()

  await expect(page.locator('#frontpad-settings')).toBeVisible()
  await expect(page.locator('#frontpad-sending')).toBeVisible()
  await expect(page.locator('#frontpad-health-summary-usage')).toBeVisible()
  await page.screenshot({ path: '/tmp/admin-stage3-frontpad-desktop.png', fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('#frontpad-sending')).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.screenshot({ path: '/tmp/admin-stage3-frontpad-mobile-top.png' })
  await page.screenshot({ path: '/tmp/admin-stage3-frontpad-mobile.png', fullPage: true })

  await page.reload()
  await page.locator('[data-phx-main].phx-connected').waitFor()
  await page.locator('button[phx-value-tab="settings"]').click()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})
