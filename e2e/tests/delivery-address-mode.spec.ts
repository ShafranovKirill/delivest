import { expect, test, type Page } from '@playwright/test'
import { selectPickupLocation } from '../support/pickup'

async function configureAddressMode(
  page: Page,
  settings: { map_address: boolean; show_city: boolean; operator_address: boolean },
) {
  await page.route(/\/client\/branches(?:\/[^?]+\/select)?$/, async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    const branches = Array.isArray(body.data) ? body.data : [body.data]

    for (const branch of branches) {
      if (branch?.slug === 'e2e' && branch.branch_info) {
        branch.branch_info.delivery = { ...settings, address_mode_set: true }
      }
    }

    await route.fulfill({ response, json: body })
  })
}

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'wait' })
})

for (const showCity of [true, false]) {
  test(`manual delivery uses the shared picker with operator ${showCity ? 'enabled' : 'disabled'}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: showCity ? 390 : 1280, height: 844 })
    await configureAddressMode(page, {
      map_address: false,
      show_city: showCity,
      operator_address: showCity,
    })
    await page.route('**/client/delivery/quote**', (route) =>
      route.fulfill({ json: { data: { status: 'ok', price: 15000, min_order: 0 } } }),
    )

    await page.goto('/e2e')
    await page.getByRole('button', { name: '590 ₽' }).click()
    await page.getByText('Указать адрес доставки').click()

    const address = page.getByLabel('Улица, дом')
    const confirm = page.getByRole('button', { name: 'Подтвердить адрес' })
    const operator = page.getByRole('button', { name: 'Уточнить адрес по телефону' })
    await expect(address).toBeVisible()
    const dialog = page.getByRole('dialog').filter({ has: address })
    await expect(address).toHaveCSS('border-top-left-radius', '24px')
    for (const label of ['Подъезд', 'Код двери', 'Этаж', 'Квартира']) {
      await expect(page.getByLabel(label)).toHaveCSS('border-top-left-radius', '24px')
    }
    await expect(confirm).toBeDisabled()
    await expect(operator).toHaveCount(showCity ? 1 : 0)
    await expect.poll(async () => {
      const dialogBox = await dialog.boundingBox()
      const buttonBox = await (showCity ? operator : confirm).boundingBox()
      return dialogBox!.y + dialogBox!.height - buttonBox!.y - buttonBox!.height
    }).toBeLessThanOrEqual(24)
    await address.fill('Тверская, 7')
    await expect(page.getByTestId('delivery-quote-caption')).toContainText('150 ₽')
    await page.screenshot({ path: test.info().outputPath('address-modal.png') })
    await confirm.click()
    if (showCity) return

    await page.getByRole('button', { name: '590 ₽', exact: true }).filter({ visible: true }).click()
    await page.getByRole('button', { name: 'К оформлению заказа' }).click()
    await expect(page.getByLabel('Улица, дом')).toHaveCount(0)
    await expect(page.getByText('740 ₽', { exact: true }).filter({ visible: true }).first()).toBeVisible()

    await page.getByRole('button', { name: /Доставка.*Тверская/ }).click()
    await expect(address).toHaveValue(/Тверская/)
    await expect(address).not.toHaveValue(/Москва/)
    await confirm.click()
    await page.getByRole('button', { name: /Доставка\s*150/ }).filter({ visible: true }).click()
    await page.getByRole('radio', { name: 'Самовывоз', exact: true }).click()
    await selectPickupLocation(page)
    await expect(page.getByRole('heading', { name: 'Заказ на самовывоз' })).toBeVisible()
    await expect(page.getByText('740 ₽', { exact: true })).toHaveCount(0)
  })
}

test('operator choice can be replaced with an address from checkout', async ({ page }) => {
  await configureAddressMode(page, {
    map_address: false,
    show_city: false,
    operator_address: true,
  })
  await page.route('**/client/delivery/quote**', (route) =>
    route.fulfill({ json: { data: { status: 'ok', price: 15000, min_order: 0 } } }),
  )
  await page.goto('/e2e')
  await page.getByRole('button', { name: '590 ₽' }).click()
  await page.getByText('Указать адрес доставки').click()
  await page.getByRole('button', { name: 'Уточнить адрес по телефону' }).click()
  await page.getByRole('button', { name: '590 ₽', exact: true }).filter({ visible: true }).click()
  await page.getByRole('button', { name: 'К оформлению заказа' }).click()
  await page.getByRole('button', { name: /Доставка.*Адрес уточним по телефону/ }).click()
  const address = page.getByLabel('Улица, дом')
  await expect(address).toBeEditable()
  await address.fill('Тверская 7к1')
  await page.getByRole('button', { name: 'Подтвердить адрес' }).click()
  await expect(page.getByRole('button', { name: /Доставка.*Тверская/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Доставка.*Адрес уточним по телефону/ })).toHaveCount(0)
  await expect(page.getByText('740 ₽', { exact: true }).filter({ visible: true }).first()).toBeVisible()
})

test('explicit map mode falls back to the compact address picker when the map integration is disabled', async ({
  page,
}) => {
  await configureAddressMode(page, {
    map_address: true,
    show_city: true,
    operator_address: true,
  })
  await page.route('**/client/franchise', async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    body.data.address_map = false
    await route.fulfill({ response, json: body })
  })

  await page.goto('/e2e')
  await page.getByRole('button', { name: '590 ₽' }).click()
  await page.getByText('Указать адрес доставки').click()
  await expect(page.locator('.maplibregl-canvas')).toHaveCount(0)
  const address = page.getByLabel('Улица, дом')
  await expect(address).toBeVisible()
  await address.fill('Москва, Тверская, 7')
  await expect(page.getByRole('button', { name: 'Подтвердить адрес' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Уточнить адрес по телефону' })).toBeVisible()
})
