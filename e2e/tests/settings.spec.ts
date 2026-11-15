import { expect, type Page } from '@playwright/test'
import { test } from '../support/test'
import { branchPage } from '../support/staff'
import { adminUrl } from '../support/env'

async function watchBrandSave(page: Page) {
  await page.evaluate(() => {
    const state = window as Window & { brandSaved?: boolean }
    state.brandSaved = false
    window.addEventListener('phx:staff:form-saved', () => { state.brandSaved = true }, { once: true })
  })
}

async function expectBrandSave(page: Page) {
  await expect.poll(() => page.evaluate(() =>
    (window as Window & { brandSaved?: boolean }).brandSaved,
  )).toBe(true)
  await expect(page.locator('#flash-group')).toContainText(/сохран|saved/i)
}

test('the admin opens the delivery sections and saves the courier settings', async ({ staff }) => {
  const admin = await staff('e2e_admin')
  await branchPage(admin, 'delivery')

  await admin.locator('#delivery-zones-card').click()
  await expect(admin.locator('#delivery-settings')).toBeVisible()
  await expect(admin.locator('#delivery-zone-map, #delivery-settings')).not.toHaveCount(0)

  await branchPage(admin, 'delivery')
  await admin.locator('#delivery-couriers-card').click()
  const search = admin.locator('#couriers-form select[name="couriers[search]"]')
  const before = await search.inputValue()
  const next = before === 'ready' ? 'preparing' : 'ready'

  await search.selectOption(next)
  await admin.locator('main #staff-header-actions button[form="couriers-form"]').click()
  await admin.waitForURL(/\/delivery$/)

  await admin.locator('#delivery-couriers-card').click()
  await expect(search).toHaveValue(next)

  await search.selectOption(before)
  await admin.locator('main #staff-header-actions button[form="couriers-form"]').click()
  await admin.waitForURL(/\/delivery$/)
})

test('unsaved courier settings guard scope and settings navigation, then a saved form can leave', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await branchPage(page, 'delivery')
  await page.locator('#delivery-couriers-card').click()
  const search = page.locator('#couriers-form select[name="couriers[search]"]')
  const before = await search.inputValue()
  const next = before === 'ready' ? 'preparing' : 'ready'
  await search.selectOption(next)

  await page.locator('#header-branch summary').click()
  await page.locator('#header-branch-all').click()
  const dialog = page.locator('#staff-unsaved-dialog')
  await expect(dialog).toBeVisible()
  await page.locator('#staff-unsaved-stay').click()
  await expect(dialog).toBeHidden()
  await expect(search).toHaveValue(next)
  await expect(page).toHaveURL(/\/staff\/b\/e2e\/delivery\/couriers$/)

  await page.locator('#header-branch summary').click()
  await page.locator('#header-branch-all').click()
  await expect(dialog).toBeVisible()
  await page.locator('#staff-unsaved-leave').click()
  await expect(page).toHaveURL(/\/staff\/dashboard$/)

  await branchPage(page, 'delivery')
  await page.locator('#delivery-couriers-card').click()
  await expect(search).toHaveValue(before)
  await search.selectOption(next)
  await page.locator('main #staff-header-actions button[form="couriers-form"]').click()
  await expect(page).toHaveURL(/\/staff\/b\/e2e\/delivery$/)
  await page.locator('#delivery-couriers-card').click()
  await expect(search).toHaveValue(next)
  await page.locator('#sidebar-settings-nav-features').click()
  await expect(page).toHaveURL(/\/staff\/settings$/)
  await expect(dialog).toBeHidden()

  await branchPage(page, 'delivery')
  await page.locator('#delivery-couriers-card').click()
  await search.selectOption(before)
  await page.locator('main #staff-header-actions button[form="couriers-form"]').click()
  await expect(page).toHaveURL(/\/staff\/b\/e2e\/delivery$/)
})

test('failed same-page brand save stays dirty, successful save clears the guard', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.goto(`${adminUrl}/staff/franchise/brand`)
  await page.locator('[data-phx-main].phx-connected').waitFor()

  const name = page.locator('#franchise-settings-form input[name="settings[name]"]')
  const save = page.locator('#franchise-settings-form button[type="submit"]')
  const settingsLink = page.locator('#sidebar-settings-navigation #sidebar-settings-nav-features')
  const dialog = page.locator('#staff-unsaved-dialog')
  const initial = await name.inputValue()
  const invalidName = 'X'.repeat(61)
  await watchBrandSave(page)
  // Bypass the client cap to exercise the server's length validation boundary.
  await name.evaluate(input => input.removeAttribute('maxlength'))
  await name.fill(invalidName)
  await save.click()
  await expect(page).toHaveURL(/\/staff\/franchise\/brand$/)
  await expect(name).toHaveClass(/input-error/)
  expect(await page.evaluate(() => (window as Window & { brandSaved?: boolean }).brandSaved)).toBe(false)

  await settingsLink.click()
  await expect(dialog).toBeVisible()
  await page.locator('#staff-unsaved-stay').click()
  await expect(dialog).toBeHidden()
  await expect(name).toHaveValue(invalidName)

  const changed = `${initial.slice(0, 45)} E2E ${Date.now() % 100000}`
  await name.fill(changed)
  await save.click()
  await expectBrandSave(page)
  await expect(page).toHaveURL(/\/staff\/franchise\/brand$/)
  await settingsLink.click()
  await expect(page).toHaveURL(/\/staff\/settings$/)
  await expect(dialog).toBeHidden()

  await page.goto(`${adminUrl}/staff/franchise/brand`)
  await page.locator('[data-phx-main].phx-connected').waitFor()
  await expect(name).toHaveValue(changed)
  await watchBrandSave(page)
  await name.fill(initial)
  await save.click()
  await expectBrandSave(page)
  await expect(name).toHaveValue(initial)
})
