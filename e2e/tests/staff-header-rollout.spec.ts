import { expect, type Page } from '@playwright/test'
import { adminUrl, branchSlug } from '../support/env'
import { branchPage } from '../support/staff'
import { test } from '../support/test'

async function expectHeaderFit(page: Page, height: number) {
  await expect.poll(() => page.locator('#staff-header').evaluate((header) =>
    Math.round(header.getBoundingClientRect().height),
  )).toBe(height)
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(1)
}

test('client actions occupy a second header row without page introduction', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.goto(`${adminUrl}/staff/clients`)
  await page.locator('[data-phx-main].phx-connected').waitFor()

  await expect(page.locator('#staff-header-title h1:visible')).toHaveCount(1)
  await expect(page.locator('main h1:visible')).toHaveCount(0)
  await expect(page.locator('#staff-header-actions')).toContainText('Создать клиента')
  await expect(page.locator('main')).not.toContainText('Управление клиентами системы')
  await expectHeaderFit(page, 104)
})

test('mobile settings and order routes stay in a 48px navigation row', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.setViewportSize({ width: 390, height: 844 })
  await branchPage(page, 'dashboard')
  await page.goto(`${adminUrl}/staff/branches/${branchSlug}/edit`)
  await page.locator('[data-phx-main].phx-connected').waitFor()

  const settings = page.locator('#staff-page-header-navigation #settings-navigation')
  await expect(settings).toBeVisible()
  await expect(settings.locator('[aria-current="page"]')).toHaveCount(1)
  await expect.poll(() => settings.evaluate((nav) =>
    Math.round(nav.getBoundingClientRect().height),
  )).toBe(48)
  await expectHeaderFit(page, 48)

  await branchPage(page, 'orders')
  const orders = page.locator('#staff-page-header-navigation #order-status-tabs')
  await expect(orders.locator('[aria-current="page"]')).toHaveCount(1)
  await expectHeaderFit(page, 104)
})

test('promotion action opens the scenario route', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await branchPage(page, 'promotions')
  await page.locator('#staff-header-actions #new-promotion').click()
  await expect(page).toHaveURL(new RegExp(`/staff/b/${branchSlug}/promotions/new$`))
  await expect(page.locator('#promotion-scenarios')).toBeVisible()
})

test('standalone payment form Save is associated with its header action', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await branchPage(page, 'finance/payments')

  const save = page.locator('#staff-header-actions button[form="payments-form"]')
  await expect(save).toBeVisible()
  await expect(page.locator('#payments-form button[type="submit"]')).toHaveCount(0)
  await expectHeaderFit(page, 104)
  expect(await save.evaluate((button: HTMLButtonElement) => button.form?.id)).toBe('payments-form')
  await save.click()
  await expect(page.locator('#flash-group')).toContainText(/сохран|saved/i)
})
