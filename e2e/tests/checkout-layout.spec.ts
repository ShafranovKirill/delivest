import { expect, test, type Page } from '@playwright/test'
import { dragSheetHandle, expectBottomSheet } from '../support/bottom-sheet'
import { mockDeliveryAddressSuggestion, selectDeliveryAddress } from '../support/delivery-address'
import { selectPickupLocation } from '../support/pickup'

type Fulfillment = 'pickup' | 'delivery'

async function openCheckout(page: Page, fulfillment: Fulfillment, width = 390) {
  if (fulfillment === 'delivery') await mockDeliveryAddressSuggestion(page)
  await page.setViewportSize({ width, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: '590 ₽' }).click()

  if (fulfillment === 'pickup') {
    await page.getByText('Заберу самостоятельно').click()
  } else {
    await page.getByText('Указать адрес доставки').click()
    await selectDeliveryAddress(page)
  }
  if (fulfillment === 'pickup') await selectPickupLocation(page)
  else await page.getByRole('button', { name: 'Подтвердить адрес' }).click()
  await page.getByRole('button', { name: '590 ₽' }).click()
  await page.getByRole('button', { name: 'К оформлению заказа' }).click()
  await expect(page).toHaveURL(/checkout/)
  await expect(page.getByRole('button', { name: 'Другое время' })).toBeVisible()
}

function paymentPicker(page: Page) {
  return page.getByText('Способ оплаты', { exact: true }).locator('..').getByRole('button')
}

for (const fulfillment of ['pickup', 'delivery'] as const) {
  test(`mobile ${fulfillment} checkout keeps time chips scrollable and summary concise`, async ({
    page,
  }) => {
    await openCheckout(page, fulfillment)

    const row = page.getByRole('button', { name: 'Другое время' }).locator('..')
    const firstChip = row.locator('button').first()
    const phoneInput = page.locator('input[name=phone]')
    const layout = await row.evaluate((element, input) => {
      const rowBox = element.getBoundingClientRect()
      const firstBox = element.querySelector('button')!.getBoundingClientRect()
      const inputBox = document.querySelector(input)!.getBoundingClientRect()
      const chips = Array.from(element.querySelectorAll('button'))
      return {
        scrollLeft: element.scrollLeft,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        rowLeft: rowBox.left,
        firstLeft: firstBox.left,
        firstRight: firstBox.right,
        inputLeft: inputBox.left,
        chipTops: chips.map((chip) => chip.getBoundingClientRect().top),
        pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
      }
    }, 'input[name=phone]')

    await expect(firstChip).toBeVisible()
    await expect(phoneInput).toBeVisible()
    expect(layout.scrollLeft).toBe(0)
    expect(layout.scrollWidth).toBeGreaterThan(layout.clientWidth)
    expect(layout.firstLeft).toBeGreaterThanOrEqual(layout.rowLeft - 1)
    expect(layout.firstRight).toBeLessThanOrEqual(layout.rowLeft + layout.clientWidth + 1)
    expect(Math.abs(layout.rowLeft - layout.inputLeft)).toBeLessThanOrEqual(1)
    expect(Math.max(...layout.chipTops) - Math.min(...layout.chipTops)).toBeLessThanOrEqual(1)
    expect(layout.pageOverflow).toBeLessThanOrEqual(1)

    await row.evaluate((element) => { element.scrollLeft = element.scrollWidth })
    await expect.poll(() => row.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
    await row.evaluate((element) => { element.scrollLeft = 0 })
    await expect.poll(() => row.evaluate((element) => element.scrollLeft)).toBe(0)
    await expect(firstChip).toBeInViewport()

    const compositionButton = page.getByRole('button', { name: '1 товар' })
    const summary = compositionButton.locator('..')
    await expect(compositionButton).toBeVisible()
    await expect(summary.locator('div.flex.justify-between', { hasText: '1 товар' })).toHaveCount(0)
    await expect(summary.getByText('Сумма заказа')).toBeVisible()
    if (fulfillment === 'delivery') await expect(summary.getByText('Доставка')).toBeVisible()

    await compositionButton.click()
    await expect(compositionButton).toHaveAttribute('aria-expanded', 'true')
    await expect(summary.getByText('Маргарита')).toBeVisible()
  })

  test(`mobile ${fulfillment} checkout payment and time dialogs use bottom sheets`, async ({ page }) => {
    await openCheckout(page, fulfillment)

    await paymentPicker(page).click()
    const payment = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Способ оплаты' }) })
    await expectBottomSheet(page, payment)
    const paymentHandle = payment.getByRole('button', { name: 'Закрыть' })
    await dragSheetHandle(page, paymentHandle, 35)
    await expect(payment).toBeVisible()
    await dragSheetHandle(page, paymentHandle, 180)
    await expect(payment).toHaveCount(0)

    await paymentPicker(page).click()
    await expectBottomSheet(page, payment)
    await page.mouse.click(8, 8)
    await expect(payment).toHaveCount(0)

    await page.getByRole('button', { name: 'Другое время' }).click()
    const time = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: 'Выберите время' }) })
    await expectBottomSheet(page, time)
    const timeSlots = time.locator('.overflow-y-auto').last()
    if (await timeSlots.evaluate((element) => element.scrollHeight > element.clientHeight + 1)) {
      await timeSlots.evaluate((element) => { element.scrollTop = element.scrollHeight })
      await expect.poll(() => timeSlots.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
      await expect(time).toBeVisible()
    }
    const timeHandle = time.getByRole('button', { name: 'Закрыть' })
    await dragSheetHandle(page, timeHandle, 35)
    await expect(time).toBeVisible()
    await dragSheetHandle(page, timeHandle, 180)
    await expect(time).toHaveCount(0)

    await page.getByRole('button', { name: 'Другое время' }).click()
    await expectBottomSheet(page, time)
    await page.mouse.click(8, 8)
    await expect(time).toHaveCount(0)
  })
}

test('desktop checkout payment and time dialogs remain centered', async ({ page }) => {
  await openCheckout(page, 'pickup', 1280)
  for (const [open, title] of [
    [() => paymentPicker(page).click(), 'Способ оплаты'],
    [() => page.getByRole('button', { name: 'Другое время' }).click(), 'Выберите время'],
  ] as const) {
    await open()
    const dialog = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: title }) })
    await expect(dialog).toBeVisible()
    const mask = page.locator('.p-dialog-mask').filter({ has: dialog })
    await expect.poll(async () => {
      const box = await dialog.boundingBox()
      const maskBox = await mask.boundingBox()
      return box && maskBox
        ? Math.abs(box.x + box.width / 2 - maskBox.x - maskBox.width / 2)
        : null
    }).toBeLessThanOrEqual(2)
    await expect.poll(async () => {
      const box = await dialog.boundingBox()
      const maskBox = await mask.boundingBox()
      return box && maskBox
        ? Math.abs(box.y + box.height / 2 - maskBox.y - maskBox.height / 2)
        : null
    }).toBeLessThanOrEqual(2)
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
  }
})
