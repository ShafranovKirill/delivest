import { expect, type Page } from '@playwright/test'
import { branchPage } from '../support/staff'
import { test } from '../support/test'
import { adminUrl } from '../support/env'

type Section = {
  path: string
  key: string
  title: string
  action?: string
}

const sections: Section[] = [
  { path: 'products', key: 'products', title: 'Товары', action: '#create-product' },
  { path: 'products/stops', key: 'stops', title: 'Стоп-лист' },
  { path: 'products/modifiers', key: 'modifiers', title: 'Модификаторы', action: 'button[phx-click="new_group"]' },
  { path: 'products/tags', key: 'tags', title: 'Теги', action: 'a[href$="/products/tags/new"]' },
  { path: 'products/suggested', key: 'suggested', title: 'Рекомендуемые' },
  { path: 'menu/popular', key: 'popular', title: 'Популярные товары', action: 'button[form="popular-settings"]' },
]

async function expectSectionPage(page: Page, section: Section) {
  const header = page.locator('main #staff-page-header')
  const nav = page.locator('main #staff-section-navigation')
  const actions = header.locator('#staff-header-actions')
  const selected = nav.locator(`#product-section-tab-${section.key}`)

  await expect(page.locator('#staff-header h1')).toHaveCount(0)
  await expect(page.locator('main h1:visible')).toHaveCount(1)
  await expect(header.locator('h1:visible')).toHaveText(section.title)
  await expect(nav.locator('[id^="product-section-tab-"]')).toHaveCount(sections.length + 1)
  await expect(selected).toHaveAttribute('aria-current', 'page')
  await expect(nav.locator('[aria-current="page"]')).toHaveCount(1)
  if (section.action) await expect(actions.locator(section.action)).toBeVisible()
  else await expect(actions).toHaveCount(0)
  await expect.poll(() => page.locator('#staff-header').evaluate((element) =>
    Math.round(element.getBoundingClientRect().height),
  )).toBe(56)
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(1)
  await expect.poll(() => nav.evaluate((element) => {
    const tab = element.querySelector('[aria-current="page"]')!.getBoundingClientRect()
    const viewport = element.getBoundingClientRect()
    return tab.left >= viewport.left - 1 && tab.right <= viewport.right + 1
  })).toBe(true)
}

test('product tabs and page title render before JavaScript connects', async ({ browser, staff }) => {
  const authenticated = await staff('e2e_admin')
  const context = await browser.newContext({
    storageState: await authenticated.context().storageState(),
    javaScriptEnabled: false,
  })
  try {
    const page = await context.newPage()
    await page.goto(`${adminUrl}/staff/b/e2e/products/tags`)
    const header = page.locator('main #staff-page-header')
    await expect(header.locator('h1:visible')).toHaveText('Теги')
    await expect(page.locator('main #staff-section-navigation [id^="product-section-tab-"]')).toHaveCount(sections.length + 1)
    await expect(page.locator('main #product-section-tab-tags')).toHaveAttribute('aria-current', 'page')
    await expect(header.locator('#staff-header-actions a[href$="/products/tags/new"]')).toBeVisible()
    await expect.poll(() => page.locator('#staff-header').evaluate(e =>
      Math.round(e.getBoundingClientRect().height),
    )).toBe(56)
  } finally {
    await context.close()
  }
})

test('all product sections keep selected local navigation and actions', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.setViewportSize({ width: 1440, height: 900 })
  await branchPage(page, sections[0].path)
  const initialTabs = await page.locator('main #staff-section-navigation [id^="product-section-tab-"]').evaluateAll(elements =>
    elements.map(element => element.id))
  for (const section of sections) {
    await page.locator(`#product-section-tab-${section.key}`).click()
    await expectSectionPage(page, section)
    await expect(page).toHaveURL(new RegExp(`/staff/b/e2e/${section.path}$`))
    const tabs = await page.locator('main #staff-section-navigation [id^="product-section-tab-"]').evaluateAll(elements =>
      elements.map(element => element.id))
    expect(tabs).toEqual(initialTabs)
  }

  await branchPage(page, 'products/modifiers')
  await page.locator('main #staff-header-actions button[phx-click="new_group"]').click()
  await expect(page.locator('#group-form')).toBeVisible()

  await branchPage(page, 'products/tags')
  await page.locator('main #staff-header-actions a[href$="/products/tags/new"]').click()
  await expect(page.locator('#product-tag-form')).toBeVisible()
})

test('product actions and query survive page navigation', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.setViewportSize({ width: 1440, height: 900 })
  await branchPage(page, 'products?search=header')
  await expectSectionPage(page, sections[0])
  await expect(page.locator('main #products-filter')).toBeVisible()
  await expect(page.locator('main #staff-header-actions #create-product')).toBeVisible()
  const more = page.locator('main #product-more-actions')
  await more.locator('summary').focus()
  await page.keyboard.press('Enter')
  await expect(more).toHaveAttribute('open', '')
  await expect(more.locator('#product-operations-link')).toBeVisible()
  await expect(more.locator('#bulk-add-products')).toBeVisible()
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(1)

  await page.locator('#product-operations-link').click()
  await expect(page).toHaveURL(/\/products\/operations$/)
  await expect(page.locator('#copy-preview-form')).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(/\/products\?search=header/)

  await page.locator('#create-product').click()
  await expect(page).toHaveURL(/\/products\/new\?.*search=header/)
  await expect(page.locator('#product-slideover-toggle')).toBeChecked()
  await expectSectionPage(page, sections[0])
  await page.locator('.drawer:has(#product-slideover-toggle) .drawer-side > div > div:first-child button').click()
  await expect(page).toHaveURL(/\/products\?.*search=header/)
})

test('mobile keeps selected product tab visible in local navigation', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.setViewportSize({ width: 390, height: 844 })
  for (const section of sections) {
    await branchPage(page, section.path)
    await expectSectionPage(page, section)
  }
  await branchPage(page, 'products')
  await page.locator('#product-more-actions summary').click()
  await expect(page.locator('#product-more-actions #product-operations-link')).toBeVisible()
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(1)
  const nav = page.locator('main #staff-section-navigation')
  await expect.poll(() => nav.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeGreaterThan(0)
  await nav.evaluate((element) => element.scrollTo({ left: element.scrollWidth, behavior: 'instant' }))
  await expect.poll(() => nav.evaluate((element) => element.scrollLeft)).toBeGreaterThan(1)
  await nav.evaluate((element) => element.scrollTo({ left: 0, behavior: 'instant' }))
  await expect.poll(() => nav.evaluate((element) => element.scrollLeft)).toBeLessThanOrEqual(1)
  await page.locator('main #staff-header-actions #create-product').click()
  await expect(page.locator('#product-slideover-toggle')).toBeChecked()
})
