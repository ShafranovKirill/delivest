import { expect, test, type Page } from '@playwright/test'
import { openPickupPreview, selectPickupLocation } from '../support/pickup'

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
    const quoteRequests: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/client/delivery/quote')) quoteRequests.push(request.url())
    })

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
    await expect(dialog.getByTestId('delivery-quote-caption')).toHaveCount(0)
    expect(quoteRequests).toHaveLength(0)
    await page.screenshot({ path: test.info().outputPath('address-modal.png') })
    await confirm.click()
    if (showCity) return

    await page.getByRole('button', { name: '590 ₽', exact: true }).filter({ visible: true }).click()
    await page.getByRole('button', { name: 'К оформлению заказа' }).click()
    await expect(page.getByLabel('Улица, дом')).toHaveCount(0)
    await expect.poll(() => quoteRequests.length).toBeGreaterThan(0)
    await expect(page.getByText('740 ₽', { exact: true }).filter({ visible: true }).first()).toBeVisible()

    await page.getByRole('button', { name: /Доставка.*Тверская/ }).click()
    await expect(address).toHaveValue(/Тверская/)
    await expect(address).not.toHaveValue(/Москва/)
    await confirm.click()
    await page.getByRole('button', { name: /Доставка.*Тверская/ }).click()
    await page.getByRole('radio', { name: 'Самовывоз', exact: true }).click()
    await openPickupPreview(page)
    const detail = page.getByTestId('pickup-branch-detail')
    await expect(detail.getByText('Сегодня')).toHaveCount(0)
    await expect(detail.locator('a[href^="tel:"]')).toHaveCount(0)
    await detail.getByRole('button', { name: 'Заберу здесь' }).click()
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
  await expect(page.getByRole('button', { name: 'Уточнить адрес по телефону' })).toHaveCount(0)
  await expect(page.getByText(/Выбор нового адреса сейчас недоступен/)).toBeVisible()
})

test('manual delivery uses plain address entry without map, suggestions or quote', async ({ page }) => {
  await configureAddressMode(page, { map_address: false, show_city: false, operator_address: false })
  await page.route('**/client/franchise', async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    body.data.address_map = true
    await route.fulfill({ response, json: body })
  })
  const suggestionRequests: string[] = []
  const quoteRequests: string[] = []
  const zoneRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/client/geo/suggest')) suggestionRequests.push(request.url())
    if (request.url().includes('/client/delivery/quote')) quoteRequests.push(request.url())
    if (request.url().includes('/client/delivery/zones')) zoneRequests.push(request.url())
  })
  await page.route('**/client/geo/suggest**', (route) =>
    route.fulfill({ json: { data: [{ city: 'Москва', street: 'Тверская', house: '7', value: 'Москва, Тверская, 7', latitude: 55.75, longitude: 37.61 }] } }),
  )
  await page.route('**/client/delivery/quote**', (route) =>
    route.fulfill({ json: { data: { status: 'ok', price: 15000, min_order: 0 } } }),
  )
  await page.goto('/e2e')
  await page.getByRole('button', { name: '590 ₽' }).click()
  await page.getByText('Указать адрес доставки').click()
  await expect(page.locator('.maplibregl-canvas')).toHaveCount(0)
  await page.getByLabel('Улица, дом').fill('Тверская, 7')
  await expect(page.getByRole('option', { name: /Тверская.*7/ })).toHaveCount(0)
  await expect(page.getByTestId('delivery-quote-caption')).toHaveCount(0)
  expect(suggestionRequests).toHaveLength(0)
  expect(quoteRequests).toHaveLength(0)
  expect(zoneRequests).toHaveLength(0)
  await expect(page.getByRole('button', { name: 'Подтвердить адрес' })).toBeEnabled()
  await page.getByRole('button', { name: 'Подтвердить адрес' }).click()
  await page.getByRole('button', { name: '590 ₽', exact: true }).filter({ visible: true }).click()
  await page.getByRole('button', { name: 'К оформлению заказа' }).click()
  await expect.poll(() => quoteRequests.length).toBeGreaterThan(0)
  await expect(page.getByText('740 ₽', { exact: true }).filter({ visible: true }).first()).toBeVisible()
})

test('pickup with manual delivery mode chooses a single-method branch from the compact list', async ({ page }) => {
  await page.route('**/client/franchise', async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    body.data.address_map = true
    await route.fulfill({ response, json: body })
  })
  await page.route(/\/client\/branches(?:\/[^?]+\/select)?$/, async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    const branches = Array.isArray(body.data) ? body.data : [body.data]
    for (const branch of branches) {
      if (branch?.slug === 'e2e') {
        branch.branch_info.delivery = { map_address: false, show_city: false, operator_address: false, address_mode_set: true }
        branch.branch_info.fulfillment_methods = ['delivery', 'pickup']
        branch.branch_info.latitude = 55.75
        branch.branch_info.longitude = 37.61
      }
    }
    await route.fulfill({ response, json: body })
  })

  await page.goto('/e2e')
  await page.getByRole('button', { name: '590 ₽' }).click()
  await page.getByText('Заберу самостоятельно').click()
  const dialog = page.getByRole('dialog').filter({ has: page.getByTestId('pickup-branch-list') })
  await expect(dialog).toBeVisible()
  await expect(page.locator('.maplibregl-canvas')).toHaveCount(0)
  await expect(dialog.locator('[data-map-placeholder]')).toHaveCount(0)
  await expect(page.getByTestId('pickup-branch-row').filter({ has: page.getByText('E2E', { exact: true }) })).toContainText('Москва, Тверская улица, 7')
  await selectPickupLocation(page)
  await expect(page.getByTestId('pickup-branch-detail')).toHaveCount(0)
  await expect(dialog).toBeHidden()
})

test('map style failure keeps address selection usable in a compact dialog', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await configureAddressMode(page, { map_address: true, show_city: true, operator_address: false })
  await page.route('**/client/franchise', async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    body.data.address_map = true
    await route.fulfill({ response, json: body })
  })
  await page.route('**/styles/liberty', (route) => route.abort())
  await page.route('**/client/geo/suggest**', (route) =>
    route.fulfill({ json: { data: [{ city: 'Москва', street: 'Тверская', house: '7', value: 'Москва, Тверская, 7', latitude: 55.75, longitude: 37.61 }] } }),
  )
  await page.route('**/client/delivery/quote**', (route) =>
    route.fulfill({ json: { data: { status: 'ok', price: 15000, min_order: 0 } } }),
  )
  await page.goto('/e2e')
  await page.getByRole('button', { name: '590 ₽' }).click()
  await page.getByText('Указать адрес доставки').click()
  const dialog = page.getByRole('dialog').filter({ has: page.getByLabel('Улица, дом') })
  await expect(dialog).toHaveCSS('border-top-left-radius', '24px')
  const confirm = page.getByRole('button', { name: 'Подтвердить адрес' })
  await expect(confirm).toBeDisabled()
  await page.getByLabel('Улица, дом').fill('Тверская, 7')
  await page.getByRole('option', { name: /Тверская.*7/ }).click()
  await expect(page.getByTestId('delivery-quote-caption')).toContainText('150 ₽')
  await expect(confirm).toBeEnabled()
  const box = await confirm.boundingBox()
  expect(box!.height).toBeGreaterThanOrEqual(48)
  expect(box!.x + box!.width).toBeLessThanOrEqual(320)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
})
