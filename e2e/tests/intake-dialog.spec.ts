import { expect } from '@playwright/test'
import { adminUrl, branchSlug } from '../support/env'
import { test } from '../support/test'

test('order intake opens a centered dialog and restores focus on Escape', async ({ staff }) => {
  const page = await staff('e2e_admin')

  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(`${adminUrl}/staff/branches/${branchSlug}/edit`)
    await page.locator('[data-phx-main].phx-connected').waitFor()

    const dialog = page.getByRole('dialog', { name: 'Приём заказа', exact: true })
    const sidebarOpen = await page.locator('html').evaluate((root) => root.hasAttribute('data-sidebar-open'))
    await page.locator('#intake-menu').click()
    await expect(dialog).toBeVisible()
    await expect(dialog.locator('#intake-close')).toBeFocused()

    const reason = dialog.locator('#intake-pause-form input[name="reason"]')
    await expect(reason).toBeVisible()
    await reason.scrollIntoViewIfNeeded()
    await expect.poll(() => dialog.locator('.modal-box').evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const overlay = element.closest('dialog')!.getBoundingClientRect()
      return Math.abs(rect.left + rect.width / 2 - overlay.width / 2) < 2 &&
        Math.abs(rect.top + rect.height / 2 - overlay.height / 2) < 2
    })).toBe(true)
    expect(await reason.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
      return hit === element || element.contains(hit)
    })).toBe(true)

    await reason.fill('Test only')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(page.locator('#intake-menu')).toBeFocused()
    expect(await page.locator('html').evaluate((root) => root.hasAttribute('data-sidebar-open'))).toBe(sidebarOpen)
  }
})
