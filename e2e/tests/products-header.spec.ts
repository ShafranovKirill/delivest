import { expect, type Page } from '@playwright/test'
import { branchPage } from '../support/staff'
import { test } from '../support/test'
import { adminUrl } from '../support/env'

type Section = {
  path: string
  key: string
  title: string
  height: number
  action?: string
  description?: string
}

const sections: Section[] = [
  { path: 'products', key: 'products', title: 'Товары', height: 104, action: '#create-product', description: 'Управление товарами филиала, ценами и категориями.' },
  { path: 'products/stops', key: 'stops', title: 'Стоп-лист', height: 48, description: 'Товары в стоп-листе не продаются на сайте и в каналах.' },
  { path: 'products/modifiers', key: 'modifiers', title: 'Модификаторы', height: 104, action: 'button[phx-click="new_group"]', description: 'Размер, тесто и добавки. Группа создаётся один раз и подключается ко многим товарам.' },
  { path: 'products/tags', key: 'tags', title: 'Теги', height: 104, action: 'a[href$="/products/tags/new"]', description: 'Теги показываются на карточках товаров на сайте.' },
  { path: 'products/suggested', key: 'suggested', title: 'Рекомендуемые', height: 48, description: 'Рекомендуемые товары предлагаются в корзине на сайте.' },
]

async function expectSectionHeader(page: Page, section: Section) {
  const header = page.locator('#staff-header')
  const title = page.locator('main h1.sr-only')
  const nav = header.getByRole('navigation', { name: 'Товары' })
  const actions = header.locator('#staff-header-actions')
  const selected = nav.locator(`#product-section-tab-${section.key}`)

  await expect(title).toHaveCount(1)
  await expect(title).toHaveText(section.title)
  await expect(header.locator('h1, #staff-header-context, .staff-header-fallback')).toHaveCount(0)
  await expect(header).toHaveAttribute('data-header-layout', 'product-tabs')
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

  const tabBox = await selected.boundingBox()
  expect(tabBox).not.toBeNull()
  expect(tabBox!.y).toBe(0)
  expect(tabBox!.height).toBe(48)
  await expect(selected).toHaveCSS('border-bottom-width', '0px')
  await expect(header).toHaveCSS('border-bottom-width', '0px')
  if (section.action) await expect(actions).toHaveCSS('border-top-width', '0px')
  await expect.poll(() => nav.evaluate((element) => {
    const tab = element.querySelector('[aria-current="page"]')!.getBoundingClientRect()
    const viewport = element.getBoundingClientRect()
    return tab.left >= viewport.left - 1 && tab.right <= viewport.right + 1
  })).toBe(true)
}

test('product tabs render before JavaScript connects', async ({ browser, staff }) => {
  const authenticated = await staff('e2e_admin')
  const context = await browser.newContext({
    storageState: await authenticated.context().storageState(),
    javaScriptEnabled: false,
  })
  try {
    const page = await context.newPage()
    await page.goto(`${adminUrl}/staff/b/e2e/products/tags`)
    const header = page.locator('#staff-header')
    await expect(header.locator('[role=tab]')).toHaveCount(5)
    await expect(header.locator('#product-section-tab-tags')).toHaveAttribute('aria-current', 'page')
    await expect(header.locator('h1, #staff-header-context, .staff-header-fallback')).toHaveCount(0)
    await expect(header).toHaveAttribute('data-header-actions', 'true')
    await expect.poll(() => header.evaluate(e => e.getBoundingClientRect().height)).toBe(104)
  } finally {
    await context.close()
  }
})

test('all product sections keep the same tab positions on desktop', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.setViewportSize({ width: 1440, height: 900 })
  await branchPage(page, sections[0].path)
  const initialBoxes = await page.locator('#staff-page-header-navigation [role=tab]').evaluateAll(elements => elements.map(e => ({x: e.getBoundingClientRect().x, width: e.getBoundingClientRect().width})))
  for (const section of sections) {
    await page.locator(`#product-section-tab-${section.key}`).click()
    await expectSectionHeader(page, section)
    const boxes = await page.locator('#staff-page-header-navigation [role=tab]').evaluateAll(elements => elements.map(e => ({x: e.getBoundingClientRect().x, width: e.getBoundingClientRect().width})))
    expect(boxes).toEqual(initialBoxes)
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
  await expect(page.locator('#staff-header-actions #product-operations-link, #staff-header-actions #bulk-add-products, #staff-header-actions #create-product')).toHaveCount(3)

  await page.locator('#product-operations-link').click()
  await expect(page).toHaveURL(/\/products\/operations$/)
  await expect(page.locator('#copy-preview-form')).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/products\?search=header/)

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
  await expect.poll(() => actions.locator('#staff-header-actions-scroll').evaluate((element) => element.scrollWidth - element.clientWidth)).toBeGreaterThan(0)
  await expect(page.locator('#staff-header [data-scroll-left], #staff-header [data-scroll-right]')).toHaveCount(0)
  await expect(page.locator('#staff-header .staff-header-utilities')).toBeHidden()
  await expect.poll(() => page.locator('#header-home img:visible').evaluate((element) => element.getBoundingClientRect().left)).toBe(16)
  for (const rail of [page.locator('#staff-page-header-navigation-scroll'), actions]) {
    const viewport = rail.locator('[data-scroll-viewport]')
    await expect.poll(() => viewport.evaluate((element) => element.getBoundingClientRect().right)).toBe(390)
    await viewport.evaluate((element) => element.scrollTo({ left: 0, behavior: 'instant' }))
    await expect(rail).not.toHaveAttribute('data-scroll-has-left')
    await expect(rail).toHaveAttribute('data-scroll-has-right')
    await expect.poll(() => viewport.evaluate((element) => getComputedStyle(element).maskImage)).not.toBe('none')
    await viewport.evaluate((element) => element.scrollTo({ left: element.scrollWidth, behavior: 'instant' }))
    await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBeGreaterThan(1)
    await expect(rail).toHaveAttribute('data-scroll-has-left')
    await expect(rail).not.toHaveAttribute('data-scroll-has-right')
    await viewport.evaluate((element) => element.scrollTo({ left: 0, behavior: 'instant' }))
    await expect.poll(() => viewport.evaluate((element) => element.scrollLeft)).toBeLessThanOrEqual(1)
    await expect(rail).not.toHaveAttribute('data-scroll-has-left')
  }
  await actions.locator('#create-product').click()
  await expect(page.locator('#product-slideover-toggle')).toBeChecked()
})
