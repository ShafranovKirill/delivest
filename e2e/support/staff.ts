import { expect, type Browser, type Locator, type Page } from '@playwright/test'
import { adminUrl, branchSlug, staffPassword } from './env'

export const signIn = async (browser: Browser, login: string) => {
  const context = await browser.newContext({ locale: 'ru-RU', timezoneId: 'Europe/Moscow' })
  const page = await context.newPage()
  await page.goto(`${adminUrl}/staff/auth/login`)
  await page.locator('#user_login').fill(login)
  await page.locator('#user_password').fill(staffPassword)
  await page.locator('#user_password').press('Enter')
  await page.waitForURL((url) => !url.pathname.startsWith('/staff/auth'))
  await page.waitForLoadState('networkidle')
  return page
}

export const branchPage = (page: Page, path: string) =>
  page.goto(`${adminUrl}/staff/b/${branchSlug}/${path}`)

export const tagged = (number: string) => new RegExp(`#${number}(?!\\d)`)

export const orderCard = (page: Page, number: string) =>
  page.locator('article', { hasText: tagged(number) })

export const expectStatus = (card: Locator, status: string, timeout = 15_000) =>
  expect(card.locator('[id^="order-status-"]')).toHaveText(status, { timeout })

export const advance = async (card: Locator, label: string) => {
  const next = card.locator('[id^="order-next-"]')
  await expect(next).toContainText(label)
  await next.click()
}
