import { expect, test } from '../support/test'
import { placeOrder } from '../support/customer'
import { advance, branchPage, orderCard } from '../support/staff'

const screenshotDir = process.env.ORDER_SUCCESS_SCREENSHOTS

for (const [name, width, height, mobile] of [
  ['mobile', 390, 844, true],
  ['desktop', 1280, 800, false],
] as const) {
  test(`${name} order success follows staff status and handles payment and cancellation`, async ({
    page,
    staff,
  }) => {
    await page.setViewportSize({ width, height })
    const number = await placeOrder(page, 'pickup', mobile)
    const orderId = new URL(page.url()).pathname.split('/').pop()!
    await expect(page.getByText(`Заказ ${number}`, { exact: true })).toBeVisible()
    await expect(page.locator('.order-success-hero [aria-live] h2')).toHaveText('Ждёт подтверждения')
    await expect(page.getByText(/установить.*экран|добавить.*экран/i)).toHaveCount(0)
    await expect(page.locator('[data-order-step="created"]')).toHaveAttribute('aria-current', 'step')
    await expect(page.locator('[data-order-step="accepted"]')).not.toHaveAttribute('aria-current', 'step')
    if (screenshotDir) await page.screenshot({ path: `${screenshotDir}/${name}.png`, fullPage: true })

    const operator = await staff('e2e_operator')
    try {
      await branchPage(operator, 'orders')
      await advance(orderCard(operator, number), 'Подтвердить')
      await expect(page.locator('.order-success-hero [aria-live] h2')).toHaveText('Готовится', {
        timeout: 15_000,
      })
      await expect(page.locator('[data-order-step="preparing"]')).toHaveAttribute('aria-current', 'step')
      await page.reload()
      await expect(page.locator('[data-order-step="preparing"]')).toHaveAttribute('aria-current', 'step')

      if (mobile) {
        let mockedStatus: 'accepted' | 'created' | 'cancelled' | 'completed' = 'accepted'
        await page.route(`**/client/orders/${orderId}`, async (route) => {
          if (route.request().method() !== 'GET') return route.continue()
          const response = await route.fetch()
          const body = (await response.json()) as { data: Record<string, unknown> }
          body.data.status = mockedStatus
          body.data.awaiting_payment = mockedStatus === 'created'
          body.data.payment_method = mockedStatus === 'created' ? 'online' : 'cash'
          body.data.points_earned = 10
          await route.fulfill({ response, json: body })
        })
        await page.reload()
        await expect(page.locator('.order-success-hero [aria-live] h2')).toHaveText('Приняли заказ')
        await expect(page.locator('[data-order-step="accepted"]')).toHaveAttribute('aria-current', 'step')

        mockedStatus = 'created'
        await page.reload()
        await expect(page.locator('.order-success-hero [aria-live] h2')).toHaveText('Ожидает оплаты')
        await expect(page.locator('.order-success-hero [aria-live] > i')).toHaveClass(/pi-credit-card/)
        await expect(page.locator('[aria-current="step"]')).toHaveCount(0)
        await expect(page.getByText(/Готовим в среднем/)).toHaveCount(0)

        mockedStatus = 'cancelled'
        await page.reload()
        await expect(page.locator('.order-success-hero [aria-live] h2')).toHaveText('Отменён')
        await expect(page.locator('[data-order-terminal="cancelled"]')).toBeVisible()
        await expect(page.locator('[data-order-step]')).toHaveCount(0)
        await expect(page.getByText(/после выполнения заказа/)).toHaveCount(0)

        mockedStatus = 'completed'
        await page.reload()
        await expect(page.locator('.order-success-hero [aria-live] h2')).toHaveText('Выполнен')
        await expect(page.locator('[data-order-step="ready"]')).toHaveAttribute('aria-current', 'step')
        await expect(page.locator('[data-order-step]')).toHaveCount(4)
      }
    } finally {
      await operator.context().close()
    }
  })
}

test('delivery receipt reconciles item, discount and fee and completes all five stages', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await placeOrder(page, 'delivery', true)
  const orderId = new URL(page.url()).pathname.split('/').pop()!

  await page.route('**/test-order-photo.svg', (route) =>
    route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="orange"/></svg>',
    }),
  )
  await page.route(`**/client/orders/${orderId}`, async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    const response = await route.fetch()
    const body = (await response.json()) as { data: Record<string, unknown> }
    const items = body.data.items as Array<Record<string, unknown>>
    body.data.status = 'completed'
    body.data.subtotal_amount = 59_000
    body.data.discount_amount = 10_000
    body.data.delivery_amount = 15_000
    body.data.total_amount = 64_000
    body.data.items = [{ ...items[0], title: 'Маргарита', price: 49_000, quantity: 1, gift: false, image_url: '/test-order-photo.svg' }]
    await route.fulfill({ response, json: body })
  })
  await page.reload()

  await expect(page.locator('[data-order-step]')).toHaveCount(5)
  await expect(page.locator('[data-order-step="completed"]')).toHaveAttribute('aria-current', 'step')
  await expect(page.getByText('Маргарита', { exact: true })).toBeVisible()
  const image = page.locator('img[alt="Маргарита"]')
  await expect(image).toHaveAttribute('src', '/test-order-photo.svg')
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
  await expect(page.getByText('Сумма заказа', { exact: true }).locator('..')).toContainText('590 ₽')
  await expect(page.getByText('Скидка', { exact: true }).locator('..')).toContainText('−100 ₽')
  await expect(page.getByText('Доставка', { exact: true }).locator('..')).toContainText('150 ₽')
  await expect(page.getByText('Оплата', { exact: true }).locator('..')).toContainText('Наличными')
  await expect(page.getByText('Итого', { exact: true }).locator('..')).toContainText('640 ₽')
})
