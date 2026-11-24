import { expect, type Page } from '@playwright/test'
import { branchPage } from '../support/staff'
import { test } from '../support/test'
import { adminUrl } from '../support/env'

type Section = {
  path: string
  key: string
  toolbar: string
  title: string
  action?: string
}

const sections: Section[] = [
  { path: 'products', key: 'products', toolbar: 'products-toolbar', title: 'Товары', action: '#create-product' },
  { path: 'products/stops', key: 'stops', toolbar: 'stop-list-toolbar', title: 'Стоп-лист', action: '#stop-add-products' },
  { path: 'products/modifiers', key: 'modifiers', toolbar: 'modifiers-toolbar', title: 'Модификаторы', action: 'button[phx-click="new_group"]' },
  { path: 'products/tags', key: 'tags', toolbar: 'tags-toolbar', title: 'Теги', action: 'a[href$="/products/tags/new"]' },
  { path: 'products/collections', key: 'collections', toolbar: 'collections-toolbar', title: 'Подборки' },
]

const productNavigation = (page: Page) =>
  page.locator('#staff-section-navigation:visible, #sidebar-staff-section-navigation:visible')

async function expectSectionPage(page: Page, section: Section) {
  const toolbar = page.locator(`main #${section.toolbar}.staff-page-toolbar`)
  const nav = productNavigation(page)
  const actions = toolbar.locator('.staff-page-toolbar-actions')
  const selected = nav.locator(`[id$="product-section-tab-${section.key}"]`)

  await expect(page.locator('#staff-header h1')).toHaveCount(0)
  await expect(page.locator('main h1:not(.sr-only):visible')).toHaveCount(0)
  await expect(toolbar.locator('h1.sr-only')).toHaveText(section.title)
  await expect(nav.locator('[id*="product-section-tab-"]')).toHaveCount(sections.length + 1)
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
    const toolbar = page.locator('main #tags-toolbar.staff-page-toolbar')
    await expect(page.locator('main h1:not(.sr-only):visible')).toHaveCount(0)
    await expect(toolbar.locator('h1.sr-only')).toHaveText('Теги')
    await expect(productNavigation(page).locator('[id*="product-section-tab-"]')).toHaveCount(sections.length + 1)
    await expect(productNavigation(page).locator('[id$="product-section-tab-tags"]')).toHaveAttribute('aria-current', 'page')
    await expect(toolbar.locator('.staff-page-toolbar-actions a[href$="/products/tags/new"]')).toBeVisible()
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
  const initialTabs = await productNavigation(page).locator('[id*="product-section-tab-"]').evaluateAll(elements =>
    elements.map(element => element.id))
  for (const section of sections) {
    await productNavigation(page).locator(`[id$="product-section-tab-${section.key}"]`).click()
    await expectSectionPage(page, section)
    await expect(page).toHaveURL(new RegExp(`/staff/b/e2e/${section.path}$`))
    const tabs = await productNavigation(page).locator('[id*="product-section-tab-"]').evaluateAll(elements =>
      elements.map(element => element.id))
    expect(tabs).toEqual(initialTabs)
  }

  await branchPage(page, 'products/modifiers')
  await page.locator('main #modifiers-toolbar .staff-page-toolbar-actions button[phx-click="new_group"]').click()
  await expect(page.locator('#group-form')).toBeVisible()

  await branchPage(page, 'products/tags')
  await page.locator('main #tags-toolbar .staff-page-toolbar-actions a[href$="/products/tags/new"]').click()
  await expect(page.locator('#product-tag-form')).toBeVisible()
})

test('collections open separate popular and recommended settings', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await branchPage(page, 'products/collections')
  await expect(page.locator('#collections-popular a[href$="/menu/popular"]')).toBeVisible()
  await expect(page.locator('#collections-suggested a[href$="/products/suggested"]')).toBeVisible()

  await page.locator('#collections-popular a').click()
  await expect(productNavigation(page).locator('[id$="product-section-tab-collections"]')).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('#popular-toolbar a[href$="/products/collections"]')).toBeVisible()
  await expect(page.locator('#collections-tab-suggested')).toHaveCount(0)
  await expect(page.locator('#popular-toolbar button[form="popular-settings"]')).toBeVisible()

  await page.locator('#popular-toolbar a[href$="/products/collections"]').click()
  await expect(page.locator('#collections-suggested a[href$="/products/suggested"]')).toBeVisible()
  await page.locator('#collections-suggested a').click()
  await expect(productNavigation(page).locator('[id$="product-section-tab-collections"]')).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('#suggested-toolbar a[href$="/products/collections"]')).toBeVisible()
  await expect(page.locator('#collections-tab-popular')).toHaveCount(0)
  await expect(page.locator('#suggested-add-products')).toBeVisible()
  await page.locator('#suggested-toolbar a[href$="/products/collections"]').click()
  await expect(page.locator('#collections-popular a[href$="/menu/popular"]')).toBeVisible()
})

test('product actions and query survive page navigation', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.setViewportSize({ width: 1440, height: 900 })
  await branchPage(page, 'products?search=header')
  await expectSectionPage(page, sections[0])
  await expect(page.locator('main #products-filter')).toBeVisible()
  await expect(page.locator('main #products-toolbar .staff-page-toolbar-actions #create-product')).toBeVisible()
  await expect(page.locator('#products-filter button[type="submit"]')).toHaveCount(0)
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
  await expect(page).toHaveURL(/\/products\/operations\?.*search=header/)
  await expect(page.locator('#copy-preview-form')).toBeVisible()
  await page.locator('#product-operations-back').click()
  await expect(page).toHaveURL(/\/products\?.*search=header/)

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
  const nav = productNavigation(page)
  await expect.poll(() => nav.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeGreaterThan(0)
  await nav.evaluate((element) => element.scrollTo({ left: element.scrollWidth, behavior: 'instant' }))
  await expect.poll(() => nav.evaluate((element) => element.scrollLeft)).toBeGreaterThan(1)
  await nav.evaluate((element) => element.scrollTo({ left: 0, behavior: 'instant' }))
  await expect.poll(() => nav.evaluate((element) => element.scrollLeft)).toBeLessThanOrEqual(1)
  await page.locator('main #products-toolbar .staff-page-toolbar-actions #create-product').click()
  await expect(page.locator('#product-slideover-toggle')).toBeChecked()
})

test('sidebar accordion saves desktop width and hidden sidebar keeps the navigation row', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.setViewportSize({ width: 390, height: 844 })
  await branchPage(page, 'products')
  const navigation = page.locator('#staff-context-navigation')
  const header = page.locator('#staff-header')

  await expect.poll(() => navigation.evaluate(element => {
    const box = element.getBoundingClientRect()
    return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width) }
  })).toEqual({ x: 0, y: 56, width: 390 })
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await expect.poll(async () => (await navigation.boundingBox())?.y).toBe(56)
  await expect.poll(async () => (await header.boundingBox())?.y).toBe(0)
  await page.screenshot({ path: test.info().outputPath('navigation-mobile.png'), animations: 'disabled' })

  for (const width of [1440, 1920]) {
    await page.setViewportSize({ width, height: 1080 })
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(navigation).toBeHidden()
    await expect(page.locator('#main-sidebar #sidebar-product-section-tab-products')).toBeVisible()
    await expect(page.locator('#main-sidebar #sidebar-product-section-tab-products')).toHaveAttribute('aria-current', 'page')
    expect(await page.evaluate(() => {
      const ids = [...document.querySelectorAll('#main-sidebar [id], #staff-context-navigation [id]')]
        .map(element => element.id)
      return ids.filter((id, index) => ids.indexOf(id) !== index)
    })).toEqual([])
    const main = await page.locator('#main-sidebar').boundingBox()
    const parent = await page.locator('#sidebar-group-menu-toggle').boundingBox()
    const child = await page.locator('#sidebar-product-section-tab-products').boundingBox()
    expect(child!.y).toBeGreaterThanOrEqual(parent!.y + parent!.height)
    expect(child!.x).toBeGreaterThan(parent!.x)
    expect(child!.x + child!.width).toBeLessThanOrEqual(main!.x + main!.width)
    const content = await page.locator('main > div').boundingBox()
    expect(content!.x).toBeLessThan(main!.x + main!.width + 32)
    expect(content!.x + content!.width).toBeGreaterThan(width - 40)
  }
  await expect(page.locator('#sidebar-group-menu')).toHaveAttribute('open', '')
  await page.locator('#sidebar-group-menu-toggle').click()
  await expect(page.locator('#sidebar-product-section-tab-products')).toBeHidden()
  await page.locator('#products-filter input[name="search"]').fill('Пепперони')
  await expect(page).toHaveURL(/search=/)
  await expect(page.locator('#sidebar-group-menu')).not.toHaveAttribute('open', '')
  await expect(page.locator('#sidebar-product-section-tab-products')).toBeHidden()
  await page.locator('#products-filter input[name="search"]').fill('')
  await expect.poll(() => new URL(page.url()).searchParams.has('search')).toBe(false)
  await page.locator('#sidebar-group-menu-toggle').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#sidebar-product-section-tab-products')).toBeVisible()
  await page.locator('#sidebar-group-delivery-toggle').click()
  await expect(page.locator('#sidebar-group-delivery')).toHaveAttribute('open', '')
  await expect(page.locator('#sidebar-section-nav-couriers')).toBeVisible()
  await expect(page.locator('#sidebar-group-menu')).toHaveAttribute('open', '')
  await page.locator('#products-filter input[name="search"]').fill('Пепперони')
  await expect(page).toHaveURL(/search=/)
  await expect(page.locator('#sidebar-group-delivery')).toHaveAttribute('open', '')
  await expect(page.locator('#sidebar-group-menu')).toHaveAttribute('open', '')
  await page.locator('#products-filter input[name="search"]').fill('')
  await expect.poll(() => new URL(page.url()).searchParams.has('search')).toBe(false)
  await page.locator('#sidebar-group-delivery-toggle').click()
  await expect(page.locator('#sidebar-section-nav-deliveries')).toBeHidden()
  await expect(page.locator('#sidebar-section-nav-couriers')).toBeHidden()
  await page.screenshot({ path: test.info().outputPath('navigation-desktop-accordion.png'), animations: 'disabled' })

  await page.locator('#sidebar-toggle').click()
  await expect(page.locator('#main-sidebar')).toBeHidden()
  await expect(navigation).toBeVisible()
  await expect.poll(async () => (await navigation.boundingBox())?.x).toBe(0)
  await expect.poll(async () => (await navigation.boundingBox())?.width).toBe(1920)
  await expect.poll(async () => (await navigation.boundingBox())?.y).toBe(56)
  await page.screenshot({ path: test.info().outputPath('navigation-desktop-hidden-sidebar.png'), animations: 'disabled' })
  await page.locator('#header-sidebar-toggle').click()
  await expect(page.locator('#main-sidebar')).toBeVisible()
  await expect(navigation).toBeHidden()

  await page.locator('#sidebar-group-delivery-toggle').click()
  await page.locator('#sidebar-section-nav-deliveries').click()
  await expect(page).toHaveURL(/\/deliveries$/)
  await expect(page.locator('#sidebar-group-delivery')).toHaveAttribute('open', '')
  const deliveryNav = page.locator('#sidebar-staff-section-navigation')
  await expect(deliveryNav.locator('a')).toHaveCount(2)
  await expect(page.locator('#sidebar-section-nav-deliveries')).toBeVisible()
  await expect(page.locator('#sidebar-section-nav-couriers')).toBeVisible()
  await expect(deliveryNav.locator('a[href$="/delivery/zones"]')).toHaveCount(0)
  await branchPage(page, 'delivery/zones')
  await expect(page.getByRole('heading', { name: 'Зоны доставки' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Назад' })).toHaveAttribute('href', '/staff/b/e2e/delivery')
})

test('product row actions stay accessible on the left of a horizontally scrolled table', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.setViewportSize({ width: 1024, height: 900 })
  await branchPage(page, 'products')
  await page.locator('.staff-column-chooser summary').click()
  for (const column of await page.locator('#products-columns input:not([disabled])').all()) {
    await column.check()
  }
  const row = page.locator('tbody#products tr[id]').first()
  const edit = row.locator('[id^="product-edit-"]')
  const remove = row.locator('[id^="product-delete-"]')
  await expect(edit).toBeVisible()
  await expect(remove).toBeVisible()
  await expect(row.locator('[id^="product-row-more-"]')).toHaveCount(0)
  const initialX = (await edit.boundingBox())!.x
  const scroller = row.locator('xpath=ancestor::table/parent::*')
  await scroller.evaluate(element => { element.scrollLeft = element.scrollWidth })
  await expect.poll(() => scroller.evaluate(element => element.scrollLeft)).toBeGreaterThan(0)
  await expect.poll(async () => Math.round((await edit.boundingBox())!.x - initialX)).toBe(0)
  const editBox = await edit.boundingBox()
  expect(editBox!.x).toBeGreaterThanOrEqual(0)
  expect(editBox!.x + editBox!.width).toBeLessThanOrEqual(1024)
  await edit.click()
  await expect(page).toHaveURL(/\/products\/[^/]+\/edit/)
})

for (const width of [1440, 390]) {
  test(`product selection takes no space until enabled at width ${width}`, async ({ staff }) => {
    const page = await staff('e2e_admin')
    await page.setViewportSize({ width, height: 900 })
    await branchPage(page, 'products')
    const row = page.locator('tbody#products tr[id]').first()
    const boxes = page.locator('input[type="checkbox"][form="product-selection"]')
    await expect(boxes).toHaveCount(0)
    await expect(row.locator('td').first()).toBeHidden()
    await expect(row.locator('[id^="product-edit-"]')).toBeVisible()
    const more = page.locator('#product-more-actions')
    await more.locator('summary').click()
    await page.locator('#product-toggle-selection').click()
    const checkbox = row.locator('input[type="checkbox"][form="product-selection"]')
    await expect(checkbox).toBeVisible()
    await checkbox.check()
    await expect(page.locator('#product-selection-bar')).toBeVisible()
    await more.locator('summary').click()
    await page.locator('#product-toggle-selection').click()
    await expect(boxes).toHaveCount(0)
    await expect(row.locator('td').first()).toBeHidden()
    await expect(page.locator('#product-selection-bar')).toHaveCount(0)
    await more.locator('summary').click()
    await page.locator('#product-toggle-selection').click()
    await expect(checkbox).not.toBeChecked()
    await page.screenshot({ path: test.info().outputPath('product-selection-mode.png'), animations: 'disabled' })
  })
}
