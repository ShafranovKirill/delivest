import { expect } from '@playwright/test'
import { branchPage } from '../support/staff'
import { test } from '../support/test'

test('product creation, editing and filtered return keep menu data', async ({ staff }) => {
  const page = await staff('e2e_admin')
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const name = `Stage4 product ${Date.now()}`

  await page.setViewportSize({ width: 1440, height: 900 })
  await branchPage(page, 'products')
  await expect(page.locator('main h1:visible')).toHaveCount(1)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: '/tmp/admin-stage4-product-list-desktop-light.png', fullPage: true })

  await page.locator('#create-product').click()
  await expect(page.locator('#product-form')).toBeVisible()
  await expect(page.locator('#product-form input[name="product[is_active]"][type="checkbox"]')).not.toBeChecked()
  await page.screenshot({ path: '/tmp/admin-stage4-product-new-desktop-light.png', fullPage: true })
  await page.locator('#product-form input[name="product[name]"]').fill(name)
  await expect.poll(() => page.locator('#product-form input[name="product[price]"]').evaluate((element) =>
    (element as HTMLInputElement).validity.valueMissing,
  )).toBe(true)
  // Let the server receive the missing value to verify its own validation too.
  await page.locator('#product-form input[name="product[price]"]').evaluate(element => element.removeAttribute('required'))
  await page.locator('#product-form button[type=submit]').click()
  await expect(page.locator('#product-form input[name="product[price]"]')).toHaveClass(/input-error/)
  await expect(page.locator('#product-form input[name="product[name]"]')).toHaveValue(name)
  await page.locator('#product-error-summary a[href="#product_price"]').click()
  await expect(page.locator('#product-form input[name="product[price]"]')).toBeFocused()
  await expect(page.locator('#staff-unsaved-dialog')).not.toBeVisible()
  await expect(page).toHaveURL(/\/products\/new/)

  await page.locator('#product-form input[name="product[price]"]').fill('0')
  await page.locator('#product-form button[type=submit]').click()
  await expect(page).toHaveURL(/\/products(?:\?|$)/)

  await page.locator('#products-filter input[name=search]').fill(name)
  await expect(page).toHaveURL(/search=/)
  const row = page.locator('#products tr', { hasText: name })
  await expect(row).toBeVisible()
  await expect(row).toContainText('Неактивен')
  const filteredUrl = page.url()
  const rowAnchor = await row.getByRole('link', { name, exact: true }).getAttribute('id')
  expect(rowAnchor).toMatch(/^product-row-/)
  await page.setViewportSize({ width: 390, height: 300 })
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await row.getByRole('link', { name, exact: true }).click()
  await expect.poll(() => page.locator('main #staff-page-header h1').evaluate(element =>
    element.getBoundingClientRect().top,
  )).toBeGreaterThan(56)
  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(page.locator('#product-form fieldset[disabled]')).toBeVisible()
  await expect(page.locator('#product-form button[phx-click="open_upload_modal"]')).toHaveCount(0)
  await page.locator('#product-edit-link').click()
  await expect(page.locator('#product-edit-page #product-form')).toBeVisible()
  await expect(page.locator('#product-dish-section')).toBeVisible()
  await page.screenshot({ path: '/tmp/admin-stage4-product-edit-desktop-light.png', fullPage: true })
  await page.locator('#product-form input[name="product[calories]"]').fill('42.5')
  await page.locator('#product-form button[type=submit]').click()
  await expect(page).toHaveURL(`${filteredUrl}#${rowAnchor}`)

  await page.locator('#products tr', { hasText: name }).getByRole('link', { name, exact: true }).click()
  await page.locator('#product-edit-link').click()
  await expect(page.locator('#product-form input[name="product[calories]"]')).toHaveValue('42.5')
  await page.locator('#product-back-to-list').click()
  await expect(page).toHaveURL(`${filteredUrl}#${rowAnchor}`)
  await expect.poll(() => page.locator(`#${rowAnchor}`).evaluate(element => {
    const rect = element.getBoundingClientRect()
    return rect.top >= 56 && rect.top < window.innerHeight
  })).toBe(true)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })
  await page.locator('#products tr', { hasText: name }).getByRole('link', { name, exact: true }).click()
  await expect(page.locator('main h1:visible')).toHaveCount(1)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: '/tmp/admin-stage4-product-edit-mobile-dark.png', fullPage: true })
  expect(errors).toEqual([])
})
