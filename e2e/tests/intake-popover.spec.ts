import { expect } from '@playwright/test'
import { branchPage } from '../support/staff'
import { test } from '../support/test'

test('order intake menu stays usable outside the scrolling header', async ({ staff }) => {
  const page = await staff('e2e_admin')

  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    await branchPage(page, 'orders')

    const menu = page.locator('#intake-popover')
    const sidebarOpen = await page.locator('html').evaluate((root) => root.hasAttribute('data-sidebar-open'))
    await page.locator('#intake-menu').click()
    await expect(menu).toBeVisible()
    await expect(menu).toHaveAttribute('popover', 'auto')

    const reason = menu.locator('#intake-pause-form input[name="reason"]')
    await expect(reason).toBeVisible()
    await reason.scrollIntoViewIfNeeded()
    expect(await menu.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return rect.left >= 0 && rect.top >= 0 && rect.right <= innerWidth && rect.bottom <= innerHeight
    })).toBe(true)
    expect(await reason.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
      return hit === element || element.contains(hit)
    })).toBe(true)

    await reason.fill('Test only')
    await page.keyboard.press('Escape')
    await expect(menu).toBeHidden()
    await expect(page.locator('#intake-menu')).toBeFocused()
    expect(await page.locator('html').evaluate((root) => root.hasAttribute('data-sidebar-open'))).toBe(sidebarOpen)
  }
})
