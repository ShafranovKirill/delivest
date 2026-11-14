import { expect, test } from '@playwright/test'
import { mockDeliveryAddressSuggestion } from '../support/delivery-address'
import { selectPickupLocation } from '../support/pickup'

for (const width of [1280, 390]) {
  test(`empty cart returns to menu at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/e2e')
    if (width < 768) {
      await page.getByRole('button', { name: '590 ₽' }).click()
      await page.getByText('Заберу самостоятельно').click()
      await selectPickupLocation(page)
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
  const card = page.getByRole('button', { name: 'Пепперони', exact: true }).first()
  const productDialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Пепперони', exact: true }) })
  await expect(card).toBeVisible()
  await card.focus()
  await page.keyboard.press('Enter')
  await expect(productDialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(productDialog).toBeHidden()
  await card.focus()
  await page.keyboard.press('Space')
  await expect(productDialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(productDialog).toBeHidden()
  await card.getByRole('button', { name: '690 ₽' }).click()
  await expect(productDialog).toBeHidden()
  await expect(card.getByRole('button', { name: '−' })).toBeVisible()
  await page.getByText('Заберу самостоятельно').click()
  await selectPickupLocation(page)
  await page.locator('header').getByRole('button', { name: '690 ₽' }).click()
  await expect(page.getByRole('dialog').getByText('Классическое')).toBeVisible()
  await page.locator('.p-drawer-close-button').click()
  await card.getByRole('button', { name: '+' }).focus()
  await page.keyboard.press('Enter')
  await expect(productDialog).toBeHidden()
  await expect(card.getByText('2', { exact: true })).toBeVisible()
})

test('cart mutation error is visible and retry succeeds', async ({ page }) => {
  await page.goto('/e2e')
  await page.getByRole('button', { name: '590 ₽' }).click()
  await page.getByText('Заберу самостоятельно').click()
  await selectPickupLocation(page)
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

test('pending delivery quote blocks address confirmation until the quote is fresh', async ({ page }) => {
  await mockDeliveryAddressSuggestion(page)
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/client/delivery/quote**', async (route) => {
    await gate
    await route.fulfill({ json: { data: {
      status: 'ok', price: 10000, min_order: 0, free_from: null, minutes: 35,
    } } })
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/e2e')
  await page.getByRole('button', { name: '590 ₽' }).click()
  await page.getByText('Указать адрес доставки').click()
  await page.getByLabel('Улица, дом').fill('Тверская, 7')
  await page.getByRole('option', { name: /Тверская.*7/ }).click()
  const confirm = page.getByRole('button', { name: 'Подтвердить адрес' })
  await expect(confirm).toBeDisabled()
  await expect(page.getByTestId('delivery-quote-caption')).toContainText('Рассчитываем')
  release()
  await expect(confirm).toBeEnabled()
  await confirm.click()
  await page.getByRole('button', { name: '590 ₽' }).click()
  const checkout = page.getByRole('button', { name: 'К оформлению заказа' })
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
