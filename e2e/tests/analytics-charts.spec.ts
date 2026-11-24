import { adminUrl } from '../support/env'
import { branchPage } from '../support/staff'
import { expect, test } from '../support/test'

test('sales charts render and update when the reporting step changes', async ({ staff }) => {
  const page = await staff('e2e_admin')
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 900 })

  const period = 'period=custom&from=2026-11-10&to=2026-11-23&compare=previous'
  await branchPage(page, `statistics?tab=sales&${period}`)

  const revenue = page.locator('#statistics-chart-revenue')
  const orders = page.locator('#statistics-chart-orders')
  const average = page.locator('#statistics-chart-avg_check')
  for (const chart of [revenue, orders, average]) {
    await expect(chart.locator('canvas').first()).toBeVisible()
  }

  await revenue.locator('summary').click()
  await expect(revenue.locator('tbody tr')).toHaveCount(14)
  await expect(revenue.locator('tbody tr').first()).toContainText('10.11.2026')

  await page.locator('#statistics-granularity').selectOption('week')
  await expect(page).toHaveURL(/granularity=week/)
  await expect(revenue.locator('tbody tr')).toHaveCount(3)
  await expect(revenue.locator('canvas').first()).toBeVisible()
  await revenue.locator('summary').click()

  await page.setViewportSize({ width: 390, height: 844 })
  await expect.poll(async () => {
    const canvas = await revenue.locator('canvas').first().boundingBox()
    return canvas?.width ?? Infinity
  }).toBeLessThan(390)
  await expect.poll(() => page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  )).toBeLessThanOrEqual(1)

  await branchPage(page, `statistics?tab=overview&${period}`)
  await expect(page.locator('#statistics-overview canvas').first()).toBeVisible()

  await page.goto(`${adminUrl}/staff/dashboard`)
  await page.locator('[data-phx-main].phx-connected').waitFor()
  await expect(page.locator('#dashboard-orders-by-hour-plot canvas').first()).toBeVisible()
  expect(errors).toEqual([])
})
