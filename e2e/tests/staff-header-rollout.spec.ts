import { expect, type Page } from '@playwright/test'
import { adminUrl, branchSlug } from '../support/env'
import { branchPage } from '../support/staff'
import { test } from '../support/test'

async function expectPageFrame(page: Page) {
  await expect.poll(() => page.locator('#staff-header').evaluate((header) =>
    Math.round(header.getBoundingClientRect().height),
  )).toBe(56)
  await expect(page.locator('#staff-header h1')).toHaveCount(0)
  await expect(page.locator('main h1:visible')).toHaveCount(1)
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(1)
}

test('client title and action live together in the page content', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.goto(`${adminUrl}/staff/clients`)
  await page.locator('[data-phx-main].phx-connected').waitFor()

  await expect(page.locator('main #staff-page-header h1:visible')).toBeVisible()
  await expect(page.locator('main #staff-header-actions')).toContainText('Создать клиента')
  await expectPageFrame(page)
})

test('staff page navigation and actions are present in the initial HTML', async ({ browser, staff }) => {
  const authenticated = await staff('e2e_admin')
  const context = await browser.newContext({
    storageState: await authenticated.context().storageState(),
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  })
  try {
    const page = await context.newPage()
    await page.goto(`${adminUrl}/staff/branches/${branchSlug}/edit`)
    await expect(page.locator('main #settings-navigation [aria-current="page"]')).toBeVisible()
    await expectPageFrame(page)

    await page.goto(`${adminUrl}/staff/b/${branchSlug}/orders`)
    await expect(page.locator('main #order-status-tabs [aria-current="page"]')).toBeVisible()
    await expectPageFrame(page)

    await page.goto(`${adminUrl}/staff/clients`)
    await expect(page.locator('main #staff-page-header h1:visible')).toBeVisible()
    await expect(page.locator('main #staff-header-actions')).toContainText('Создать клиента')
    await expectPageFrame(page)
  } finally {
    await context.close()
  }
})

test('mobile settings and order navigation stay inside the page content', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${adminUrl}/staff/branches/${branchSlug}/edit`)
  await page.locator('[data-phx-main].phx-connected').waitFor()

  const settings = page.locator('main #settings-navigation')
  await expect(settings).toBeVisible()
  await expect(settings.locator('[aria-current="page"]')).toHaveCount(1)
  await expectPageFrame(page)

  await branchPage(page, 'orders')
  const orders = page.locator('main #order-status-tabs')
  await expect(orders.locator('[aria-current="page"]')).toHaveCount(1)
  await expectPageFrame(page)
})

test('promotion action opens the scenario route', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await branchPage(page, 'promotions')
  await page.locator('main #staff-header-actions #new-promotion').click()
  await expect(page).toHaveURL(new RegExp(`/staff/b/${branchSlug}/promotions/new$`))
  await expect(page.locator('#promotion-scenarios')).toBeVisible()
})

test('standalone payment form Save is associated with its page action', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await branchPage(page, 'finance/payments')

  const save = page.locator('main #staff-header-actions button[form="payments-form"]')
  await expect(save).toBeVisible()
  await expect(page.locator('#payments-form button[type="submit"]')).toHaveCount(0)
  await expectPageFrame(page)
  expect(await save.evaluate((button: HTMLButtonElement) => button.form?.id)).toBe('payments-form')
  await expect(save).toBeDisabled()
  const cash = page.locator('#payments-form input[name="payments[cash]"][type="checkbox"]')
  const card = page.locator('#payments-form input[name="payments[card_offline]"][type="checkbox"]')
  const changed = await card.isChecked() ? cash : card
  const initial = await changed.isChecked()
  await changed.setChecked(!initial)
  await expect(save).toBeEnabled()
  await save.click()
  await expect(page.locator('#flash-group')).toContainText(/сохран|saved/i)
  await expect(save).toBeDisabled()
  await page.reload()
  await expect(changed).toHaveJSProperty('checked', !initial)
})
