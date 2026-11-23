import { expect, test } from '../support/test'
import { adminUrl, branchSlug } from '../support/env'
import { branchPage } from '../support/staff'

const sections = [
  { key: 'channels', title: 'Каналы продаж', route: `/staff/b/${branchSlug}/analytics/channels` },
  { key: 'sources', title: 'Источники', route: `/staff/b/${branchSlug}/analytics/sources` },
  { key: 'funnel', title: 'Воронка заказа', route: `/staff/b/${branchSlug}/analytics/funnel` },
  { key: 'customers', title: 'Покупатели', route: `/staff/b/${branchSlug}/analytics/customers` },
  { key: 'comparison', title: 'Сравнение филиалов', route: '/staff/analytics/comparison' },
]

test('analytics sidebar opens sales, acquisition and buyers with report drilldowns', async ({ staff }) => {
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
  await expect(group.locator('a')).toHaveCount(3)
  const statistics = page.locator('#sidebar-section-nav-statistics')
  await expect(statistics).toHaveAttribute('href', `/staff/b/${branchSlug}/statistics`)
  await expect(page.locator('#sidebar-section-nav-analytics_acquisition')).toHaveAttribute('href', `/staff/b/${branchSlug}/analytics/sources`)
  await expect(page.locator('#sidebar-section-nav-analytics_customers')).toHaveAttribute('href', `/staff/b/${branchSlug}/analytics/customers`)
  await statistics.click()
  await expect(page).toHaveURL(`${adminUrl}/staff/b/${branchSlug}/statistics`)
  await expect(page.locator('#statistics-sales-detail')).toBeVisible()

  for (const section of sections) {
    if (section.key === 'channels' || section.key === 'comparison') {
      await expect(page.locator(`#statistics-sales-detail nav a[href^='${section.route}?']`)).toHaveCount(1)
    }
    await page.goto(`${adminUrl}${section.route}`)
    await page.locator('[data-phx-main].phx-connected').waitFor()
    await expect(page.locator('main h1')).toHaveText(section.title)
    await expect(page.locator('#statistics-report')).toBeVisible()
    await expect(page.locator('#analytics-placeholder')).toHaveCount(0)
    await branchPage(page, 'statistics')
    await expect(page.locator('#statistics-sales-detail')).toBeVisible()
  }

  await page.goto(`${adminUrl}/staff/statistics`)
  await page.locator('[data-phx-main].phx-connected').waitFor()
  await expect(page.locator('#statistics-sales-detail')).toBeVisible()
  await expect(page.locator('#header-branch summary')).toHaveAttribute('aria-label', 'Все доступные филиалы')
  await expect(page.locator('#sidebar-section-nav-statistics')).toHaveAttribute('aria-current', 'page')
})

test('mobile analytics keeps sidebar destinations and in-page report drilldowns', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.setViewportSize({ width: 390, height: 844 })
  await branchPage(page, 'dashboard')
  await page.locator('#header-sidebar-toggle').click()
  await page.locator('#sidebar-group-analytics-toggle').click()
  await page.locator('#sidebar-section-nav-statistics').click()
  await expect(page.locator('#main-sidebar')).toBeHidden()
  const navigation = page.locator('#staff-section-navigation')
  await expect(navigation).toBeVisible()
  await expect(navigation.locator('a')).toHaveCount(3)
  await expect(navigation.locator('#section-nav-statistics')).toHaveAttribute('href', `/staff/b/${branchSlug}/statistics`)
  await expect(navigation.locator('#section-nav-analytics_acquisition')).toHaveAttribute('href', `/staff/b/${branchSlug}/analytics/sources`)
  await expect(navigation.locator('#section-nav-analytics_customers')).toHaveAttribute('href', `/staff/b/${branchSlug}/analytics/customers`)
  await expect(page.locator('#statistics-sales-detail')).toBeVisible()
  await page.locator(`#statistics-sales-detail nav a[href^='/staff/b/${branchSlug}/analytics/channels?']`).click()
  await expect(page.locator('#statistics-report')).toBeVisible()
  await expect(page.locator('#analytics-placeholder')).toHaveCount(0)
  await expect(navigation.locator('a')).toHaveCount(3)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1)
  await page.screenshot({ path: test.info().outputPath('analytics-mobile.png'), animations: 'disabled' })
})
