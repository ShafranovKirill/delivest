import { expect, type Page } from '@playwright/test'
import { adminUrl } from '../support/env'
import { branchPage } from '../support/staff'
import { test } from '../support/test'

const shellIds = [
  'staff-header',
  'staff-header-title',
  'main-sidebar',
  'sidebar-home',
  'sidebar-toggle',
  'header-home',
  'header-sidebar-toggle',
  'header-new-orders',
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

test('desktop shell has one page title and keeps global controls in the sidebar', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.setViewportSize({ width: 1440, height: 900 })
  await branchPage(page, 'dashboard')

  const title = page.locator('#staff-header-title h1:visible')
  await expect(title).toHaveCount(1)
  await expect(title).not.toBeEmpty()
  await expect(page.locator('main h1:visible')).toHaveCount(0)
  await expect(page.locator('#staff-header #header-branch, #staff-header #staff-profile-trigger, #staff-header #command-palette-trigger, #staff-header #header-new-orders')).toHaveCount(0)

  for (const id of shellIds) {
    expect(await page.locator(`#${id}`).count(), `${id} should be unique`).toBe(1)
  }
  await expect(page.locator('#main-sidebar #header-branch')).toBeVisible()
  await expect(page.locator('#staff-header-sidebar-controls')).toBeHidden()
  await expect(page.locator('#sidebar-home')).toHaveAttribute('href', /\/staff\/b\/e2e\/dashboard$/)
  await expect(page.locator('#sidebar-home')).toHaveText('')
  await expect(page.locator('#sidebar-top-row .staff-sidebar-top-actions #header-new-orders')).toBeVisible()
  await expect(page.locator('#nav-section-branch > p')).toHaveCount(0)
  await expect(page.locator('#main-sidebar #sidebar-branch-settings')).toHaveCount(0)
  await expect(page.locator('#main-sidebar #staff-profile-trigger')).toBeVisible()
  await expect(page.locator('#main-sidebar #command-palette-trigger')).toBeVisible()

  const branchDetails = page.locator('#header-branch')
  const branchSummary = branchDetails.locator('summary')
  await branchSummary.focus()
  await branchSummary.press('Space')
  await expect(branchDetails).toHaveAttribute('open', '')
  await branchSummary.press('Escape')
  await expect(branchDetails).not.toHaveAttribute('open', '')
  await expect(branchSummary).toBeFocused()
  await branchSummary.click()
  await expect(branchDetails).toHaveAttribute('open', '')
  await page.locator('#staff-header-title').click()
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

  const trigger = page.locator('#staff-profile-trigger')
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
  await page.locator('#staff-header-title').click()
  await expect(menu).toBeHidden()

  const palette = page.locator('#command-palette[role="dialog"]')
  await page.locator('#command-palette-trigger').click()
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
  await expect(page.locator('#staff-header-sidebar-controls')).toBeVisible()
  await expect(page.locator('#header-home')).toHaveAttribute('href', /\/staff\/b\/e2e\/dashboard$/)
  await expect(page.locator('#header-sidebar-toggle')).toBeFocused()
  await expect(page.locator('#header-sidebar-toggle')).toHaveAttribute('aria-expanded', 'false')
  await expect.poll(async () => (await page.locator('#staff-header').boundingBox())?.x).toBe(0)
  await expect.poll(() => page.locator('.staff-shell-content').evaluate((el) => getComputedStyle(el).marginLeft)).toBe('0px')
  await page.screenshot({ path: test.info().outputPath('sidebar-hidden-desktop.png') })
  await page.reload()
  await page.locator('[data-phx-main].phx-connected').waitFor()
  await expect(page.locator('html')).toHaveAttribute('data-sidebar-collapsed', '')
  await expect(page.locator('#main-sidebar')).toBeHidden()
  await expect(page.locator('#header-sidebar-toggle')).toBeVisible()
  await page.locator('#header-sidebar-toggle').click()
  await expect(page.locator('html')).not.toHaveAttribute('data-sidebar-collapsed', '')
  await expect(page.locator('#sidebar-toggle')).toBeVisible()
  await expect(page.locator('#sidebar-toggle')).toBeFocused()
  await expect(page.locator('#staff-header-sidebar-controls')).toBeHidden()
  await expect(page.locator('#header-new-orders')).toBeVisible()
  await page.locator('#staff-profile-trigger').click()
  await expect(menu).toBeVisible()
  const menuBox = await menu.boundingBox()
  expect(menuBox).not.toBeNull()
  expect(menuBox!.x).toBeGreaterThanOrEqual(0)
  expect(menuBox!.x + menuBox!.width).toBeLessThanOrEqual(1440)
  expect(menuBox!.y).toBeGreaterThanOrEqual(0)
  expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(900)
  await page.keyboard.press('Escape')
  await page.locator('#command-palette-trigger').click()
  await expect(palette).toBeVisible()
  await page.keyboard.press('Escape')
})

test('mobile sidebar opens from the header and closes after a route change', async ({ staff }) => {
  const page = await staff('e2e_admin')

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    await branchPage(page, 'dashboard')

    const sidebar = page.locator('#main-sidebar')
    const openToggle = page.locator('#header-sidebar-toggle')
    await expect(sidebar).toBeHidden()
    await expect(openToggle).toBeVisible()
    await expect(openToggle).toHaveAttribute('aria-expanded', 'false')
    await expect(page.locator('#header-home')).toHaveAttribute('href', /\/staff\/b\/e2e\/dashboard$/)
    await expect.poll(async () => (await page.locator('#staff-header').boundingBox())?.x).toBe(0)
    await expect.poll(() => page.locator('.staff-shell-content').evaluate((el) => getComputedStyle(el).marginLeft)).toBe('0px')
    const controlsBox = await page.locator('#staff-header-sidebar-controls').boundingBox()
    const headerBox = await page.locator('#staff-header').boundingBox()
    expect(controlsBox).not.toBeNull()
    expect(headerBox).not.toBeNull()
    expect(controlsBox!.y).toBeGreaterThanOrEqual(headerBox!.y)
    expect(controlsBox!.y + controlsBox!.height).toBeLessThanOrEqual(headerBox!.y + 64)
    await expectNoHorizontalOverflow(page)
    if (width === 390) {
      await page.screenshot({ path: test.info().outputPath('sidebar-hidden-mobile.png') })
    }

    await openToggle.click()
    await expect(page.locator('html')).toHaveAttribute('data-sidebar-open', '')
    await expect.poll(async () => (await sidebar.boundingBox())?.width).toBe(288)
    await expect(page.locator('#staff-header-sidebar-controls')).toBeHidden()
    await expect(page.locator('#sidebar-toggle')).toBeFocused()
    await expect(page.locator('#sidebar-home')).toBeVisible()
    await expect(page.locator('#header-new-orders')).toBeVisible()
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
    await page.locator('#command-palette-trigger').click()
    await expect(page.locator('#command-palette')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.locator('#command-palette')).toBeHidden()
    await expect(sidebar).toBeVisible()

    const title = page.locator('#staff-header-title h1:visible')
    await expect(title).toBeVisible()
    await expect(page.locator('h1:visible')).toHaveCount(1)
    const titleBox = await title.boundingBox()
    const actionsBox = await page.locator('#staff-header > div:last-child').boundingBox()
    expect(titleBox).not.toBeNull()
    expect(actionsBox).not.toBeNull()
    expect(titleBox!.width).toBeGreaterThan(30)
    expect(titleBox!.x + titleBox!.width).toBeLessThanOrEqual(actionsBox!.x + 1)

    await page.locator('#main-sidebar nav a[href="/staff/statistics"]').click()
    await expect(page).toHaveURL(/\/staff\/statistics$/)
    await expect(page.locator('html')).not.toHaveAttribute('data-sidebar-open', '')
    await expect(sidebar).toBeHidden()
    await expect(openToggle).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await page.goto(`${adminUrl}/staff/branches`)
    await page.locator('[data-phx-main].phx-connected').waitFor()
    const createAction = page.locator('main #create-branch')
    await expect(createAction).toBeVisible()
    const actionBox = await createAction.boundingBox()
    expect(actionBox).not.toBeNull()
    expect(actionBox!.x).toBeGreaterThanOrEqual(0)
    expect(actionBox!.x + actionBox!.width).toBeLessThanOrEqual(width)
    await expectNoHorizontalOverflow(page)
  }
})

test('branch selection page uses the same portal title', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.goto(`${adminUrl}/staff/branches/select`)
  await page.locator('[data-phx-main].phx-connected').waitFor()

  await expect(page.locator('#staff-header-title h1:visible')).toHaveText('Выберите филиал')
  await expect(page.locator('h1:visible')).toHaveCount(1)
  await expect(page.locator('main h1:visible')).toHaveCount(0)
})
