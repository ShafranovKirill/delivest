import { expect } from '@playwright/test'
import { adminUrl, branchSlug } from '../support/env'
import { test } from '../support/test'

const pages = [
  { name: 'orders', path: `/staff/b/${branchSlug}/orders?period=all`, marker: '#orders-search', visibleHeadings: 0 },
  { name: 'clients', path: '/staff/clients', marker: '#clients-filter-form', toolbar: '#clients-toolbar', visibleHeadings: 0 },
  { name: 'receipts', path: `/staff/b/${branchSlug}/finance/receipts`, marker: '#receipts-filter-form', toolbar: '#receipts-toolbar', visibleHeadings: 0 },
  { name: 'analytics', path: `/staff/b/${branchSlug}/analytics/sources?period=today`, marker: '#statistics-report', visibleHeadings: 1 },
  { name: 'settings', path: `/staff/branches/${branchSlug}/edit/general`, marker: '#branch-form', visibleHeadings: 1 },
] as const

for (const size of [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
] as const) {
  for (const theme of ['light', 'dark'] as const) {
    test(`working staff pages render at ${size.name} in ${theme} theme`, async ({ staff }) => {
      const page = await staff('e2e_admin')
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      await page.setViewportSize({ width: size.width, height: size.height })

      for (const item of pages) {
        await page.goto(`${adminUrl}${item.path}`)
        await page.locator('[data-phx-main].phx-connected').waitFor()
        await page.evaluate(value => { document.documentElement.dataset.theme = value }, theme)
        await expect(page.locator('main h1:not(.sr-only):visible')).toHaveCount(item.visibleHeadings)
        if ('toolbar' in item) {
          await expect(page.locator(`main ${item.toolbar}.staff-page-toolbar h1.sr-only`)).toHaveCount(1)
          await expect(page.locator(`${item.marker} button[type="submit"]`)).toHaveCount(0)
        }
        await expect(page.locator(item.marker)).toBeVisible()
        await expect.poll(() => page.evaluate(() =>
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )).toBeLessThanOrEqual(1)
        await page.screenshot({
          path: `/tmp/admin-stage4-${item.name}-${size.name}-${theme}.png`,
          fullPage: true,
        })
      }

      expect(errors).toEqual([])
    })
  }
}
