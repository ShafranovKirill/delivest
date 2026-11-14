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

test('settings pages keep the same sidebar position, links and centered branch control', async ({ staff }) => {
  const page = await staff('e2e_admin')
  const paths = [
    '/staff/settings?branch=e2e',
    '/staff/franchise/brand',
    '/staff/branches/e2e/edit',
    '/staff/branches/e2e/edit/hours',
    '/staff/b/e2e/delivery',
    '/staff/b/e2e/integrations',
  ]

  await page.setViewportSize({ width: 1440, height: 900 })
  let expectedLinks: { id: string; href: string }[] | undefined
  let expectedBox: { x: number; width: number } | undefined

  for (const path of paths) {
    await page.goto(`${adminUrl}${path}`)
    await page.locator('[data-phx-main].phx-connected').waitFor()
    const nav = page.locator('#settings-center > #settings-navigation')
    await expect(nav).toHaveCount(1)
    await expect(page.locator('#staff-section-navigation')).toHaveCount(0)

    const links = await nav.locator('a').evaluateAll(anchors =>
      anchors.map(anchor => ({ id: anchor.id, href: anchor.getAttribute('href') ?? '' })),
    )
    const box = await nav.boundingBox()
    const content = await page.locator('#settings-center > div.min-w-0').boundingBox()
    expect(box).not.toBeNull()
    expect(content).not.toBeNull()
    expect(content!.x).toBeGreaterThan(box!.x + box!.width)
    if (expectedLinks) {
      expect(links.map(link => link.id)).toEqual(expectedLinks.map(link => link.id))
      if (path === '/staff/franchise/brand') {
        for (let index = 0; index < links.length; index++) {
          const original = expectedLinks[index]
          if (original.href.startsWith('/staff/b/') || /^\/staff\/branches\/[^/]+\/edit/.test(original.href)) {
            expect(links[index].href).toContain('/staff/branches/select?')
            expect(links[index].href).toContain('from=')
          } else expect(links[index].href).toBe(original.href)
        }
      } else expect(links).toEqual(expectedLinks)
    } else expectedLinks = links
    if (expectedBox) {
      expect(Math.abs(box!.x - expectedBox.x)).toBeLessThanOrEqual(2)
      expect(Math.abs(box!.width - expectedBox.width)).toBeLessThanOrEqual(2)
    } else expectedBox = { x: box!.x, width: box!.width }

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
    await expect.poll(async () => {
      return page.locator('#settings-navigation').evaluate(nav => {
        const active = nav.querySelector('[aria-current="page"]')
        if (!active) return false
        const navRect = nav.getBoundingClientRect()
        const activeRect = active.getBoundingClientRect()
        return activeRect.left >= navRect.left - 2 && activeRect.right <= navRect.right + 2
      })
    }).toBe(true)
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

  const productLink = page.locator('#nav-section-main').getByRole('link', { name: 'Меню', exact: true })
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
  await page.locator('#settings-nav-hours').click()
  await expect(page.locator('#branch-select-dialog')).toBeVisible()
  await page.locator('#branch-select-dialog').getByRole('heading', { name: 'E2E Board', exact: true }).locator('..').click()
  await expect(page).toHaveURL(`${adminUrl}/staff/branches/e2e-board/edit/hours`)
  await expect(page.locator('#settings-nav-hours[aria-current="page"]')).toBeVisible()
  await expect(page.locator('#settings-nav-branch_settings')).toHaveAttribute('href', '/staff/branches/e2e-board/edit')
})
