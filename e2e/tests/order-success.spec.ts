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
    await expect(page.locator('.order-success-hero [aria-live] h2')).toHaveText(
      'Ждёт подтверждения',
    )
    await expect(page.locator('.order-success-hero .success-art')).toBeVisible()
    await expect(page.locator('.order-success-hero .success-art')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
    await expect
      .poll(() =>
        page
          .locator('.order-success-hero .success-art')
          .evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0)
    await expect(page.locator('.order-success-card')).toHaveClass(/is-success/)
    await expect(page.locator('.order-success-hero')).toContainText('Заказ оформлен')
    await expect(page.locator('.order-success-hero [aria-live]')).toHaveAttribute(
      'aria-live',
      'polite',
    )
    await expect(
      page.locator('.order-success-hero').getByText(/после выполнения заказа/),
    ).toHaveCount(0)
    await expect(page.locator('[data-order-success-details]')).toContainText('Итого')
    await expect(page.getByText(/установить.*экран|добавить.*экран/i)).toHaveCount(0)
    await expect(page.locator('[data-order-step="created"]')).toHaveAttribute(
      'aria-current',
      'step',
    )
    await expect(page.locator('[data-order-step="accepted"]')).not.toHaveAttribute(
      'aria-current',
      'step',
    )
    if (screenshotDir)
      await page.screenshot({
        path: `${screenshotDir}/${name}.png`,
        fullPage: true,
      })
    if (mobile) {
      await page.setViewportSize({ width: 320, height })
      const emblem = await page.locator('.order-success-hero .success-art').boundingBox()
      const status = await page.locator('.order-success-hero [aria-live] h2').boundingBox()
      const eta = await page
        .locator('.order-success-hero [aria-live]')
        .getByText(/Готовим в среднем/)
        .boundingBox()
      const summary = await page.locator('[data-order-summary]').boundingBox()
      const stages = await page.locator('.order-success-hero ol').boundingBox()
      expect(emblem).not.toBeNull()
      expect(status).not.toBeNull()
      expect(eta).not.toBeNull()
      expect(summary).not.toBeNull()
      expect(stages).not.toBeNull()
      expect(status!.x + status!.width).toBeLessThan(emblem!.x)
      expect(Math.abs(eta!.x - status!.x)).toBeLessThan(2)
      expect(eta!.y).toBeGreaterThan(status!.y + status!.height)
      expect(eta!.x + eta!.width).toBeLessThan(emblem!.x)
      expect(emblem!.x + emblem!.width / 2).toBeGreaterThan(summary!.x + summary!.width * 0.7)
      expect(
        Math.abs(emblem!.y + emblem!.height / 2 - (summary!.y + summary!.height / 2)),
      ).toBeLessThan(10)
      expect(emblem!.y + emblem!.height).toBeLessThan(stages!.y)
      await page.setViewportSize({ width, height })
    }

    const operator = await staff('e2e_operator')
    try {
      await branchPage(operator, 'orders')
      await advance(orderCard(operator, number), 'Подтвердить')
      await expect(page.locator('.order-success-hero [aria-live] h2')).toHaveText('Готовится', {
        timeout: 15_000,
      })
      await expect(page.locator('[data-order-step="preparing"]')).toHaveAttribute(
        'aria-current',
        'step',
      )
      await page.reload()
      await expect(page.locator('[data-order-step="preparing"]')).toHaveAttribute(
        'aria-current',
        'step',
      )

      if (mobile) {
        let mockedStatus: 'accepted' | 'created' | 'cancelled' | 'completed' = 'accepted'
        let mockedOrder: { data: Record<string, unknown> } | undefined
        let useMockedOrder = false
        await page.route(`**/client/orders/${orderId}`, async (route) => {
          if (route.request().method() !== 'GET') return route.continue()
          if (useMockedOrder && mockedOrder)
            return route.fulfill({ status: 200, json: mockedOrder })
          const response = await route.fetch()
          const body = (await response.json()) as {
            data: Record<string, unknown>
          }
          body.data.status = mockedStatus
          body.data.awaiting_payment = mockedStatus === 'created'
          body.data.payment_method = mockedStatus === 'created' ? 'online' : 'cash'
          body.data.points_earned = 10
          mockedOrder = body
          await route.fulfill({ response, json: body })
        })
        await page.reload()
        await expect(page.locator('.order-success-hero [aria-live] h2')).toHaveText('Приняли заказ')
        await expect(page.locator('[data-order-step="accepted"]')).toHaveAttribute(
          'aria-current',
          'step',
        )
        await expect(page.locator('[data-order-success-details]')).not.toContainText(
          /после выполнения заказа/,
        )

        mockedStatus = 'created'
        await page.reload()
        await expect(page.locator('.order-success-hero [aria-live] h2')).toHaveText(
          'Ожидает оплаты',
        )
        await expect(page.locator('.order-success-hero .success-art')).toHaveCount(0)
        await expect(page.locator('.order-success-card')).not.toHaveClass(/is-success/)
        await expect(page.locator('.order-success-hero [aria-live] > i')).toHaveClass(
          /pi-credit-card/,
        )
        await expect(page.locator('[aria-current="step"]')).toHaveCount(0)
        await expect(page.getByText(/Готовим в среднем/)).toHaveCount(0)

        mockedStatus = 'cancelled'
        await page.reload()
        await expect(page.locator('.order-success-hero [aria-live] h2')).toHaveText('Отменён')
        await expect(page.locator('.order-success-hero .success-art')).toHaveCount(0)
        await expect(page.locator('[data-order-terminal="cancelled"]')).toBeVisible()
        await expect(page.locator('[data-order-step]')).toHaveCount(0)
        await expect(page.getByText(/после выполнения заказа/)).toHaveCount(0)
        await expect(page.locator('[data-order-success-details]')).not.toContainText(
          /после выполнения заказа/,
        )

        mockedStatus = 'completed'
        await page.reload()
        await expect(page.locator('.order-success-hero [aria-live] h2')).toHaveText('Выполнен')
        await expect(page.locator('[data-order-step="ready"]')).toHaveAttribute(
          'aria-current',
          'step',
        )
        await expect(page.locator('[data-order-step]')).toHaveCount(4)

        useMockedOrder = true
        await page.route('**/client/branches/slug/e2e/select', async (route) => {
          const response = await route.fetch()
          const body = (await response.json()) as {
            data: { branch_info: { loyalty?: Record<string, unknown> } }
          }
          body.data.branch_info.loyalty = {
            ...body.data.branch_info.loyalty,
            enabled: true,
          }
          await route.fulfill({ response, json: body })
        })
        await page.locator('header').getByRole('button', { name: 'Войти' }).click()
        await page.getByRole('dialog').locator('input[name="phone"]').fill('+79990001122')
        await page.getByRole('button', { name: 'Продолжить' }).click()
        await expect(page.locator('header').getByRole('button', { name: 'Профиль' })).toBeVisible()
        await page.reload()
        const total = page.getByText('Итого', { exact: true }).locator('..')
        await expect(total.locator('xpath=following-sibling::p[1]')).toContainText('+10')
        await expect(total.locator('xpath=following-sibling::p[1]')).toContainText(
          'после выполнения заказа',
        )
        await expect(
          page.locator('.order-success-hero').getByText(/после выполнения заказа/),
        ).toHaveCount(0)
      }
    } finally {
      await operator.context().close()
    }
  })
}

test('delivery receipt reconciles item, discount and fee and completes all five stages', async ({
  page,
}) => {
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
    body.data.payment_method = 'cash'
    body.data.subtotal_amount = 59_000
    body.data.discount_amount = 10_000
    body.data.delivery_amount = 15_000
    body.data.total_amount = 64_000
    body.data.items = [
      {
        ...items[0],
        title: 'Маргарита',
        price: 49_000,
        quantity: 1,
        gift: false,
        image_url: '/test-order-photo.svg',
      },
    ]
    await route.fulfill({ response, json: body })
  })
  await page.reload()

  await expect(page.locator('[data-order-step]')).toHaveCount(5)
  await expect(page.locator('[data-order-step="completed"]')).toHaveAttribute(
    'aria-current',
    'step',
  )
  await expect(page.getByText('Маргарита', { exact: true })).toBeVisible()
  const image = page.locator('img[alt="Маргарита"]')
  await expect(image).toHaveAttribute('src', '/test-order-photo.svg')
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0))
    .toBe(true)
  await expect(page.getByText('Сумма заказа', { exact: true }).locator('..')).toContainText('590 ₽')
  await expect(page.getByText('Скидка', { exact: true }).locator('..')).toContainText('−100 ₽')
  await expect(page.getByText('Доставка', { exact: true }).locator('..')).toContainText('150 ₽')
  await expect(page.getByText('Оплата', { exact: true }).locator('..')).toContainText('Наличными')
  await expect(page.getByText('Итого', { exact: true }).locator('..')).toContainText('640 ₽')
})
