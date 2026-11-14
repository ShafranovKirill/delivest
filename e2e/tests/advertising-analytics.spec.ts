import type { Page } from '@playwright/test'
import { expect, test } from '../support/test'
import { adminUrl } from '../support/env'
import { advance, branchPage, expectStatus, orderCard, tagged } from '../support/staff'
import { placeOrder } from '../support/customer'

async function createLink(staff: Page) {
  await branchPage(staff, 'advertising-links')
  const slug = `e2e-${Date.now()}`
  await staff.locator('#advertising-link-form input[name="link[campaign]"]').fill(slug)
  await staff.locator('#advertising-link-form input[name="link[name]"]').fill(slug)
  await staff.locator('main #staff-header-actions button[form="advertising-link-form"]').click()
  const row = staff.locator('#advertising-links > div', { hasText: slug })
  await expect(row).toBeVisible()
  const url = await row.locator('input[readonly]').inputValue()
  expect(url).toMatch(/^http:\/\/localhost:4100\/r\/[A-Za-z0-9_-]+$/)
  const linkId = (await row.locator('button[id^="advertising-copy-"]').getAttribute('id'))!
    .replace('advertising-copy-', '')
  return { row, url, linkId, slug }
}

async function rebuildUntilVisible(page: Page, path: string, selector: string) {
  await branchPage(page, path)
  await expect(page.locator('#statistics-report')).toBeVisible()
  await page.locator('#statistics-rebuild').click()
  await expect.poll(async () => {
    await page.reload()
    await page.locator('[data-phx-main].phx-connected').waitFor()
    return page.locator(selector).count()
  }, { timeout: 90_000, intervals: [500, 1_000, 2_000] }).toBeGreaterThan(0)
}

async function selectStaffTheme(page: Page, theme: 'light' | 'dark') {
  if (await page.locator('html').getAttribute('data-theme') === theme) return
  const profile = page.locator('#staff-profile-trigger')
  await profile.click()
  await page.locator(`#header-theme-${theme}`).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
  await profile.click()
}

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth),
  { timeout: 5_000 }).toBeLessThanOrEqual(1)
}

test('staff copy link reports success and browser refusal without page errors', async ({ staff }) => {
  const admin = await staff('e2e_admin')
  const errors: Error[] = []
  admin.on('pageerror', (error) => errors.push(error))
  const { row, url } = await createLink(admin)
  const button = row.locator('button[id^="advertising-copy-"]')
  const status = row.locator('[id^="advertising-copy-status-"]')

  await admin.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await button.click()
  await expect(status).toContainText('Ссылка скопирована')
  expect(await admin.evaluate(() => navigator.clipboard.readText())).toBe(url)

  await admin.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error('denied')) },
    })
  })
  await button.click()
  await expect(status).toContainText('Не удалось скопировать ссылку')
  await expect(row.locator('input[readonly]')).toHaveValue(url)
  expect(errors).toEqual([])
})

test('optional analytics requests failing do not block cash checkout', async ({ page }) => {
  const errors: Error[] = []
  page.on('pageerror', (error) => errors.push(error))
  let blocked = 0
  await page.route('**/client/analytics/**', async (route) => {
    blocked += 1
    await route.abort()
  })

  const number = await placeOrder(page, 'pickup')
  expect(blocked).toBeGreaterThan(0)
  await expect(page.getByText(`Заказ ${number}`)).toHaveCount(1)
  expect(errors).toEqual([])
})

test('advertising redirect, verified phone, checkout and OMS completion preserve the source', async ({
  page,
  staff,
}) => {
  const admin = await staff('e2e_admin')
  const errors: Error[] = []
  admin.on('pageerror', (error) => errors.push(error))
  const { url, linkId, slug } = await createLink(admin)

  await page.goto(url)
  await expect(page).toHaveURL(/localhost:3100\/e2e\/?$/)
  expect((await page.context().cookies()).some((cookie) => cookie.name === 'analytics_owner')).toBe(true)

  const unique = String(Date.now() % 10_000_000).padStart(7, '0')
  const phone = `+7994${unique}`
  await page.locator('header').getByRole('button', { name: 'Войти' }).click()
  const confirmed = page.waitForResponse((response) =>
    /\/client\/auth\/call\/[^/]+\/complete$/.test(new URL(response.url()).pathname) &&
    response.status() === 200,
  )
  await page.getByRole('dialog').locator('input[name="phone"]').fill(phone)
  await page.getByRole('button', { name: 'Продолжить' }).click()
  await confirmed
  await expect(page.locator('header').getByRole('button', { name: 'Профиль' })).toBeVisible()

  await page.getByRole('button', { name: '590 ₽' }).click()
  await page.getByText('Заберу самостоятельно').click()
  await page.getByRole('button', { name: 'Заказать сюда' }).click()
  await page.locator('header').getByRole('button', { name: '590 ₽' }).click()
  await page.getByRole('button', { name: 'К оформлению заказа' }).click()
  await expect(page).toHaveURL(/\/e2e\/checkout$/)
  const phoneInput = page.locator('input[name="phone"]')
  if (await phoneInput.isVisible()) await phoneInput.fill(phone)
  await page.getByRole('button', { name: 'Оформить заказ' }).click()
  await expect(page).toHaveURL(/\/e2e\/checkout\/order\/[0-9a-f-]+$/)
  const orderUrl = page.url()
  const orderNumber = (await page.getByText(/^Заказ \d+$/).innerText()).replace('Заказ ', '')
  await page.reload()
  await expect(page).toHaveURL(orderUrl)
  await expect(page.getByText(`Заказ ${orderNumber}`)).toBeVisible()

  const operator = await staff('e2e_operator')
  await branchPage(operator, 'orders')
  const card = orderCard(operator, orderNumber)
  await expect(card).toHaveCount(1)
  await advance(card, 'Подтвердить')
  await expectStatus(card, 'Готовится')
  const kitchen = await staff('e2e_kitchen')
  await branchPage(kitchen, 'kitchen')
  await kitchen.locator('[id^="ticket-"]', { hasText: tagged(orderNumber) })
    .locator('[id^="ready-"]').click()
  await expectStatus(card, 'Готов', 30_000)
  await advance(card, 'Выдан')
  await expectStatus(card, 'Выполнен')

  await rebuildUntilVisible(admin, `statistics?tab=sources&period=today&link_id=${linkId}`,
    '#statistics-report-table tbody tr')
  const source = admin.locator('#statistics-report-table tbody tr', { hasText: slug })
  await expect.poll(async () => {
    await admin.reload()
    await admin.locator('[data-phx-main].phx-connected').waitFor()
    if (await source.count() !== 1) return 0
    const values = await source.locator('td').allInnerTexts()
    if (values.length < 5) return 0
    return Math.min(...values.slice(1, 5).map(Number))
  }, { timeout: 90_000, intervals: [500, 1_000, 2_000] }).toBeGreaterThanOrEqual(1)
  for (const column of [1, 2, 3, 4]) {
    expect(Number(await source.locator('td').nth(column).innerText())).toBeGreaterThanOrEqual(1)
  }

  await admin.setViewportSize({ width: 1280, height: 800 })
  await selectStaffTheme(admin, 'light')
  await expectNoHorizontalOverflow(admin)
  await test.info().attach('sources-light-ru', {
    body: await admin.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png',
  })
  await selectStaffTheme(admin, 'dark')
  await expectNoHorizontalOverflow(admin)
  await test.info().attach('sources-dark-ru', {
    body: await admin.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png',
  })
  await admin.setViewportSize({ width: 390, height: 844 })
  await expectNoHorizontalOverflow(admin)
  await test.info().attach('sources-dark-mobile-ru', {
    body: await admin.screenshot({ fullPage: true, animations: 'disabled' }), contentType: 'image/png',
  })

  await rebuildUntilVisible(admin, 'statistics?tab=funnel&period=today', '#statistics-funnel-path')
  await expect(admin.locator('#statistics-funnel-outcomes')).toBeVisible()

  await rebuildUntilVisible(admin, 'statistics?tab=channels&period=today&channel=app',
    '#statistics-report-table tbody tr')
  await expect(admin.locator('#statistics-report-summary')).toBeVisible()

  await branchPage(admin, 'statistics?tab=franchise&period=today')
  await expect(admin.locator('tbody#statistics-branch-comparison tr', { hasText: 'E2E' }))
    .toBeVisible()
  await expectNoHorizontalOverflow(admin)
  expect(errors).toEqual([])
  expect(url).toContain(`${adminUrl}/r/`)
})
