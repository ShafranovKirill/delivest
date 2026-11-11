import { expect, type Page } from '@playwright/test'
import { branchPage } from '../support/staff'
import { test } from '../support/test'

type Section = {
  path: string
  key: string
  title: string
  height: number
  action?: string
  description?: string
}

const sections: Section[] = [
  { path: 'products', key: 'products', title: 'Товары', height: 120, action: '#create-product', description: 'Управление товарами филиала, ценами и категориями.' },
  { path: 'products/stops', key: 'stops', title: 'Стоп-лист', height: 64, description: 'Товары в стоп-листе не продаются на сайте и в каналах.' },
  { path: 'products/modifiers', key: 'modifiers', title: 'Модификаторы', height: 120, action: 'button[phx-click="new_group"]', description: 'Размер, тесто и добавки. Группа создаётся один раз и подключается ко многим товарам.' },
  { path: 'products/tags', key: 'tags', title: 'Теги', height: 120, action: 'a[href$="/products/tags/new"]', description: 'Теги показываются на карточках товаров на сайте.' },
  { path: 'products/suggested', key: 'suggested', title: 'Рекомендуемые', height: 64, description: 'Рекомендуемые товары предлагаются в корзине на сайте.' },
]

async function expectSectionHeader(page: Page, section: Section) {
  const header = page.locator('#staff-header')
  const title = header.locator('#staff-header-title h1:visible')
  const nav = header.getByRole('navigation', { name: 'Товары' })
  const actions = header.locator('#staff-header-actions')
  const selected = nav.locator(`#product-section-tab-${section.key}`)

  await expect(title).toHaveCount(1)
  await expect(title).toHaveAttribute('title', section.title)
  await expect(nav.getByRole('tab')).toHaveCount(5)
  await expect(selected).toHaveAttribute('aria-current', 'page')
  await expect(selected).toHaveAttribute('aria-selected', 'true')
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(1)
  await expect(page.locator('main [role="tablist"]')).toHaveCount(0)
  if (section.description) await expect(page.locator('main')).not.toContainText(section.description)
  if (section.action) {
    await expect(actions.locator(section.action)).toBeVisible()
    await expect.poll(() => actions.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
      await selected.evaluate((element) => getComputedStyle(element).backgroundColor),
    )
  } else {
    await expect(actions).toBeHidden()
    await expect.poll(() => selected.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
      await page.locator('main').evaluate((element) => getComputedStyle(element.closest('.bg-base-200')!).backgroundColor),
    )
  }
  await expect.poll(() => header.evaluate((element) => element.getBoundingClientRect().height)).toBe(section.height)
  await expect.poll(() => page.locator('.staff-shell-content').evaluate((element) =>
    parseFloat(getComputedStyle(element).paddingTop),
  )).toBe(section.height)
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(1)

  const titleBox = await title.boundingBox()
  const tabBox = await selected.boundingBox()
  expect(titleBox && tabBox).toBeTruthy()
  expect(Math.abs(titleBox!.y - tabBox!.y)).toBeLessThan(12)
  await expect.poll(() => title.evaluate((element) => getComputedStyle(element).borderInlineEndWidth)).not.toBe('0px')
  await expect.poll(() => nav.evaluate((element) => {
    const tab = element.querySelector('[aria-current="page"]')!.getBoundingClientRect()
    const viewport = element.getBoundingClientRect()
    return tab.left >= viewport.left - 1 && tab.right <= viewport.right + 1
  })).toBe(true)
}

test('all product sections use the connected header tabs on desktop', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.setViewportSize({ width: 1440, height: 900 })
  for (const section of sections) {
    await branchPage(page, section.path)
    await expectSectionHeader(page, section)
  }

  await branchPage(page, 'products/modifiers')
  await page.locator('#staff-header-actions button[phx-click="new_group"]').click()
  await expect(page.locator('#group-form')).toBeVisible()

  await branchPage(page, 'products/tags')
  await page.locator('#staff-header-actions a[href$="/products/tags/new"]').click()
  await expect(page.locator('#product-tag-form')).toBeVisible()
})

test('products actions and query survive the header move', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.setViewportSize({ width: 1440, height: 900 })
  await branchPage(page, 'products?search=header')
  await expectSectionHeader(page, sections[0])
  await expect(page.locator('main #products-filter')).toBeVisible()
  await expect(page.locator('#staff-header-actions #copy-products-trigger, #staff-header-actions #export-products, #staff-header-actions #bulk-add-products, #staff-header-actions #create-product')).toHaveCount(4)

  await page.locator('#copy-products-trigger').click()
  await expect(page.locator('#copy-products-modal')).toHaveClass(/modal-open/)
  await page.keyboard.press('Escape')
  await expect(page.locator('#copy-products-modal')).not.toHaveClass(/modal-open/)

  await page.locator('#create-product').click()
  await expect(page).toHaveURL(/\/products\/new\?.*search=header/)
  await expect(page.locator('#product-slideover-toggle')).toBeChecked()
  await expectSectionHeader(page, sections[0])
  await page.locator('.drawer:has(#product-slideover-toggle) .drawer-side > div > div:first-child button').click()
  await expect(page).toHaveURL(/\/products\?.*search=header/)
})

test('mobile keeps the selected tab visible in a horizontal scroller', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.setViewportSize({ width: 390, height: 844 })
  for (const section of sections) {
    await branchPage(page, section.path)
    await expectSectionHeader(page, section)
  }
  await branchPage(page, 'products')
  const nav = page.locator('#staff-page-header-navigation')
  const actions = page.locator('#staff-header-actions')
  await expect.poll(() => nav.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeGreaterThan(0)
  await expect.poll(() => actions.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeGreaterThan(0)
  await actions.locator('#create-product').click()
  await expect(page.locator('#product-slideover-toggle')).toBeChecked()
})
