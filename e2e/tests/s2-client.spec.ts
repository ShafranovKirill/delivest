import { expect, test } from '@playwright/test'

for (const width of [1280, 390]) {
  test(`empty cart returns to menu at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/e2e')
    if (width < 768) {
      await page.getByRole('button', { name: '590 ₽' }).click()
      await page.getByText('Заберу самостоятельно').click()
      await page.getByRole('button', { name: 'Заказать сюда' }).click()
      await page.getByRole('button', { name: '590 ₽' }).click()
      await page.getByRole('dialog').getByRole('button', { name: 'Удалить' }).click()
    } else {
      await page.locator('header').getByRole('button', { name: 'Корзина' }).click()
    }
    await page.getByRole('button', { name: 'Перейти в каталог' }).click()
    await expect(page).toHaveURL(/\/e2e\/?$/)
  })
}

test('product card opens by Enter and Space without swallowing its add button', async ({ page }) => {
  await page.goto('/e2e')
  const card = page.getByRole('button', { name: 'Маргарита', exact: true }).first()
  await expect(card).toBeVisible()
  await card.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await card.focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await card.getByRole('button', { name: '590 ₽' }).focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(card.getByRole('button', { name: '−' })).toBeVisible()
})

test('cart mutation error is visible and retry succeeds', async ({ page }) => {
  await page.goto('/e2e')
  await page.getByRole('button', { name: '590 ₽' }).click()
  await page.getByText('Заберу самостоятельно').click()
  await page.getByRole('button', { name: 'Заказать сюда' }).click()
  await page.locator('header').getByRole('button', { name: '590 ₽' }).click()
  let fail = true
  await page.route(/\/client\/cart\/[^/]+\/items\/[^/]+/, async (route) => {
    if (route.request().method() === 'DELETE' && fail) {
      fail = false
      await route.fulfill({ status: 503, json: { error: { code: 'server_error' } } })
    } else await route.continue()
  })
  await page.getByRole('dialog').getByRole('button', { name: 'Удалить' }).click()
  await expect(page.getByRole('alert')).toContainText(/ошибка|сервер|повтор/i)
  await page.getByRole('alert').getByRole('button', { name: 'Попробовать снова' }).click()
  await expect(page.getByRole('button', { name: 'Перейти в каталог' })).toBeVisible()
})

test('pending delivery quote cannot authorize checkout', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/client/delivery/quote**', async (route) => {
    await gate
    await route.continue()
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/e2e')
  await page.getByRole('button', { name: '590 ₽' }).click()
  await page.getByText('Указать адрес доставки').click()
  await page.getByLabel('Город, улица, дом').fill('Москва, Тверская, 7')
  await page.getByRole('button', { name: 'Подтвердить адрес' }).click()
  await page.getByRole('button', { name: '590 ₽' }).click()
  const checkout = page.getByRole('button', { name: 'К оформлению заказа' })
  await expect(checkout).toBeDisabled()
  release()
  await expect(checkout).toBeEnabled()
})

test('offline and reconnect states are visible', async ({ page, context }) => {
  await page.goto('/e2e')
  await expect(page.getByRole('button', { name: 'Маргарита', exact: true })).toBeVisible()
  await context.setOffline(true)
  await expect(page.getByRole('status').filter({ hasText: 'Нет связи' })).toBeVisible()
  await context.setOffline(false)
  await expect(page.getByRole('status').filter({ hasText: 'Сеть снова доступна' })).toBeVisible()
})
