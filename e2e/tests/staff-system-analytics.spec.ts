import { expect } from '@playwright/test'
import { adminUrl } from '../support/env'
import { branchPage } from '../support/staff'
import { test } from '../support/test'

test('data and system exposes metrics, journal, raw logs and errors', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${adminUrl}/staff/diagnostics`)
  await page.locator('[data-phx-main].phx-connected').waitFor()
  const sidebar = page.locator('#main-sidebar')

  for (const path of ['/staff/logs/errors', '/staff/logs', '/staff/logs/raw', '/staff/diagnostics']) {
    const link = sidebar.locator(`a[href="${path}"]`)
    await expect(link).toHaveCount(1)
    await link.click()
    await expect(page).toHaveURL(`${adminUrl}${path}`)
    await expect(sidebar.locator(`a[href="${path}"]`)).toHaveAttribute('aria-current', 'page')
  }

  await page.setViewportSize({ width: 390, height: 844 })
  const errorLink = page.locator('#staff-context-navigation a[href="/staff/logs/errors"]')
  await expect(errorLink).toHaveCount(1)
  await errorLink.click()
  await expect(page).toHaveURL(`${adminUrl}/staff/logs/errors`)
  await expect(errorLink).toHaveAttribute('aria-current', 'page')
})

test('Frontpad is a CRM provider within integrations without a duplicate settings item', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.setViewportSize({ width: 1440, height: 900 })
  await branchPage(page, 'integrations')
  await expect(page.locator('#settings-nav-frontpad, #sidebar-settings-nav-frontpad')).toHaveCount(0)
  const frontpad = page.locator('main a[href="/staff/b/e2e/integrations/frontpad"]')
  await expect(frontpad).toHaveCount(1)
  await frontpad.click()
  await expect(page).toHaveURL(`${adminUrl}/staff/b/e2e/integrations/frontpad`)
  await expect(page.locator('#sidebar-settings-nav-integrations')).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('#settings-nav-frontpad, #sidebar-settings-nav-frontpad')).toHaveCount(0)
})

test('branch analytics opens franchise statistics with the same period and no branch restriction', async ({ staff }) => {
  const page = await staff('e2e_admin')
  const branchReport = 'statistics?tab=sales&period=custom&from=2026-11-01&to=2026-11-14'
  await page.setViewportSize({ width: 1440, height: 900 })
  await branchPage(page, branchReport)
  const franchise = page.locator('#main-sidebar a[href*="tab=franchise"]')
  await expect(franchise).toHaveCount(1)
  const target = new URL((await franchise.getAttribute('href'))!, adminUrl)
  expect(target.pathname).toBe('/staff/statistics')
  expect(target.searchParams.get('period')).toBe('custom')
  expect(target.searchParams.get('from')).toBe('2026-11-01')
  expect(target.searchParams.get('to')).toBe('2026-11-14')
  expect(target.searchParams.has('branch_id')).toBe(false)
  expect(target.searchParams.has('branch_ids')).toBe(false)
  await franchise.click()
  await expect(page).toHaveURL(target.href)
  await expect(page.locator('main #staff-page-header')).toContainText('Все филиалы')

  await page.setViewportSize({ width: 390, height: 844 })
  await branchPage(page, branchReport)
  await page.locator('#staff-context-navigation a[href*="tab=franchise"]').click()
  await expect(page).toHaveURL(target.href)
  await expect(page.locator('main #staff-page-header')).toContainText('Все филиалы')
})
