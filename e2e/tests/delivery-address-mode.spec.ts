import { expect, test, type Page } from '@playwright/test'
import { dragSheetHandle, expectBottomSheet } from '../support/bottom-sheet'
import { selectPickupLocation } from '../support/pickup'

async function configureAddressMode(
  page: Page,
  settings: { map_address: boolean; show_city: boolean; operator_address: boolean },
  addressMap?: boolean,
) {
  await page.route('**/client/storefront/v1/bootstrap?*', async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    const branches = [...body.branches, body.selected_branch]

    if (addressMap !== undefined) body.franchise.address_map = addressMap

    for (const branch of branches) {
      if (branch?.slug === 'e2e' && branch.branch_info) {
        branch.branch_info.delivery = { ...settings, address_mode_set: true }
      }
    }

    await route.fulfill({ response, json: body })
  })
}

async function configureFranchiseAddressMap(page: Page, addressMap: boolean) {
  await page.route('**/client/storefront/v1/bootstrap?*', async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    body.franchise.address_map = addressMap
    await route.fulfill({ response, json: body })
  })
}

async function configureSavedAddress(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem('auth', JSON.stringify({
      accessToken: null,
      refreshToken: 'qa',
      client: { id: '11111111-1111-4111-8111-111111111111', phone: '+70000000000' },
    })),
  )
  await page.route('**/client/**', (route) => {
    const headers = { ...route.request().headers() }
    delete headers.authorization
    return route.fallback({ headers })
  })
  await page.route('**/client/addresses', (route) => route.fulfill({ json: {
    data: [{ id: 'saved', street: 'Тверская', house: '7', city: 'Москва', label: 'Сохранённый адрес' }],
  } }))
  await page.route(/\/client\/(?:orders\/active|notifications|loyalty|socket_token)(?:\?.*)?$/, (route) =>
    route.fulfill({ json: { data: [] } }),
  )
}

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'wait' })
})

for (const mapAddress of [false, true]) {
  for (const theme of ['light', 'dark'] as const) {
    test(`delivery fields keep readable focus colors in ${theme} theme with map ${mapAddress}`, async ({ page }) => {
      await page.setViewportSize({ width: mapAddress ? 390 : 1280, height: 844 })
      await page.addInitScript((value) => localStorage.setItem('delivest-theme', value), theme)
      await configureAddressMode(page, {
        map_address: mapAddress,
        show_city: true,
        operator_address: true,
      }, mapAddress)
      await page.route('**/client/geo/suggest**', (route) => route.fulfill({ json: { data: [] } }))
      await page.goto('/e2e')
      await expect(page.locator('html')).toHaveClass(theme === 'dark' ? /dark/ : /^(?!.*\bdark\b)/)
      await page.getByRole('button', { name: '590 ₽' }).click()
      await page.getByText('Указать адрес доставки').click()
      for (const label of ['Улица, дом', 'Подъезд', 'Код двери', 'Этаж', 'Квартира']) {
        const field = page.getByLabel(label, { exact: true })
        await field.click()
        await expect(field).toBeFocused()
        await expect(field).toHaveCSS('background-color', theme === 'dark' ? 'rgb(23, 23, 27)' : 'rgb(255, 255, 255)')
        await field.fill(label === 'Улица, дом' ? 'Тверская, 7' : '1')
        await expect(field).toHaveCSS('background-color', theme === 'dark' ? 'rgb(23, 23, 27)' : 'rgb(255, 255, 255)')
        await expect(field).not.toHaveCSS('color', theme === 'dark' ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)')
      }
      await page.screenshot({ path: test.info().outputPath('delivery-focus-colors.png') })
    })
  }
}

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
    let quotes = 0
    let quotesWithCoordinates = 0
    await page.route('**/client/delivery/quote**', (route) => {
      quotes++
      if (/[?&](?:latitude|longitude)=/.test(route.request().url())) quotesWithCoordinates++
      return route.fulfill({ json: { data: { status: 'ok', price: 15000, min_order: 0 } } })
    })
    let zones = 0
    await page.route('**/client/delivery/zones**', (route) => { zones++; return route.continue() })

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
    await expect(confirm).toBeEnabled()
    await expect(page.getByTestId('delivery-quote-caption')).toHaveCount(0)
    expect(quotes).toBe(0)
    expect(zones).toBe(0)
    await page.screenshot({ path: test.info().outputPath('address-modal.png') })
    await confirm.click()
    if (showCity) return

    await page.getByRole('button', { name: '590 ₽', exact: true }).filter({ visible: true }).click()
    await page.getByRole('button', { name: 'К оформлению заказа' }).click()
    await expect(page.getByLabel('Улица, дом')).toHaveCount(0)
    await expect(page.getByText('740 ₽', { exact: true }).filter({ visible: true }).first()).toBeVisible()
    expect(quotes).toBeGreaterThan(0)
    expect(quotesWithCoordinates).toBe(0)

    await page.getByRole('button', { name: /Адрес доставки:.*Тверская/ }).click()
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

test('mobile manual delivery grows naturally while pickup keeps its height', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await configureAddressMode(page, { map_address: false, show_city: true, operator_address: true })
  await configureSavedAddress(page)
  await page.goto('/e2e')
  await page.getByRole('button', { name: '590 ₽' }).click()
  await page.getByText('Указать адрес доставки').click()

  const dialog = page.getByRole('dialog').filter({ has: page.getByRole('radiogroup') })
  const modes = dialog.getByRole('radiogroup').first()
  const bounds = async () => {
    const box = await dialog.boundingBox()
    expect(box).not.toBeNull()
    return { top: box!.y, height: box!.height }
  }
  const overflow = () => dialog.evaluate((root) =>
    Math.max(0, ...[root, ...root.querySelectorAll<HTMLElement>('*')]
      .filter((element) => ['auto', 'scroll'].includes(getComputedStyle(element).overflowY))
      .map((element) => element.scrollHeight - element.clientHeight)),
  )
  await expectBottomSheet(page, dialog)
  await expect(dialog.getByText('Сохранённый адрес')).toBeVisible()
  await expect(dialog.getByLabel('Улица, дом')).toBeVisible()
  const delivery = await bounds()
  expect(delivery.height).toBeGreaterThan(416)
  expect(await overflow()).toBeLessThanOrEqual(2)
  const operator = dialog.getByRole('button', { name: 'Уточнить адрес по телефону' })
  await expect(operator).toBeVisible()

  await modes.getByRole('radio', { name: 'Самовывоз' }).click()
  await expect(dialog.getByTestId('pickup-branch-list')).toBeVisible()
  const pickup = await bounds()
  expect(pickup.height).toBeLessThanOrEqual(416.5)
  expect(pickup.top).toBeGreaterThan(delivery.top)

  await modes.getByRole('radio', { name: 'Доставка' }).click()
  await expect(dialog.getByLabel('Улица, дом')).toBeVisible()
  const returned = await bounds()
  expect(Math.abs(returned.height - delivery.height)).toBeLessThanOrEqual(1)
  expect(await overflow()).toBeLessThanOrEqual(2)
  await expect(operator).toBeVisible()

  await page.setViewportSize({ width: 320, height: 480 })
  await expect.poll(async () => (await dialog.boundingBox())?.height ?? 0).toBeLessThanOrEqual(480)
  expect(await overflow()).toBeLessThanOrEqual(2)
  await expect(operator).toBeInViewport()
  await modes.getByRole('radio', { name: 'Самовывоз' }).click()
  await expect(dialog.getByTestId('pickup-branch-list')).toBeVisible()
  await expect.poll(async () => (await dialog.boundingBox())?.height ?? 0).toBeLessThanOrEqual(408.5)
  await modes.getByRole('radio', { name: 'Доставка' }).click()
  await page.setViewportSize({ width: 320, height: 360 })
  await expect.poll(async () => (await dialog.boundingBox())?.height ?? 0).toBeLessThanOrEqual(360)
  await expect.poll(overflow).toBeGreaterThan(2)
  await operator.scrollIntoViewIfNeeded()
  await expect(operator).toBeInViewport()
})

test('manual delivery without the operator action fits its content', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await configureAddressMode(page, { map_address: false, show_city: true, operator_address: false })
  await page.goto('/e2e')
  await page.getByRole('button', { name: '590 ₽' }).click()
  await page.getByText('Указать адрес доставки').click()
  const dialog = page.getByRole('dialog').filter({ has: page.getByLabel('Улица, дом') })
  await expectBottomSheet(page, dialog)
  await expect(dialog.getByRole('button', { name: 'Уточнить адрес по телефону' })).toHaveCount(0)
  expect(await dialog.evaluate((root) => {
    const content = root.querySelector('.p-dialog-content')!
    return content.scrollHeight - content.clientHeight
  })).toBeLessThanOrEqual(2)
})

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
  await page.getByRole('button', { name: /Адрес доставки:.*Адрес уточним по телефону/ }).click()
  const address = page.getByLabel('Улица, дом')
  await expect(address).toBeEditable()
  await address.fill('Тверская 7к1')
  await page.getByRole('button', { name: 'Подтвердить адрес' }).click()
  await expect(page.getByRole('button', { name: /Адрес доставки:.*Тверская/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Адрес доставки:.*Адрес уточним по телефону/ })).toHaveCount(0)
  await expect(page.getByText('740 ₽', { exact: true }).filter({ visible: true }).first()).toBeVisible()
})

test('explicit map mode falls back to the compact address picker when the map integration is disabled', async ({
  page,
}) => {
  await configureAddressMode(page, {
    map_address: true,
    show_city: true,
    operator_address: true,
  }, false)

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

test('manual delivery offers suggestions without opening a map', async ({ page }) => {
  await configureAddressMode(page, { map_address: false, show_city: false, operator_address: false }, true)
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
  await page.getByRole('option', { name: /Тверская.*7/ }).click()
  await expect(page.getByTestId('delivery-quote-caption')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Подтвердить адрес' })).toBeEnabled()
})

test('map style failure keeps address selection usable in a compact dialog', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await configureAddressMode(page, { map_address: true, show_city: true, operator_address: false }, true)
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
  await expectBottomSheet(page, dialog)
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

test('mobile map-free delivery uses a bottom sheet with handle dismissal', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await configureAddressMode(page, { map_address: false, show_city: false, operator_address: false })
  await page.goto('/e2e')
  await page.getByRole('button', { name: '590 ₽' }).click()
  await page.getByText('Указать адрес доставки').click()

  const dialog = page.getByRole('dialog').filter({ has: page.getByLabel('Улица, дом') })
  await expectBottomSheet(page, dialog)
  await expect(page.locator('.maplibregl-canvas')).toHaveCount(0)
  const handle = dialog.getByRole('button', { name: 'Закрыть' })
  await dragSheetHandle(page, handle, 35)
  await expect(dialog).toBeVisible()
  await dragSheetHandle(page, handle, 180)
  await expect(dialog).toHaveCount(0)
})

test('mobile map-free pickup uses a bottom sheet with backdrop dismissal', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 })
  await configureFranchiseAddressMap(page, false)
  await page.goto('/e2e')
  await page.getByRole('button', { name: '590 ₽' }).click()
  await page.getByText('Заберу самостоятельно').click()

  const dialog = page.getByRole('dialog').filter({ has: page.getByTestId('pickup-branch-list') })
  await expectBottomSheet(page, dialog)
  await expect(page.locator('.maplibregl-canvas')).toHaveCount(0)
  const handle = dialog.getByRole('button', { name: 'Закрыть' })
  await dragSheetHandle(page, handle, 35)
  await expect(dialog).toBeVisible()
  await page.mouse.click(8, 8)
  await expect(dialog).toHaveCount(0)
})

test('pickup with manual delivery mode previews a single-method branch before confirmation', async ({ page }) => {
  await page.route('**/client/storefront/v1/bootstrap?*', async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    body.franchise.address_map = true
    const branches = [...body.branches, body.selected_branch]
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
  await page.getByTestId('pickup-branch-row').filter({ has: page.getByText('E2E', { exact: true }) }).click()
  const detail = page.getByTestId('pickup-branch-detail')
  await expect(detail).toBeVisible()
  await expect(detail.getByRole('radiogroup')).toHaveCount(0)
  await detail.getByRole('button', { name: 'Назад' }).click()
  await selectPickupLocation(page)
  await expect(page.getByTestId('pickup-branch-detail')).toHaveCount(0)
  await expect(dialog).toBeHidden()
})
