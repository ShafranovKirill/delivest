import { expect, test, type Page } from '@playwright/test'
import { selectPickupLocation } from '../support/pickup'

const path = (url: string) => new URL(url).pathname
const startupLegacy = new Set([
  '/client/franchise', '/client/branches', '/client/cart', '/client/orders/active', '/client/socket_token',
])

function collectClientGets(page: Page) {
  const paths: string[] = []
  page.on('request', request => {
    if (request.method() === 'GET' && path(request.url()).startsWith('/client/')) paths.push(path(request.url()))
  })
  return paths
}

test('known branch opens with one public and one private request, without public credentials', async ({ page, context }) => {
  await context.addCookies([{ name: 'bootstrap_marker', value: 'present', url: 'http://localhost:4100' }])
  const gets = collectClientGets(page)
  let publicHeaders: Record<string, string> | undefined
  await page.route('**/client/storefront/v1/bootstrap?*', async route => {
    publicHeaders = await route.request().allHeaders()
    await route.continue()
  })

  await page.goto('/e2e')
  await expect(page.getByRole('button', { name: 'Маргарита', exact: true })).toBeVisible()
  await expect.poll(() => gets.filter(value => value === '/client/session/bootstrap').length).toBe(1)

  expect(gets.filter(value => value === '/client/storefront/v1/bootstrap')).toHaveLength(1)
  expect(gets.filter(value => value === '/client/session/bootstrap')).toHaveLength(1)
  expect(gets.filter(value => startupLegacy.has(value))).toEqual([])
  expect(publicHeaders?.cookie).toBeUndefined()
  expect(publicHeaders?.authorization).toBeUndefined()
})

test('existing guest cart survives a reload and a failed private bootstrap uses legacy cart once', async ({ page }) => {
  await page.goto('/e2e')
  await page.getByRole('button', { name: '590 ₽' }).first().click()
  await expect(page.locator('header').getByRole('button', { name: '590 ₽' })).toBeVisible()

  const gets = collectClientGets(page)
  let failed = false
  await page.route('**/client/session/bootstrap?*', async route => {
    if (!failed) { failed = true; await route.fulfill({ status: 503, json: { error: 'unavailable' } }) }
    else await route.continue()
  })
  await page.reload()
  await expect(page.locator('header').getByRole('button', { name: '590 ₽' })).toBeVisible()
  expect(failed).toBe(true)
  expect(gets.filter(value => value === '/client/cart')).toHaveLength(1)
  await expect.poll(() => gets.filter(value => value === '/client/socket_token').length).toBe(1)

  gets.length = 0
  await page.unroute('**/client/session/bootstrap?*')
  await page.reload()
  await expect(page.locator('header').getByRole('button', { name: '590 ₽' })).toBeVisible()
  expect(gets.filter(value => value === '/client/cart')).toEqual([])
})

test('first add waits for a delayed private response and succeeds', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let started!: () => void
  const entered = new Promise<void>(resolve => { started = resolve })
  await page.route('**/client/session/bootstrap?*', async route => {
    started()
    await gate
    await route.continue()
  })

  try {
    await page.goto('/e2e')
    await entered
    const card = page.getByRole('button', { name: 'Маргарита', exact: true }).first()
    await expect(card).toBeVisible()
    await card.getByRole('button', { name: '590 ₽' }).click()
    release()
    await expect(page.locator('header').getByRole('button', { name: '590 ₽' })).toBeVisible()
  } finally { release() }
})

test('product route and warm checkout do not repeat private bootstrap or cart GET', async ({ page }) => {
  const gets = collectClientGets(page)
  await page.goto('/e2e')
  const card = page.getByRole('button', { name: 'Маргарита', exact: true }).first()
  await expect(card).toBeVisible()
  await card.click()
  await expect(page).toHaveURL(/\?product=/)
  await page.keyboard.press('Escape')
  await card.getByRole('button', { name: '590 ₽' }).click()
  await page.getByText('Заберу самостоятельно').click()
  await selectPickupLocation(page)
  await page.locator('header').getByRole('button', { name: '590 ₽' }).click()
  const cartGetsBefore = gets.filter(value => value === '/client/cart').length
  await page.getByRole('button', { name: 'К оформлению заказа' }).click()
  await expect(page).toHaveURL(/\/e2e\/checkout$/)
  await expect(page.getByRole('button', { name: 'Оформить заказ' })).toBeVisible()
  expect(gets.filter(value => value === '/client/session/bootstrap')).toHaveLength(1)
  expect(gets.filter(value => value === '/client/cart')).toHaveLength(cartGetsBefore)
})
