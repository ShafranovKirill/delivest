import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

type Theme = 'light' | 'dark'

async function serveFranchiseTheme(page: Page, theme: Theme) {
  await page.route('**/client/franchise', async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    body.data.default_theme = theme
    await route.fulfill({ response, json: body })
  })
}

async function openMobileMenu(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/e2e')
  await page.locator('#mobile-menu-button').click()
  await expect(page.locator('#mobile-sidebar')).toBeVisible()
}

test('new visitor receives the franchise dark theme without a personal preference', async ({ page }) => {
  await serveFranchiseTheme(page, 'dark')
  await page.goto('/e2e')

  await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  expect(await page.evaluate(() => localStorage.getItem('delivest-theme'))).toBeNull()
})

test('mobile theme toggle persists a personal choice over the franchise default', async ({ page }) => {
  await serveFranchiseTheme(page, 'dark')
  await openMobileMenu(page)
  await expect(page.locator('html')).toHaveClass(/\bdark\b/)

  await page.locator('#mobile-sidebar').getByRole('button', { name: 'Тема' }).click()
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/)
  expect(await page.evaluate(() => localStorage.getItem('delivest-theme'))).toBe('light')

  const refreshed = page.waitForResponse(/\/client\/franchise$/)
  await page.reload()
  await refreshed
  await expect(page.locator('html')).not.toHaveClass(/\bdark\b/)
  expect(await page.evaluate(() => localStorage.getItem('delivest-theme'))).toBe('light')
})

test('cached franchise theme follows a delayed server refresh until the visitor chooses', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('franchise', JSON.stringify({ franchise: { default_theme: 'light' } }))
  })

  let releaseRefresh!: () => void
  const refreshGate = new Promise<void>((resolve) => { releaseRefresh = resolve })
  let refreshStarted!: () => void
  const started = new Promise<void>((resolve) => { refreshStarted = resolve })
  await page.route('**/client/franchise', async (route) => {
    refreshStarted()
    await refreshGate
    const response = await route.fetch()
    const body = await response.json()
    body.data.default_theme = 'dark'
    await route.fulfill({ response, json: body })
  })

  await page.goto('/e2e', { waitUntil: 'domcontentloaded' })
  await started
  await expect(page.locator('.boot')).toBeVisible()
  await expect(page.locator('.boot-scooter')).toBeVisible()
  await expect(page.locator('header')).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('delivest-theme'))).toBeNull()

  releaseRefresh()
  await expect(page.locator('header')).toBeVisible()
  await expect(page.locator('html')).toHaveClass(/\bdark\b/)
  expect(await page.evaluate(() => localStorage.getItem('delivest-theme'))).toBeNull()
})

test('mobile drawer locks background scrolling and restores it after closing', async ({ page }) => {
  await serveFranchiseTheme(page, 'light')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/e2e')
  await expect(page.locator('[id^="category-"]').first()).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 300))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)

  await page.locator('#mobile-menu-button').click()
  await expect(page.locator('#mobile-sidebar')).toBeVisible()
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden')
  const lockedPosition = await page.evaluate(() => window.scrollY)
  await page.mouse.move(20, 400)
  await page.mouse.wheel(0, -150)
  await page.waitForTimeout(200)
  expect(await page.evaluate(() => window.scrollY)).toBe(lockedPosition)

  await page.locator('#mobile-sidebar .p-drawer-close-button').click()
  await expect(page.locator('#mobile-sidebar')).toBeHidden()
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden')
  await page.mouse.wheel(0, -150)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(lockedPosition)
})

test('empty delayed stories do not move the category bar after the menu has loaded', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  let releaseStocks!: () => void
  const stockGate = new Promise<void>((resolve) => { releaseStocks = resolve })
  let stocksStarted!: () => void
  const started = new Promise<void>((resolve) => { stocksStarted = resolve })

  await page.route(/\/client\/[^/]+\/stocks(?:\?|$)/, async (route) => {
    stocksStarted()
    await stockGate
    const response = await route.fetch()
    const body = await response.json()
    body.data = []
    await route.fulfill({ response, json: body })
  })

  await page.goto('/e2e', { waitUntil: 'domcontentloaded' })
  await started
  await expect(page.locator('[id^="category-"]').first()).toBeVisible()
  const categoryBar = page.locator('main .sticky').first()
  const before = await categoryBar.boundingBox()
  expect(before).not.toBeNull()
  expect(await page.locator('main > div:first-child .p-skeleton').count()).toBe(0)

  const stocksFinished = page.waitForResponse(/\/client\/[^/]+\/stocks(?:\?|$)/)
  releaseStocks()
  await stocksFinished
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
  const after = await categoryBar.boundingBox()
  expect(after).not.toBeNull()
  expect(Math.abs(after!.y - before!.y)).toBeLessThan(2)
})
