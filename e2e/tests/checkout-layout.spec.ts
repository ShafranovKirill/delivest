import { expect, test, type Page } from '@playwright/test'
import { dragSheetHandle, expectBottomSheet } from '../support/bottom-sheet'
import { mockDeliveryAddressSuggestion, selectDeliveryAddress } from '../support/delivery-address'
import { selectPickupLocation } from '../support/pickup'

type Fulfillment = 'pickup' | 'delivery'

const hours = Object.fromEntries(
  ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    .map((day) => [day, { enabled: true, open: '09:00', close: '23:00' }]),
)

async function seedAvailability(page: Page) {
  await page.clock.setFixedTime(new Date('2026-11-16T07:00:00Z'))
  await page.route(/\/client\/branches(?:\/.*\/select)?$/, async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    const branches = Array.isArray(body.data) ? body.data : [body.data]
    for (const branch of branches) {
      if (branch?.slug !== 'e2e' || !branch.branch_info) continue
      Object.assign(branch.branch_info, {
        timezone: 'Europe/Moscow',
        delivery_time: 60,
        working_hours: hours,
        special_hours: {},
        intake: { mode: 'active' },
      })
    }
    await route.fulfill({ response, json: body })
  })
}

async function openCheckout(page: Page, fulfillment: Fulfillment, width = 390) {
  await seedAvailability(page)
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
  const caption = fulfillment === 'pickup' ? 'Время самовывоза' : 'Время доставки'
  const timeButton = page.getByRole('button', { name: new RegExp('^' + caption + ':') })
  await expect(timeButton).toBeVisible()
  return timeButton
}

function paymentPicker(page: Page) {
  return page.getByText('Способ оплаты', { exact: true }).locator('..').getByRole('button')
}

for (const fulfillment of ['pickup', 'delivery'] as const) {
  test('mobile ' + fulfillment + ' checkout selects an exact time and keeps the summary concise', async ({ page }) => {
    const timeButton = await openCheckout(page, fulfillment)
    const phoneInput = page.locator('input[name=phone]')
    const layout = await timeButton.evaluate((element, input) => {
      const buttonBox = element.getBoundingClientRect()
      const inputBox = document.querySelector(input)!.getBoundingClientRect()
      return {
        buttonLeft: buttonBox.left,
        buttonRight: buttonBox.right,
        inputLeft: inputBox.left,
        pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
      }
    }, 'input[name=phone]')

    await expect(phoneInput).toBeVisible()
    expect(Math.abs(layout.buttonLeft - layout.inputLeft)).toBeLessThanOrEqual(1)
    expect(layout.buttonRight).toBeLessThanOrEqual(391)
    expect(layout.pageOverflow).toBeLessThanOrEqual(1)

    const compositionButton = page.getByRole('button', { name: '1 товар' })
    const summary = compositionButton.locator('xpath=../..')
    await expect(compositionButton).toBeVisible()
    await expect(summary.locator('div.flex.justify-between', { hasText: '1 товар' })).toHaveCount(0)
    const totals = summary.locator('..')
    await expect(totals.getByText('Товары', { exact: true })).toBeVisible()
    await expect(totals.getByText('К оплате', { exact: true })).toBeVisible()
    if (fulfillment === 'delivery') await expect(totals.getByRole('button', { name: /^Доставка/ })).toBeVisible()

    await compositionButton.click()
    await expect(compositionButton).toHaveAttribute('aria-expanded', 'true')
    await expect(summary.getByText('Маргарита')).toBeVisible()

    const originalLabel = await timeButton.getAttribute('aria-label')
    await timeButton.click()
    const title = fulfillment === 'pickup' ? 'Когда заберёте заказ?' : 'Когда привезти заказ?'
    const dialog = page.getByRole('dialog', { name: title })
    await expect(dialog).toBeVisible()
    const asap = dialog.getByRole('button', { name: 'Побыстрее' })
    const scheduled = dialog.getByRole('button', { name: 'Ко времени' })
    await expect(asap).toHaveAttribute('aria-pressed', 'true')
    await scheduled.click()
    await expect(scheduled).toHaveAttribute('aria-pressed', 'true')

    const dayGroup = dialog.getByRole('group', { name: 'День получения' })
    await expect(dayGroup.getByRole('button')).toHaveCount(3)
    await expect(dayGroup.getByRole('button', { name: 'Сегодня' })).toBeVisible()
    await expect(dayGroup.getByRole('button', { name: 'Завтра', exact: true })).toBeVisible()
    await expect(dayGroup.getByRole('button', { name: 'Послезавтра', exact: true })).toBeVisible()
    await dayGroup.getByRole('button', { name: 'Завтра', exact: true }).click()
    const timeInput = dialog.getByRole('textbox', {
      name: fulfillment === 'pickup' ? 'Время получения' : 'Время доставки',
    })
    await timeInput.fill('13:17')
    await expect(timeInput).toHaveValue('13:17')
    const confirmLabel = fulfillment === 'pickup' ? 'Заберу в 13:17' : 'Доставить к 13:17'
    await expect(dialog.getByRole('button', { name: confirmLabel })).toBeEnabled()

    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(timeButton).toHaveAttribute('aria-label', originalLabel!)

    await timeButton.click()
    await expect(dialog).toBeVisible()
    await expect(asap).toHaveAttribute('aria-pressed', 'true')
    await scheduled.click()
    await dayGroup.getByRole('button', { name: 'Завтра', exact: true }).click()
    await timeInput.fill('13:17')
    await dialog.getByRole('button', { name: confirmLabel }).click()
    await expect(dialog).toBeHidden()
    await expect(timeButton).toHaveAttribute('aria-label', /Завтра, 13:17/)

    await timeButton.click()
    await expect(scheduled).toHaveAttribute('aria-pressed', 'true')
    await expect(dayGroup.getByRole('button', { name: 'Завтра', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(timeInput).toHaveValue('13:17')
  })

  test(`mobile ${fulfillment} checkout payment and time dialogs use bottom sheets`, async ({ page }) => {
    const timeButton = await openCheckout(page, fulfillment)

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

    await timeButton.click()
    const time = page.getByRole('dialog').filter({ has: page.getByRole('heading', { name: fulfillment === 'pickup' ? 'Когда заберёте заказ?' : 'Когда привезти заказ?' }) })
    await expectBottomSheet(page, time)
    const timeHandle = time.getByRole('button', { name: 'Закрыть' })
    await dragSheetHandle(page, timeHandle, 35)
    await expect(time).toBeVisible()
    await dragSheetHandle(page, timeHandle, 180)
    await expect(time).toHaveCount(0)

    await timeButton.click()
    await expectBottomSheet(page, time)
    await page.mouse.click(8, 8)
    await expect(time).toHaveCount(0)
  })
}

test('desktop checkout payment and time dialogs remain centered', async ({ page }) => {
  const timeButton = await openCheckout(page, 'pickup', 1280)
  for (const [open, title] of [
    [() => paymentPicker(page).click(), 'Способ оплаты'],
    [() => timeButton.click(), 'Когда заберёте заказ?'],
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
