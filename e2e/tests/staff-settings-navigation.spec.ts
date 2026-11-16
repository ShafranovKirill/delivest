import { expect, type Page } from '@playwright/test'
import { adminUrl } from '../support/env'
import { branchPage } from '../support/staff'
import { test } from '../support/test'

const settings = [
  { query: 'фронтпад', id: 'frontpad', path: '/staff/b/e2e/integrations/frontpad', scope: 'E2E' },
  { query: 'зоны', id: 'delivery_settings', path: '/staff/b/e2e/delivery', scope: 'E2E' },
  { query: 'график', id: 'branch_settings', path: '/staff/branches/e2e/edit', scope: 'E2E' },
  { query: 'бренд', id: 'franchise', path: '/staff/franchise', scope: 'Сеть' },
  { query: 'бонусы', id: 'loyalty', path: '/staff/marketing/bonuses?branch=e2e', scope: 'E2E' },
  { query: 'права', id: 'roles', path: '/staff/roles', scope: 'Сеть' },
]

async function searchFor(page: Page, query: string) {
  await page.locator('#staff-header #command-palette-trigger').click()
  const palette = page.locator('#command-palette')
  await expect(palette).toBeVisible()
  await palette.locator('#command-palette-input').fill(query)
  return palette
}

test('weekly schedule persists a day off and restores its opening times', async ({ staff }) => {
  const page = await staff('e2e_admin')
  const url = `${adminUrl}/staff/branches/e2e/edit/hours`
  await page.goto(url)
  await page.locator('[data-phx-main].phx-connected').waitFor()
  const enabled = page.locator('input[type="checkbox"][name="branch_form[working_hours][monday][enabled]"]')
  const open = page.locator('input[name="branch_form[working_hours][monday][open]"]')
  const close = page.locator('input[name="branch_form[working_hours][monday][close]"]')
  const save = page.locator('#staff-header-actions button[form="branch-form"]')
  await expect(enabled).toBeChecked()
  const originalOpen = await open.inputValue()
  const originalClose = await close.inputValue()

  await enabled.uncheck()
  await save.click()
  await expect(page.locator('#flash-group')).toContainText(/сохран|saved/i)
  await page.goto(url)
  await expect(enabled).not.toBeChecked()
  await expect(open).toHaveValue(originalOpen)
  await expect(close).toHaveValue(originalClose)
  await enabled.check()
  await save.click()
  await expect(page.locator('#flash-group')).toContainText(/сохран|saved/i)
  await page.goto(url)
  await expect(enabled).toBeChecked()
  await expect(open).toHaveValue(originalOpen)
  await expect(close).toHaveValue(originalClose)
})

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
    await expect(page.locator('#settings-navigation [aria-current="page"], #staff-section-navigation [aria-current="page"]')).toHaveCount(1)
  }
})

test('settings menu and search resolve through the same destinations', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.goto(`${adminUrl}/staff/settings`)
  await page.locator('[data-phx-main].phx-connected').waitFor()
  await expect(page.locator('#sidebar-settings-navigation')).toBeVisible()
  await expect(page.locator('#settings-feature-filter')).toBeVisible()
  for (const { id, query } of settings.filter((item) => item.id === 'franchise')) {
    const menuLink = page.locator(`#sidebar-settings-nav-${id}`)
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

test('settings use the existing desktop sidebar and a mobile navigation row', async ({ staff }) => {
  const page = await staff('e2e_admin')
  const paths = [
    '/staff/settings?branch=e2e',
    '/staff/franchise/brand',
    '/staff/branches/e2e/edit',
    '/staff/branches/e2e/edit/hours',
    '/staff/b/e2e/delivery',
    '/staff/b/e2e/integrations',
  ]

  await page.setViewportSize({ width: 1920, height: 1080 })
  let expectedLinks: { id: string; href: string }[] | undefined

  for (const path of paths) {
    await page.goto(`${adminUrl}${path}`)
    await page.locator('[data-phx-main].phx-connected').waitFor()
    const nav = page.locator('#sidebar-settings-navigation')
    await expect(nav).toHaveCount(1)
    await expect(page.locator('#staff-section-navigation')).toHaveCount(0)

    const links = await nav.locator('a').evaluateAll(anchors =>
      anchors.map(anchor => ({ id: anchor.id, href: anchor.getAttribute('href') ?? '' })),
    )
    const box = await nav.boundingBox()
    const content = await page.locator('#settings-center').boundingBox()
    expect(box).not.toBeNull()
    expect(content).not.toBeNull()
    expect(content!.x).toBeGreaterThanOrEqual(240)
    expect(content!.x).toBeLessThan(272)
    await expect(page.locator('#staff-context-navigation')).toBeHidden()
    expect(content!.x + content!.width).toBeGreaterThan(1850)
    if (expectedLinks) {
      expect(links.map(link => link.id)).toEqual(expectedLinks.map(link => link.id))
      if (path === '/staff/franchise/brand') {
        for (let index = 0; index < links.length; index++) {
          const original = expectedLinks[index]
          if (original.href.startsWith('/staff/settings/data-transfer?')) {
            expect(links[index].href).toBe('/staff/settings/data-transfer')
          } else if (original.href.startsWith('/staff/b/') || /^\/staff\/branches\/[^/]+\/edit/.test(original.href)) {
            expect(links[index].href).toContain('/staff/branches/select?')
            expect(links[index].href).toContain('from=')
          } else expect(links[index].href).toBe(original.href)
        }
      } else expect(links).toEqual(expectedLinks)
    } else expectedLinks = links
    const sidebar = await page.locator('#main-sidebar').boundingBox()
    expect(sidebar!.width).toBe(240)
    expect(box!.x).toBeGreaterThanOrEqual(sidebar!.x)
    expect(box!.x + box!.width).toBeLessThanOrEqual(sidebar!.x + sidebar!.width)

    const header = await page.locator('#staff-header').boundingBox()
    const summary = await page.locator('#staff-header #header-branch summary').boundingBox()
    expect(header).not.toBeNull()
    expect(summary).not.toBeNull()
    expect(Math.abs((summary!.y + summary!.height / 2) - (header!.y + header!.height / 2)))
      .toBeLessThanOrEqual(2)
  }

  await page.setViewportSize({ width: 390, height: 844 })
  for (const path of paths) {
    await page.goto(`${adminUrl}${path}`)
    await page.locator('[data-phx-main].phx-connected').waitFor()
    if (path.startsWith('/staff/settings?')) {
      await expect(page.locator('#settings-navigation [aria-current="page"]')).toHaveCount(0)
    } else {
      await expect.poll(async () => {
        return page.locator('#settings-navigation').evaluate(nav => {
          const active = nav.querySelector('[aria-current="page"]')
          if (!active) return false
          const navRect = nav.getBoundingClientRect()
          const activeRect = active.getBoundingClientRect()
          return activeRect.left >= navRect.left - 2 && activeRect.right <= navRect.right + 2
        })
      }).toBe(true)
    }
    const header = await page.locator('#staff-header').boundingBox()
    const summary = await page.locator('#staff-header #header-branch summary').boundingBox()
    expect(header).not.toBeNull()
    expect(summary).not.toBeNull()
    expect(Math.abs((summary!.y + summary!.height / 2) - (header!.y + header!.height / 2)))
      .toBeLessThanOrEqual(2)
  }
})

test('network navigation asks for a branch before opening a scoped section', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await branchPage(page, 'dashboard')
  await page.goto(`${adminUrl}/staff/dashboard`)
  await page.locator('[data-phx-main].phx-connected').waitFor()

  await page.locator('#sidebar-group-menu-toggle').click()
  const productLink = page.locator('#sidebar-product-section-tab-products')
  const productHref = await productLink.getAttribute('href')
  expect(productHref).not.toBeNull()
  const productChooser = new URL(productHref!, adminUrl)
  expect(productChooser.pathname).toBe('/staff/branches/select')
  expect(productChooser.searchParams.get('modal')).toBe('true')
  expect(productChooser.searchParams.get('from')).toMatch(/^\/staff\/b\/[a-z0-9-]+\/products$/)
  await productLink.click()
  await expect(page.locator('#branch-select-dialog[role="dialog"][aria-modal="true"]')).toBeVisible()
  await page.reload()
  await expect(page.locator('#branch-select-dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page).toHaveURL(`${adminUrl}/staff/dashboard`)
  await expect(page.locator('#branch-select-dialog')).toHaveCount(0)
  await page.locator('[data-phx-main].phx-connected').waitFor()

  await page.locator('#command-palette-trigger').click()
  await expect(page.locator('#command-palette')).toBeVisible()
  await page.locator('#command-palette-input').fill('Новый заказ')
  const newOrder = page.locator('#command-item-page-orders_new')
  await expect(newOrder).toHaveAttribute('href', /orders%2Fnew/)
  await newOrder.click()
  await expect(page.locator('#branch-select-dialog')).toBeVisible()
  await page.locator('#branch-select-dialog').getByRole('heading', { name: 'E2E Board', exact: true }).locator('..').click()
  await expect(page).toHaveURL(`${adminUrl}/staff/b/e2e-board/orders/new`)

  await page.goto(`${adminUrl}/staff/franchise/brand`)
  await page.locator('[data-phx-main].phx-connected').waitFor()
  await expect(page.locator('#sidebar-settings-nav-branch_settings')).toHaveCount(0)
  await page.locator('#sidebar-settings-nav-branches').click()
  await expect(page).toHaveURL(`${adminUrl}/staff/branches`)
  await page.locator('#branch-settings-list a[href="/staff/branches/e2e-board/edit"]').click()
  await expect(page).toHaveURL(`${adminUrl}/staff/branches/e2e-board/edit`)
  await expect(page.locator('#sidebar-settings-nav-branches[aria-current="page"]')).toBeVisible()
  await expect(page.locator('#settings-nav-branches')).toHaveAttribute('href', '/staff/branches')
  await expect(page.locator('#settings-nav-branch_settings')).toHaveCount(0)
  await page.locator('#branch-section-hours').click()
  await expect(page).toHaveURL(`${adminUrl}/staff/branches/e2e-board/edit/hours`)
})

test('employees live after finance and outside settings', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.setViewportSize({ width: 1440, height: 900 })
  await branchPage(page, 'dashboard')
  const groups = await page.locator('#nav-section-main details[id]').evaluateAll(elements => elements.map(element => element.id))
  expect(groups.indexOf('sidebar-group-employees')).toBe(groups.indexOf('sidebar-group-finance') + 1)
  await page.locator('#sidebar-group-employees-toggle').click()
  await page.locator('#sidebar-section-nav-employee').click()
  await expect(page).toHaveURL(/\/staff\/employee$/)
  await expect(page.locator('#sidebar-section-nav-employee')).toHaveAttribute('aria-current', 'page')
  await page.locator('#sidebar-section-nav-roles').click()
  await expect(page).toHaveURL(/\/staff\/roles$/)
  await expect(page.locator('#sidebar-section-nav-roles')).toHaveAttribute('aria-current', 'page')
  await expect(page.locator('#sidebar-group-settings')).not.toHaveAttribute('open', '')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('#staff-section-navigation a[href="/staff/employee"]')).toBeVisible()
  await expect(page.locator('#staff-section-navigation a[href="/staff/roles"]')).toHaveAttribute('aria-current', 'page')
})

for (const width of [1440, 390]) {
  test(`data transfer opens a page with snapshot cards at width ${width}`, async ({ staff }) => {
    const page = await staff('e2e_admin')
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`${adminUrl}/staff/settings?branch=e2e`)
    await page.locator('[data-phx-main].phx-connected').waitFor()
    const prefix = width > 1000 ? 'sidebar-' : ''
    const nav = page.locator(`#${prefix}settings-navigation`)
    await expect(nav).toBeVisible()
    await expect(nav.locator(`#${prefix}settings-nav-franchise`)).toHaveAttribute('href', '/staff/franchise')
    await expect(nav.locator(`#${prefix}settings-nav-franchise`)).toHaveText('Франшиза')
    for (const removed of ['features', 'brand', 'hours', 'delivery_zones', 'order_settings', 'loyalty_settings', 'team', 'roles_settings', 'delivery_settings', 'branch_settings']) {
      await expect(nav.locator(`#${prefix}settings-nav-${removed}`)).toHaveCount(0)
    }
    const group = nav.locator(`#${prefix}group-data-system`)
    await group.locator('summary').click()
    const transfer = group.locator(`#${prefix}settings-nav-data_transfer`)
    await expect(transfer).toHaveAttribute('href', '/staff/settings/data-transfer?branch=e2e')
    await expect(nav.locator(`#${prefix}settings-nav-site_snapshot, #${prefix}settings-nav-instance_backup`)).toHaveCount(0)
    await transfer.click()
    await expect(page).toHaveURL(`${adminUrl}/staff/settings/data-transfer?branch=e2e`)
    await expect(transfer).toHaveAttribute('aria-current', 'page')
    await expect(page.locator('main h1')).toHaveText('Перенос данных')
    const branch = page.locator('#data-transfer-branch')
    const franchise = page.locator('#data-transfer-franchise')
    await expect(branch).toBeVisible()
    await expect(branch).toContainText('Слепок филиала')
    await expect(branch).toHaveAttribute('href', '/staff/branches/e2e/edit/snapshot')
    await expect(franchise).toContainText('Слепок франшизы')
    await expect(franchise).toHaveAttribute('href', '/staff/franchise/snapshot')
    await page.screenshot({ path: test.info().outputPath('data-transfer-page.png'), animations: 'disabled' })
    await branch.click()
    await expect(page).toHaveURL(/\/staff\/branches\/e2e\/edit\/snapshot$/)
    await expect(transfer).toHaveAttribute('aria-current', 'page')
    await transfer.click()
    await expect(branch).toBeVisible()
    await franchise.click()
    await expect(page).toHaveURL(/\/staff\/franchise\/snapshot$/)
    await expect(transfer).toHaveAttribute('aria-current', 'page')
  })
}

test('data transfer updates the branch snapshot destination when scope changes', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.goto(`${adminUrl}/staff/settings/data-transfer?branch=e2e`)
  await page.locator('[data-phx-main].phx-connected').waitFor()
  await page.locator('#header-branch summary').click()
  await page.locator('#header-branch-menu a').filter({ hasText: 'E2E Board' }).click()
  await expect(page).toHaveURL(`${adminUrl}/staff/settings/data-transfer?branch=e2e-board`)
  await expect(page.locator('#data-transfer-branch')).toHaveAttribute('href', '/staff/branches/e2e-board/edit/snapshot')
  await page.locator('#header-branch summary').click()
  await page.locator('#header-branch-all').click()
  await expect(page).toHaveURL(`${adminUrl}/staff/settings/data-transfer`)
  await expect(page.locator('#data-transfer-branch')).toHaveAttribute('href', /\/staff\/branches\/select\?/)
  await page.locator('#data-transfer-branch').click()
  await expect(page.locator('#branch-select-dialog')).toBeVisible()
  await page.locator('#branch-select-dialog').getByRole('heading', { name: 'E2E Board', exact: true }).locator('..').click()
  await expect(page).toHaveURL(`${adminUrl}/staff/branches/e2e-board/edit/snapshot`)
})

test('data transfer search uses actual scope instead of the preferred branch', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await branchPage(page, 'dashboard')
  let palette = await searchFor(page, 'Перенос данных')
  await expect(palette.locator('#command-item-page-data_transfer')).toHaveAttribute('href', '/staff/settings/data-transfer?branch=e2e')
  await page.keyboard.press('Escape')
  await page.goto(`${adminUrl}/staff/franchise`)
  await page.locator('[data-phx-main].phx-connected').waitFor()
  palette = await searchFor(page, 'Перенос данных')
  await expect(palette.locator('#command-item-page-data_transfer')).toHaveAttribute('href', '/staff/settings/data-transfer')
  await palette.locator('#command-item-page-data_transfer').click()
  await expect(page).toHaveURL(`${adminUrl}/staff/settings/data-transfer`)
  await expect(page.locator('#data-transfer-branch')).toHaveAttribute('href', /\/staff\/branches\/select\?/)
})

test('franchise groups appearance and exposes full backup through data transfer', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.goto(`${adminUrl}/staff/franchise`)
  await page.locator('[data-phx-main].phx-connected').waitFor()
  const appearance = page.locator('#franchise-appearance')
  await expect(appearance.getByRole('heading', { name: 'Внешний вид', exact: true })).toBeVisible()
  for (const section of ['brand', 'logo', 'images']) {
    await expect(appearance.locator(`#franchise-section-${section}`)).toHaveAttribute('href', `/staff/franchise/${section}`)
  }
  await expect(page.locator('#franchise-section-snapshot')).toHaveCount(0)
  await expect(page.locator('#sidebar-settings-nav-features, #settings-nav-features')).toHaveCount(0)
  await page.locator('#sidebar-group-data-system-toggle').click()
  await page.locator('#sidebar-settings-nav-data_transfer').click()
  await expect(page.locator('#data-transfer-franchise')).toBeVisible()
  await expect(page.locator('#data-transfer-franchise')).toHaveAttribute('href', '/staff/franchise/snapshot')
})
