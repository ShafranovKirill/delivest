import { expect, type Page } from '@playwright/test'
import { branchPage } from '../support/staff'
import { test } from '../support/test'

async function expectProductsHeader(page: Page, height: number) {
  const header = page.locator('#staff-header')
  const nav = header.getByRole('navigation', { name: 'Товары' })
  const actions = header.locator('#staff-header-actions')

  await expect(header.locator('#staff-header-title h1:visible')).toHaveCount(1)
  await expect(nav.getByRole('tab')).toHaveCount(5)
  await expect(actions.locator('#copy-products-trigger, #export-products, #bulk-add-products, #create-product')).toHaveCount(4)
  await expect(page.locator('main #products-filter')).toBeVisible()
  await expect(page.locator('main [role="tablist"]')).toHaveCount(0)
  await expect.poll(() => header.evaluate((element) => element.getBoundingClientRect().height)).toBe(height)
  await expect.poll(() => page.locator('.staff-shell-content').evaluate((element) =>
    parseFloat(getComputedStyle(element).paddingTop),
  )).toBe(height)
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(1)

  const title = await header.locator('#staff-header-title h1:visible').boundingBox()
  const tabs = await nav.boundingBox()
  const action = await actions.locator('#copy-products-trigger').boundingBox()
  expect(title && tabs && action).toBeTruthy()
  expect(Math.abs(title!.y - tabs!.y)).toBeLessThan(12)
  expect(action!.y).toBeGreaterThan(title!.y + title!.height)
  await expect.poll(() => actions.evaluate((element) =>
    element.scrollHeight - element.clientHeight,
  )).toBeLessThanOrEqual(1)
}

test('products header holds tabs and actions on two rows with working dialogs', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.setViewportSize({ width: 1440, height: 900 })
  await branchPage(page, 'products?search=header')
  await expectProductsHeader(page, 120)

  await page.locator('#copy-products-trigger').click()
  await expect(page.locator('#copy-products-modal')).toHaveClass(/modal-open/)
  await page.keyboard.press('Escape')
  await expect(page.locator('#copy-products-modal')).not.toHaveClass(/modal-open/)

  await page.locator('#create-product').click()
  await expect(page).toHaveURL(/\/products\/new\?.*search=header/)
  await expect(page.locator('#product-slideover-toggle')).toBeChecked()
  await expectProductsHeader(page, 120)
  await page.locator('.drawer:has(#product-slideover-toggle) .drawer-side > div > div:first-child button').click()
  await expect(page).toHaveURL(/\/products\?.*search=header/)
  await expect(page.locator('#product-slideover-toggle')).not.toBeChecked()

  await page.locator('#staff-header-title a[href$="/products/stops"]').click()
  await expect(page).toHaveURL(/\/products\/stops$/)
  await expect(page.locator('#staff-header-actions #create-product')).toHaveCount(0)
  await expect.poll(() => page.locator('#staff-header').evaluate((element) =>
    element.getBoundingClientRect().height,
  )).toBe(64)

  await page.goBack()
  await expect(page.locator('#staff-header-actions #create-product')).toBeVisible()
  await expectProductsHeader(page, 120)
})

test('mobile products header scrolls tabs and actions inside the two rows', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.setViewportSize({ width: 390, height: 844 })
  await branchPage(page, 'products')
  await expectProductsHeader(page, 120)

  const nav = page.locator('#staff-header-title nav')
  const actions = page.locator('#staff-header-actions')
  await expect.poll(() => nav.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeGreaterThan(0)
  await expect.poll(() => actions.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeGreaterThan(0)
  await actions.locator('#create-product').click()
  await expect(page.locator('#product-slideover-toggle')).toBeChecked()
})
