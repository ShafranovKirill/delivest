import { expect, type Page } from '@playwright/test'
import { adminUrl } from '../support/env'
import { branchPage } from '../support/staff'
import { test } from '../support/test'

const shellIds = [
  'staff-header',
  'main-sidebar',
  'sidebar-home',
  'sidebar-toggle',
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
  await page.locator('#main-sidebar #sidebar-home').click()
  await expect(page).toHaveURL(/\/staff\/b\/e2e\/dashboard$/)
  await expect(page.locator('#main-sidebar #nav-section-settings')).toBeVisible()
  await expect(page.locator('#main-sidebar .staff-sidebar-footer #staff-profile')).toBeVisible()
  await expect(page.locator('#main-sidebar #header-branch, #main-sidebar #command-palette-trigger')).toHaveCount(0)

  const branchDetails = page.locator('#staff-header #header-branch')
  const branchSummary = branchDetails.locator('summary')
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

  await page.locator('#sidebar-toggle').click()
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
  await expect(page.locator('#sidebar-toggle')).toBeFocused()
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

    await openToggle.click()
    await expect(page.locator('html')).toHaveAttribute('data-sidebar-open', '')
    await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(240)
    await expect(page.locator('#sidebar-toggle')).toBeFocused()
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

    await page.locator('#main-sidebar nav a[href="/staff/statistics"]').click()
    await expect(page).toHaveURL(/\/staff\/statistics$/)
    await expect(page.locator('html')).not.toHaveAttribute('data-sidebar-open', '')
    await expect(sidebar).toBeHidden()
    await expect(openToggle).toBeVisible()
    await expect(openToggle).toBeFocused()
    await expectNoHorizontalOverflow(page)

    await page.goto(`${adminUrl}/staff/branches`)
    await page.locator('[data-phx-main].phx-connected').waitFor()
    const createAction = page.locator('main #staff-header-actions #create-branch')
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
