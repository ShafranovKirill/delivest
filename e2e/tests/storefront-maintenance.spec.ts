import { test, expect } from '../support/test'
import { adminUrl } from '../support/env'

test('maintenance switches by branch and franchise, updates an open tab, and renders in both themes and on mobile', async ({ page, browser, staff }, testInfo) => {
  const admin = await staff('e2e_admin')
  const branchUrl = `${adminUrl}/staff/branches/e2e/edit/general`
  const franchiseUrl = `${adminUrl}/staff/franchise/maintenance`
  const branchToggle = admin.locator('input[type="checkbox"][name="branch_form[maintenance_enabled]"]')
  const franchiseToggle = admin.locator('input[type="checkbox"][name="settings[maintenance_enabled]"]')
  const maintenance = page.locator('#storefront-maintenance')
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true })
  const mobilePage = await mobile.newPage()

  async function saveBranch(enabled: boolean) {
    await admin.goto(branchUrl)
    await admin.locator('[data-phx-main].phx-connected').waitFor()
    if (await branchToggle.isChecked() === enabled) return
    if (enabled) await branchToggle.check()
    else await branchToggle.uncheck()
    await admin.locator('#staff-header-actions button[form="branch-form"]').click()
    await expect(admin.locator('#flash-group')).toContainText(/сохран|saved/i)
  }

  async function saveFranchise(enabled: boolean) {
    await admin.goto(franchiseUrl)
    await admin.locator('[data-phx-main].phx-connected').waitFor()
    if (await franchiseToggle.isChecked() === enabled) return
    if (enabled) await franchiseToggle.check()
    else await franchiseToggle.uncheck()
    await admin.locator('#franchise-settings-form button[type="submit"]').click()
    await expect(admin.locator('#flash-group')).toContainText(/сохран|saved/i)
  }

  try {
    await page.goto('/e2e')
    await expect(page.getByRole('button', { name: 'Маргарита', exact: true })).toBeVisible()
    await page.goto('/e2e/checkout')
    await expect(page).toHaveURL(/\/e2e\/checkout$/)
    await saveBranch(true)
    await expect(maintenance).toBeVisible({ timeout: 25_000 })
    await expect(maintenance.getByRole('heading', { name: 'На сайте ведутся технические работы' })).toBeVisible()
    await page.screenshot({ path: testInfo.outputPath('rf01-desktop-light.png'), fullPage: true })

    await page.evaluate(() => document.documentElement.classList.add('dark'))
    const darkContrast = () => page.evaluate(() => {
      const screen = document.querySelector('#storefront-maintenance')!
      const action = screen.querySelector('a[href*="select-branch"]')!
      const description = screen.querySelector('p.opacity-75')!
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      const context = canvas.getContext('2d')!
      const channels = (value: string) => {
        context.clearRect(0, 0, 1, 1)
        context.fillStyle = value
        context.fillRect(0, 0, 1, 1)
        return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3)
      }
      const lightness = (rgb: number[]) => rgb.map(channel => {
        const value = channel / 255
        return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4
      }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index]!, 0)
      const background = channels(getComputedStyle(screen).backgroundColor)
      const ratio = (foreground: number[]) => {
        const a = lightness(foreground), b = lightness(background)
        return (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
      }
      const descriptionStyle = getComputedStyle(description)
      const opacity = Number(descriptionStyle.opacity)
      const blended = channels(descriptionStyle.color).map((value, index) => value * opacity + background[index]! * (1 - opacity))
      return { action: ratio(channels(getComputedStyle(action).color)), description: ratio(blended) }
    })
    await expect.poll(async () => (await darkContrast()).action).toBeGreaterThanOrEqual(4.5)
    expect((await darkContrast()).description).toBeGreaterThanOrEqual(4.5)
    await page.screenshot({ path: testInfo.outputPath('rf01-desktop-dark.png'), fullPage: true, animations: 'disabled' })

    await mobilePage.goto('http://localhost:3100/e2e')
    await expect(mobilePage.locator('#storefront-maintenance')).toBeVisible()
    await mobilePage.screenshot({ path: testInfo.outputPath('rf01-mobile-light.png'), fullPage: true, animations: 'disabled' })
    await mobilePage.evaluate(() => document.documentElement.classList.add('dark'))
    await mobilePage.screenshot({ path: testInfo.outputPath('rf01-mobile-dark.png'), fullPage: true, animations: 'disabled' })

    await maintenance.getByRole('link', { name: 'Выбрать другой филиал' }).click()
    await expect(page).toHaveURL(/\/select-branch/)
    await expect(page.getByRole('heading', { name: 'Выберите филиал' })).toBeVisible()

    await saveBranch(false)
    await page.goto('/e2e')
    await expect(page.getByRole('button', { name: 'Маргарита', exact: true })).toBeVisible()

    await saveFranchise(true)
    await expect(maintenance).toBeVisible({ timeout: 25_000 })
    await mobilePage.goto('http://localhost:3100/select-branch')
    await expect(mobilePage.locator('#storefront-maintenance')).toBeVisible()

    await saveFranchise(false)
    await expect(page.getByRole('button', { name: 'Маргарита', exact: true })).toBeVisible({ timeout: 25_000 })
  } finally {
    await saveFranchise(false).catch(() => undefined)
    await saveBranch(false).catch(() => undefined)
    await mobile.close()
  }
})
