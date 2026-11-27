import type { Page, WebSocketRoute } from '@playwright/test'
import { adminUrl } from '../support/env'
import { branchPage } from '../support/staff'
import { expect, test } from '../support/test'

test('login remains usable by keyboard on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto(`${adminUrl}/staff/auth/login`)
  await page.locator('[data-phx-main].phx-connected').waitFor()

  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.locator('#user_login')).toHaveAttribute('autocomplete', 'username')
  await expect(page.locator('#user_password')).toHaveAttribute('autocomplete', 'current-password')

  const theme = page.getByRole('checkbox', { name: /т[её]мн|dark theme/i })
  await theme.focus()
  await expect(theme).toBeFocused()
  const initialTheme = await page.locator('html').getAttribute('data-theme')
  await page.keyboard.press('Space')
  await expect(page.locator('html')).toHaveAttribute('data-theme', initialTheme === 'dark' ? 'light' : 'dark')
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(1)
  await expect(page.locator('#user_login')).toBeInViewport()
  await expect(page.locator('#user_password')).toBeInViewport()
})

test('pickup board keeps both columns readable and reconnects', async ({ page }) => {
  let socket: WebSocketRoute | undefined
  let blocked = false
  await page.routeWebSocket('**/live/websocket**', ws => {
    if (blocked) return ws.close()
    socket = ws
    ws.connectToServer()
  })

  for (const theme of ['light', 'dark']) {
    await page.setViewportSize({ width: 320, height: 568 })
    await page.goto(`${adminUrl}/board/e2e-board-many`)
    await page.locator('[data-phx-main].phx-connected').waitFor()
    await page.evaluate(value => { document.documentElement.dataset.theme = value }, theme)
    await expect(page.locator('#board-preparing h2')).toBeVisible()
    await expect(page.locator('#board-ready h2')).toBeVisible()
    await expect(page.locator('#board-start')).toBeInViewport()
    for (const heading of await page.locator('[data-board-column] h2').all()) {
      expect(await heading.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
    }
    await expect.poll(() => page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )).toBeLessThanOrEqual(1)
    await page.screenshot({ path: test.info().outputPath(`board-320-${theme}.png`) })
  }

  blocked = true
  if (!socket) throw new Error('LiveView websocket did not connect')
  await socket.close()
  await expect(page.locator('#board-offline')).toBeVisible()
  blocked = false
  await expect(page.locator('[data-phx-main]')).toHaveClass(/phx-connected/, { timeout: 35_000 })
  await expect(page.locator('#board-offline')).toBeHidden()
})

test('kitchen displays lost connection and recovers on mobile', async ({ staff }) => {
  const page = await staff('e2e_kitchen')
  let socket: WebSocketRoute | undefined
  let blocked = false
  await page.routeWebSocket('**/live/websocket**', ws => {
    if (blocked) return ws.close()
    socket = ws
    ws.connectToServer()
  })

  await page.setViewportSize({ width: 320, height: 568 })
  await branchPage(page, 'kitchen')
  await expect(page.locator('#kitchen-screen')).toBeVisible()
  blocked = true
  if (!socket) throw new Error('Kitchen LiveView websocket did not connect')
  await socket.close()
  await expect(page.locator('#kitchen-offline')).toBeVisible()
  blocked = false
  await expect(page.locator('[data-phx-main]')).toHaveClass(/phx-connected/, { timeout: 35_000 })
  await expect(page.locator('#kitchen-offline')).toBeHidden()
})

test('POS modifier and quantity controls are operable by keyboard', async ({ staff }) => {
  const page: Page = await staff('e2e_cashier')
  await page.setViewportSize({ width: 390, height: 650 })
  await branchPage(page, 'pos')

  const item = page.locator('#pos-check [id^="pos-item-"]', { hasText: 'Пепперони' })
  const originalQuantity = await item.count() ? Number(await item.locator('span.w-6').innerText()) : 0
  const product = page.locator('[id^="pos-product-"]', { hasText: 'Пепперони' })
  await product.focus()
  await page.keyboard.press('Enter')
  const picker = page.locator('#pos-modifiers')
  await expect(picker.getByRole('group', { name: /E2E Тесто/ })).toBeVisible()
  const modifier = picker.getByRole('radio', { name: 'Классическое' })
  await modifier.focus()
  await expect(modifier).toBeFocused()
  await page.keyboard.press('Space')
  await expect(modifier).toBeChecked()
  await picker.getByRole('button', { name: 'Добавить' }).focus()
  await page.keyboard.press('Enter')
  await expect(picker).toBeHidden()

  await expect(item).toContainText('Классическое')
  const increase = item.getByRole('button', { name: /Увеличить|Increase/i })
  const decrease = item.getByRole('button', { name: /Уменьшить|Decrease/i })
  const quantity = item.locator('span.w-6')
  await expect(quantity).toHaveText(String(originalQuantity + 1))
  await increase.focus()
  await page.keyboard.press('Enter')
  await expect(quantity).toHaveText(String(originalQuantity + 2))
  await decrease.focus()
  await page.keyboard.press('Enter')
  await expect(quantity).toHaveText(String(originalQuantity + 1))

  await decrease.focus()
  await page.keyboard.press('Enter')
  if (originalQuantity === 0) {
    await expect(item).toHaveCount(0)
  } else {
    await expect(quantity).toHaveText(String(originalQuantity))
  }
})
