import { expect, type Page } from '@playwright/test'
import { adminUrl, branchSlug } from '../support/env'
import { branchPage } from '../support/staff'
import { test } from '../support/test'

const shellIds = [
  'staff-header',
  'main-sidebar',
  'sidebar-home',
  'header-sidebar-toggle',
  'header-branch',
  'staff-profile-trigger',
  'staff-profile-menu',
  'command-palette-trigger',
  'command-palette',
]

async function expectNoHorizontalOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(1)
}

async function expectGlobalHeader(page: Page) {
  const header = page.locator('#staff-header')
  await expect(header.locator('#header-branch')).toBeVisible()
  await expect(header.locator('#command-palette-trigger')).toBeVisible()
  await expect(header.locator('#staff-header-separator')).toBeVisible()
  for (const selector of ['#header-sidebar-toggle', '#header-branch summary', '#command-palette-trigger']) {
    const control = header.locator(selector)
    await expect.poll(() => control.evaluate(element => element.getBoundingClientRect().height)).toBe(32)
    if (selector !== '#command-palette-trigger') await expect(control).toHaveCSS('border-top-width', '1px')
  }
  await expect(header.locator('h1, #staff-header-actions, #staff-page-header-navigation')).toHaveCount(0)
  await expect.poll(() => header.evaluate((element) =>
    Math.round(element.getBoundingClientRect().height),
  )).toBe(56)
}

test('desktop shell separates global controls, page title and sidebar footer', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.setViewportSize({ width: 1440, height: 900 })
  await branchPage(page, 'dashboard')

  await expectGlobalHeader(page)
  for (const id of shellIds) {
    expect(await page.locator(`#${id}`).count(), `${id} should be unique`).toBe(1)
  }
  await expect(page.locator('main h1:visible')).toHaveCount(1)
  await expect(page.locator('main h1:visible')).not.toBeEmpty()
  await expect(page.locator('#main-sidebar #sidebar-home')).toHaveAttribute('href', /\/staff$/)
  await Promise.all([
    page.waitForEvent('framenavigated', frame => frame === page.mainFrame() && /\/staff\/b\/e2e\/dashboard$/.test(frame.url())),
    page.locator('#main-sidebar #sidebar-home').click(),
  ])
  await expect(page).toHaveURL(/\/staff\/b\/e2e\/dashboard$/)
  await page.locator('[data-phx-main].phx-connected').waitFor()
  await expect(page.locator('#main-sidebar #nav-section-settings')).toBeVisible()
  await expect(page.locator('#main-sidebar .staff-sidebar-footer #staff-profile')).toBeVisible()
  await expect(page.locator('#main-sidebar #header-branch, #main-sidebar #command-palette-trigger')).toHaveCount(0)

  const branchDetails = page.locator('#staff-header #header-branch')
  const branchSummary = branchDetails.locator('summary')
  await expect(branchSummary).toContainText('E2E')
  expect((await branchSummary.boundingBox())!.width).toBeLessThan(145)
  await expect.poll(() => branchSummary.locator('.staff-branch-label').evaluate(
    label => label.scrollWidth - label.clientWidth,
  )).toBeLessThanOrEqual(1)
  await branchSummary.focus()
  await branchSummary.press('Space')
  await expect(branchDetails).toHaveAttribute('open', '')
  await branchSummary.press('Escape')
  await expect(branchDetails).not.toHaveAttribute('open', '')
  await expect(branchSummary).toBeFocused()
  await branchSummary.click()
  await expect(branchDetails).toHaveAttribute('open', '')
  await page.locator('#staff-header').click()
  await expect(branchDetails).not.toHaveAttribute('open', '')
  await branchSummary.click()
  const selected = page.locator('#header-branch-menu a.menu-active')
  await expect(selected).toHaveCount(1)
  const selectedLabel = await selected.innerText()
  await selected.click()
  await expect(page).toHaveURL(/\/staff\/b\/e2e\/dashboard$/)
  await expect(page.locator('#header-branch')).toContainText(selectedLabel)
})

test('profile, theme, search, and sidebar collapse work together', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.setViewportSize({ width: 1440, height: 900 })
  await branchPage(page, 'dashboard')

  const trigger = page.locator('#main-sidebar #staff-profile-trigger')
  const menu = page.locator('#staff-profile-menu')
  await trigger.click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(menu).toBeVisible()
  await expect(menu.locator('a[href="/locale/en"]')).toBeVisible()
  await expect(menu.locator('#orders-sound-toggle')).toBeVisible()
  await expect(menu.locator('#header-push-toggle')).toHaveCount(1)
  await expect(menu.locator('a[href="/staff/auth/log_out"]')).toBeVisible()

  const originalTheme = await page.locator('html').getAttribute('data-theme')
  const changeTheme = originalTheme === 'dark' ? '#header-theme-light' : '#header-theme-dark'
  await menu.locator(changeTheme).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', originalTheme === 'dark' ? 'light' : 'dark')
  await trigger.click()
  await expect(menu).toBeHidden()
  await trigger.click()
  await page.keyboard.press('Escape')
  await expect(menu).toBeHidden()
  await trigger.click()
  await page.locator('main h1').click()
  await expect(menu).toBeHidden()

  const palette = page.locator('#command-palette[role="dialog"]')
  await page.locator('#staff-header #command-palette-trigger').click()
  await expect(palette).toBeVisible()
  await expect(page.locator('#command-palette-input')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(palette).toBeHidden()
  await page.keyboard.press('ControlOrMeta+k')
  await expect(palette).toBeVisible()
  await page.keyboard.press('Escape')

  const sidebarToggle = page.locator('#header-sidebar-toggle')
  await sidebarToggle.click()
  await expect(page.locator('html')).toHaveAttribute('data-sidebar-collapsed', '')
  await expect(page.locator('#main-sidebar')).toBeHidden()
  await expect(page.locator('#header-sidebar-toggle')).toBeFocused()
  await expect(page.locator('#header-sidebar-toggle')).toHaveAttribute('aria-expanded', 'false')
  await expect.poll(async () => (await page.locator('#staff-header').boundingBox())?.x).toBe(0)
  await expect.poll(() => page.locator('.staff-shell-content').evaluate((el) => getComputedStyle(el).marginLeft)).toBe('0px')
  await page.screenshot({ path: test.info().outputPath('sidebar-hidden-desktop.png') })
  await page.reload()
  await page.locator('[data-phx-main].phx-connected').waitFor()
  await expect(page.locator('html')).toHaveAttribute('data-sidebar-collapsed', '')
  await expect(page.locator('#main-sidebar')).toBeHidden()
  await page.locator('#header-sidebar-toggle').click()
  await expect(page.locator('html')).not.toHaveAttribute('data-sidebar-collapsed', '')
  await expect(sidebarToggle).toBeFocused()
  await expectGlobalHeader(page)
  await page.locator('#staff-profile-trigger').click()
  await expect(menu).toBeVisible()
  const menuBox = await menu.boundingBox()
  expect(menuBox).not.toBeNull()
  expect(menuBox!.x).toBeGreaterThanOrEqual(0)
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(1440)
  expect(menuBox!.y).toBeGreaterThanOrEqual(0)
  expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(900)
  await page.keyboard.press('Escape')
  await page.locator('#staff-header #command-palette-trigger').click()
  await expect(palette).toBeVisible()
  await page.keyboard.press('Escape')
})

test('floating desktop sidebar stays pinned in a half-width window', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.setViewportSize({ width: 720, height: 844 })
  await branchPage(page, 'dashboard')

  const sidebar = page.locator('#main-sidebar')
  const toggle = page.locator('#staff-header #header-sidebar-toggle')
  await expect(sidebar).toBeVisible()
  await expect(page.locator('#staff-sidebar-overlay')).toBeHidden()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('#command-palette-trigger .hero-magnifying-glass')).toBeVisible()
  const bounds = await sidebar.boundingBox()
  expect(bounds!.x).toBeGreaterThan(0)
  expect(bounds!.y).toBeGreaterThan(0)
  expect(bounds!.y + bounds!.height).toBeLessThan(844)
  await expectNoHorizontalOverflow(page)

  await toggle.click()
  await expect(sidebar).toBeHidden()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await expect(sidebar).toBeVisible()
  await expect(page.locator('#staff-sidebar-overlay')).toBeHidden()
  await expect(toggle).toBeFocused()
})

test('mobile sidebar opens from header and closes after navigation', async ({ staff }) => {
  const page = await staff('e2e_admin')

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await branchPage(page, 'dashboard')
    const sidebar = page.locator('#main-sidebar')
    const openToggle = page.locator('#header-sidebar-toggle')
    await expect(sidebar).toBeHidden()
    await expect(openToggle).toBeVisible()
    await expect(openToggle).toHaveAttribute('aria-expanded', 'false')
    await expectGlobalHeader(page)
    await expect.poll(async () => (await page.locator('#staff-header').boundingBox())?.x).toBe(0)
    await expect.poll(() => page.locator('.staff-shell-content').evaluate((el) => getComputedStyle(el).marginLeft)).toBe('0px')
    await expectNoHorizontalOverflow(page)
    if (width === 390) await page.screenshot({ path: test.info().outputPath('sidebar-hidden-mobile.png') })

    const branchSummary = page.locator('#header-branch summary')
    const branchMenu = page.locator('#header-branch-menu')
    await branchSummary.focus()
    await branchSummary.press('Space')
    await expect(branchMenu).toBeVisible()
    const branchMenuBox = await branchMenu.boundingBox()
    expect(branchMenuBox).not.toBeNull()
    expect(branchMenuBox!.x).toBeGreaterThanOrEqual(0)
    expect(branchMenuBox!.x + branchMenuBox!.width).toBeLessThanOrEqual(width)
    await page.keyboard.press('Escape')
    await expect(branchMenu).toBeHidden()
    await expect(branchSummary).toBeFocused()

    await openToggle.click()
    await expect(page.locator('html')).toHaveAttribute('data-sidebar-open', '')
    await expect(sidebar).toBeVisible()
    await expect(page.locator('#sidebar-home')).toBeFocused()
    await expect(page.locator('#sidebar-home')).toBeVisible()
    await expect(page.locator('#nav-section-settings')).toBeVisible()
    await expect(page.locator('#staff-sidebar-overlay')).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.locator('#staff-profile-trigger').click()
    const mobileMenu = page.locator('#staff-profile-menu')
    await expect(mobileMenu).toBeVisible()
    const menuBox = await mobileMenu.boundingBox()
    expect(menuBox).not.toBeNull()
    expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(width)
    await page.keyboard.press('Escape')
    await expect(mobileMenu).toBeHidden()
    await expect(sidebar).toBeVisible()
    await expect(page.locator('main h1:visible')).toHaveCount(1)

    if (await page.locator('#sidebar-group-analytics').getAttribute('open') === null) {
      await page.locator('#sidebar-group-analytics-toggle').click()
    }
    const statistics = page.locator('#main-sidebar #sidebar-section-nav-statistics')
    await expect(statistics).toHaveAttribute('href', /\/staff\/branches\/select\?/)
    await statistics.click()
    await expect(page.locator('main #branch-select-page')).toBeVisible()
    await expect(page.locator('html')).not.toHaveAttribute('data-sidebar-open', '')
    await expect(sidebar).toBeHidden()
    await expect(openToggle).toBeVisible()
    await expect(openToggle).toBeFocused()
    const e2eCard = page.locator('[id^="branch-select-card-"]').filter({
      has: page.getByRole('heading', { name: 'E2E', exact: true }),
    })
    await e2eCard.locator('[id^="branch-select-go-"]').filter({ hasText: 'Перейти' }).click()
    await expect(page).toHaveURL(`${adminUrl}/staff/b/${branchSlug}/statistics`)
    await expect(page.locator('html')).not.toHaveAttribute('data-sidebar-open', '')
    await expectNoHorizontalOverflow(page)

    await page.goto(`${adminUrl}/staff/branches`)
    await page.locator('[data-phx-main].phx-connected').waitFor()
    const createAction = page.locator('main #branches-toolbar .staff-page-toolbar-actions #create-branch')
    await expect(createAction).toBeVisible()
    const actionBox = await createAction.boundingBox()
    expect(actionBox).not.toBeNull()
    expect(actionBox!.x).toBeGreaterThanOrEqual(0)
    expect(actionBox!.x + actionBox!.width).toBeLessThanOrEqual(width)
    await expectNoHorizontalOverflow(page)
  }
})

test('branch selection page has the only title in main', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.goto(`${adminUrl}/staff/branches/select`)
  await page.locator('[data-phx-main].phx-connected').waitFor()
  await expect(page.locator('main h1:visible')).toHaveText('Выберите филиал')
  await expect(page.locator('h1:visible')).toHaveCount(1)
  await expectGlobalHeader(page)
})
