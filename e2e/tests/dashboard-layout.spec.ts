import { adminUrl } from '../support/env'
import { branchPage } from '../support/staff'
import { expect, test } from '../support/test'

test('dashboard shares its saved widgets across scopes and adapts without horizontal scrolling', async ({ staff }) => {
  const page = await staff('e2e_admin')
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 1600, height: 1000 })
  await branchPage(page, 'dashboard')

  const grid = page.locator('#dashboard-grid')
  const widget = (key: string) => grid.locator(`[data-widget-id="${key}"]`)
  const reset = async () => {
    page.once('dialog', dialog => dialog.accept())
    await page.locator('#dashboard-reset').click()
    await expect(page.locator('#dashboard-edit')).toBeVisible()
  }
  await page.locator('#dashboard-edit').click()
  await reset()
  await expect(widget('hourly').locator('canvas').first()).toBeVisible()
  await expect(widget('quick_actions')).toBeVisible()
  await expect(widget('quick_actions').locator('a[href$="/statistics"]')).toBeVisible()

  await page.locator('#dashboard-edit').click()
  const revenue = widget('revenue')
  const initialWidth = (await revenue.boundingBox())!.width
  await revenue.hover()
  const handle = revenue.locator('.ui-resizable-se')
  await expect(handle).toBeVisible()
  const resizeHandle = (await handle.boundingBox())!
  const x = resizeHandle.x + resizeHandle.width / 2
  const y = resizeHandle.y + resizeHandle.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + initialWidth / 3, y, { steps: 12 })
  await page.mouse.up()
  await expect.poll(async () => (await revenue.boundingBox())!.width).toBeGreaterThan(initialWidth + 20)
  await page.locator('#dashboard-remove-hourly').click()
  await expect(widget('hourly')).toHaveCount(0)
  await page.locator('#dashboard-cancel').click()
  await expect(widget('hourly').locator('canvas').first()).toBeVisible()
  await expect.poll(async () => (await revenue.boundingBox())!.width).toBeCloseTo(initialWidth, 0)

  await page.locator('#dashboard-edit').click()
  const statisticsAction = page.locator('#dashboard-action-statistics')
  await expect(statisticsAction).toHaveAttribute('aria-pressed', 'true')
  await statisticsAction.click()
  await expect(statisticsAction).toHaveAttribute('aria-pressed', 'false')
  await page.locator('#dashboard-add-cumulative_revenue').click()
  await expect(widget('cumulative_revenue').locator('canvas').first()).toBeVisible()
  await page.locator('#dashboard-remove-hourly').click()
  await page.locator('#dashboard-save').click()
  await expect(page.locator('#dashboard-edit')).toBeVisible()
  await expect(widget('hourly')).toHaveCount(0)

  await page.goto(`${adminUrl}/staff/dashboard`)
  await page.locator('[data-phx-main].phx-connected').waitFor()
  await expect(widget('quick_actions')).toBeVisible()
  await expect(widget('hourly')).toHaveCount(0)
  await expect(widget('cumulative_revenue').locator('canvas').first()).toBeVisible()
  await expect(widget('quick_actions').locator('a[href$="/statistics"]')).toHaveCount(0)
  await page.setViewportSize({ width: 1024, height: 900 })
  await expect(grid).toHaveClass(/\bgs-6\b/)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(grid).toHaveClass(/\bgs-1\b/)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
    .toBeLessThanOrEqual(1)
  const quickActions = await widget('quick_actions').boundingBox()
  expect(quickActions?.width).toBeLessThanOrEqual(390)

  await page.locator('#dashboard-edit').click()
  await reset()
  await expect(widget('hourly').locator('canvas').first()).toBeVisible()
  await branchPage(page, 'dashboard')
  await expect(widget('hourly').locator('canvas').first()).toBeVisible()
  expect(errors).toEqual([])
})
