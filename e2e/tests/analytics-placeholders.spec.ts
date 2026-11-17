import { expect, test } from '../support/test'
import { adminUrl, branchSlug } from '../support/env'
import { branchPage } from '../support/staff'

const sections = [
  { key: 'channels', navLabel: 'Каналы продаж', pageTitle: 'Каналы продаж', route: `/staff/b/${branchSlug}/analytics/channels` },
  { key: 'sources', navLabel: 'Источники и реклама', pageTitle: 'Источники', route: `/staff/b/${branchSlug}/analytics/sources` },
  { key: 'funnel', navLabel: 'Воронка заказа', pageTitle: 'Воронка заказа', route: `/staff/b/${branchSlug}/analytics/funnel` },
  { key: 'customers', navLabel: 'Покупатели', pageTitle: 'Покупатели', route: `/staff/b/${branchSlug}/analytics/customers` },
  { key: 'comparison', navLabel: 'Сравнение филиалов', pageTitle: 'Сравнение филиалов', route: '/staff/analytics/comparison' },
]

test('analytics expands from another page and opens its live reports', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.setViewportSize({ width: 1440, height: 900 })
  await branchPage(page, 'products')
  const group = page.locator('#sidebar-group-analytics')
  const settings = page.locator('#nav-section-main #sidebar-group-settings')
  await expect(settings).toHaveCount(1)
  const groups = await page.locator('#nav-section-main > ul > li > details[id]').evaluateAll(elements => elements.map(element => element.id))
  expect(groups.slice(-2)).toEqual(['sidebar-group-analytics', 'sidebar-group-settings'])
  const analyticsBox = await group.boundingBox()
  const settingsBox = await settings.boundingBox()
  expect(settingsBox!.y - analyticsBox!.y - analyticsBox!.height).toBeLessThanOrEqual(8)
  await expect(group).not.toHaveAttribute('open', '')
  await group.locator('summary').click()
  await expect(group.locator('a')).toHaveCount(6)
  for (const section of sections) {
    const link = page.locator(`#sidebar-section-nav-analytics_${section.key}`)
    await expect(link).toHaveText(section.navLabel)
    await link.click()
    await expect(page).toHaveURL(`${adminUrl}${section.route}`)
    await expect(page.locator('main h1')).toHaveText(section.pageTitle)
    await expect(page.locator('#statistics-report')).toBeVisible()
    await expect(page.locator('#analytics-placeholder')).toHaveCount(0)
    await expect(link).toHaveAttribute('aria-current', 'page')
    await expect(group.locator('a[aria-current="page"]')).toHaveCount(1)
  }
  await page.locator('#sidebar-section-nav-statistics').click()
  await expect(page).toHaveURL(`${adminUrl}/staff/statistics`)
  await expect(page.locator('#statistics-report')).toBeVisible()
  await expect(page.locator('#analytics-placeholder')).toHaveCount(0)
  await expect(page.locator('#sidebar-section-nav-statistics')).toHaveAttribute('aria-current', 'page')
  await expect(group.locator('a[aria-current="page"]')).toHaveCount(1)
})

test('live analytics reports use the existing mobile navigation row', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.setViewportSize({ width: 390, height: 844 })
  await branchPage(page, 'dashboard')
  await page.locator('#header-sidebar-toggle').click()
  await page.locator('#sidebar-group-analytics-toggle').click()
  await page.locator('#sidebar-section-nav-analytics_channels').click()
  await expect(page.locator('#main-sidebar')).toBeHidden()
  const navigation = page.locator('#staff-section-navigation')
  await expect(navigation).toBeVisible()
  await expect(navigation.locator('a')).toHaveCount(6)
  for (const section of sections) {
    const link = navigation.locator(`#section-nav-analytics_${section.key}`)
    await link.click()
    await expect(page).toHaveURL(`${adminUrl}${section.route}`)
    await expect(page.locator('main h1')).toHaveText(section.pageTitle)
    await expect(page.locator('#statistics-report')).toBeVisible()
    await expect(page.locator('#analytics-placeholder')).toHaveCount(0)
    await expect(link).toHaveAttribute('aria-current', 'page')
    await expect(navigation.locator('a[aria-current="page"]')).toHaveCount(1)
  }
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: test.info().outputPath('analytics-placeholder-mobile.png'), animations: 'disabled' })
})
