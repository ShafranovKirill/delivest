import { expect, type Page } from '@playwright/test'
import { adminUrl } from '../support/env'
import { branchPage } from '../support/staff'
import { test } from '../support/test'

const settings = [
  { query: 'фронтпад', id: 'frontpad', path: '/staff/b/e2e/integrations/frontpad', scope: 'E2E' },
  { query: 'зоны', id: 'delivery_zones', path: '/staff/b/e2e/delivery/zones', scope: 'E2E' },
  { query: 'график', id: 'hours', path: '/staff/branches/e2e/edit/hours', scope: 'E2E' },
  { query: 'бренд', id: 'brand', path: '/staff/franchise/brand', scope: 'Сеть' },
  { query: 'бонусы', id: 'loyalty_settings', path: '/staff/b/e2e/loyalty', scope: 'E2E' },
  { query: 'права', id: 'roles_settings', path: '/staff/roles', scope: 'Сеть' },
]

async function searchFor(page: Page, query: string) {
  await page.locator('#staff-header #command-palette-trigger').click()
  const palette = page.locator('#command-palette')
  await expect(palette).toBeVisible()
  await palette.locator('#command-palette-input').fill(query)
  return palette
}

test('setting aliases in search open canonical editors with the correct scope', async ({ staff }) => {
  const page = await staff('e2e_admin')
  for (const item of settings) {
    await branchPage(page, 'dashboard')
    const palette = await searchFor(page, item.query)
    const result = palette.locator(`#command-item-page-${item.id}`)
    await expect(result).toHaveAttribute('href', item.path)
    await result.click()
    await expect(page).toHaveURL(`${adminUrl}${item.path}`)
    await expect(page.locator('#staff-header #header-branch')).toContainText(item.scope)
    await expect(page.locator('main h1:visible')).toHaveCount(1)
    await expect(page.locator('main #settings-navigation [aria-current="page"], main #staff-section-navigation [aria-current="page"]')).toHaveCount(1)
  }
})

test('settings menu and search resolve through the same destinations', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.goto(`${adminUrl}/staff/settings`)
  await page.locator('[data-phx-main].phx-connected').waitFor()
  await expect(page.locator('#settings-center #settings-navigation')).toBeVisible()
  await expect(page.locator('#settings-feature-filter')).toBeVisible()
  for (const { id, query } of settings.filter((item) => item.scope === 'Сеть')) {
    const menuLink = page.locator(`#settings-nav-${id}`)
    await expect(menuLink).toBeVisible()
    const href = await menuLink.getAttribute('href')
    const palette = await searchFor(page, query)
    await expect(palette.locator(`#command-item-page-${id}`)).toHaveAttribute('href', href!)
    await page.keyboard.press('Escape')
  }
})

test('network pages display network scope after a branch was selected', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await branchPage(page, 'dashboard')
  await expect(page.locator('#staff-header #header-branch')).toContainText('E2E')
  await page.goto(`${adminUrl}/staff/franchise/brand`)
  await page.locator('[data-phx-main].phx-connected').waitFor()
  await expect(page.locator('#staff-header #header-branch')).toContainText('Сеть')
  await page.reload()
  await expect(page.locator('#staff-header #header-branch')).toContainText('Сеть')
})

test('network scope selection in one tab does not change another tab', async ({ staff }) => {
  const branchTab = await staff('e2e_admin')
  await branchPage(branchTab, 'dashboard')
  const otherTab = await branchTab.context().newPage()
  await otherTab.goto(`${adminUrl}/staff/b/e2e/dashboard`)
  await otherTab.locator('[data-phx-main].phx-connected').waitFor()
  await expect(otherTab.locator('#staff-header #header-branch')).toContainText('E2E')

  await branchTab.locator('#header-branch summary').click()
  await branchTab.locator('#header-branch-all').click()
  await expect(branchTab.locator('#staff-header #header-branch')).toContainText(/All accessible branches|Все доступные филиалы/)
  await expect(otherTab.locator('#staff-header #header-branch')).toContainText('E2E')
  await otherTab.reload()
  await expect(otherTab.locator('#staff-header #header-branch')).toContainText('E2E')
})
