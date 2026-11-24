import { adminUrl } from '../support/env'
import { mockDeliveryAddressSuggestion, selectDeliveryAddress } from '../support/delivery-address'
import { expect, test } from '../support/test'

test('the delivery estimate uses the selected branch mode in checkout', async ({ page, staff }) => {
  const admin = await staff('e2e_admin')
  const timingPath = `${adminUrl}/staff/branches/e2e/edit/timing`
  await admin.goto(timingPath)
  await admin.locator('[data-phx-main].phx-connected').waitFor()

  const fixed = admin.locator('#timing-mode-fixed')
  const calculated = admin.locator('#timing-mode-calculated')
  const field = (name: string) => admin.locator(`#branch-timing-form input[name="timing[${name}]"]`)
  const publicTiming = async () => {
    const response = await page.request.get(`${adminUrl}/client/storefront/v1/bootstrap?slug=e2e`)
    const data = await response.json()
    return data.selected_branch?.branch_info
  }
  const save = async (button = '#timing-save') => {
    await admin.evaluate(() => {
      const state = window as Window & { timingSaved?: boolean }
      state.timingSaved = false
      window.addEventListener('phx:staff:form-saved', () => { state.timingSaved = true }, { once: true })
    })
    await admin.locator(button).click()
    await expect.poll(() => admin.evaluate(() => (window as Window & { timingSaved?: boolean }).timingSaved)).toBe(true)
  }

  const originalFixed = await field('fixed_delivery_minutes').inputValue()
  const originalMode = await fixed.isChecked() ? 'fixed' : 'calculated'
  await calculated.check()
  const originalKitchen = await field('kitchen_minutes').inputValue()
  const originalPacking = await field('packing_minutes').inputValue()
  const originalTravel = await field('travel_minutes').inputValue()

  try {
    await fixed.check()
    await field('fixed_delivery_minutes').fill('47')
    await save()

    await admin.goto(`${adminUrl}/staff/b/e2e/delivery/zones`)
    await admin.locator('[data-phx-main].phx-connected').waitFor()
    await expect(admin.locator('#delivery-timing-fixed')).toBeChecked()
    const deliveryField = admin.locator('#order_timing_fixed_delivery_minutes')
    await expect(deliveryField).toHaveValue('47')
    await deliveryField.fill('48')
    await save('#delivery-timing-save')
    await admin.goto(timingPath)
    await admin.locator('[data-phx-main].phx-connected').waitFor()
    await expect(field('fixed_delivery_minutes')).toHaveValue('48')
    await expect.poll(publicTiming).toMatchObject({ timing_mode: 'fixed', fixed_delivery_minutes: 48 })

    await mockDeliveryAddressSuggestion(page)
    await page.goto('/e2e')
    await page.getByRole('button', { name: '590 ₽' }).click()
    await page.getByText('Указать адрес доставки').click()
    await selectDeliveryAddress(page)
    await page.getByRole('button', { name: 'Подтвердить адрес' }).click()
    await page.locator('header').getByRole('button', { name: '590 ₽' }).click()
    await page.getByRole('button', { name: 'К оформлению заказа' }).click()
    await expect(page).toHaveURL(/\/e2e\/checkout$/)
    await expect(page.getByTestId('checkout-eta-duration')).toContainText(/48\s*мин/)

    await calculated.check()
    await field('kitchen_minutes').fill('26')
    await field('packing_minutes').fill('3')
    await field('travel_minutes').fill('32')
    await save()
    await expect.poll(publicTiming).toMatchObject({ timing_mode: 'calculated', kitchen_minutes: 26, packing_minutes: 3, travel_minutes: 32 })

    await page.reload()
    await expect(page.getByTestId('checkout-eta-duration')).toContainText(/61\s*мин/)
    await page.locator('input[name="phone"]').fill('+79990001122')
    const created = page.waitForResponse(response =>
      new URL(response.url()).pathname === '/client/orders' && response.request().method() === 'POST',
    )
    await page.getByRole('button', { name: 'Оформить заказ' }).click()
    const response = await created
    expect(response.ok()).toBe(true)
    const { data } = await response.json()
    const travelMinutes = (Date.parse(data.estimated_delivery_at) - Date.parse(data.estimated_ready_at)) / 60_000
    expect(travelMinutes).toBe(32)
    await expect(page).toHaveURL(/\/checkout\/order\/[^/]+$/)
  } finally {
    await admin.goto(timingPath)
    await admin.locator('[data-phx-main].phx-connected').waitFor()
    await calculated.check()
    await field('kitchen_minutes').fill(originalKitchen)
    await field('packing_minutes').fill(originalPacking)
    await field('travel_minutes').fill(originalTravel)
    await field('fixed_delivery_minutes').fill(originalFixed)
    await save()
    if (originalMode === 'fixed') {
      await fixed.check()
      await save()
    }
  }
})
