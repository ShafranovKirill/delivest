import { expect, test, type Page } from '@playwright/test'

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
  test(`manual delivery uses inline address at checkout with operator ${showCity ? 'enabled' : 'disabled'}`, async ({
    page,
  }) => {
    await configureAddressMode(page, {
      map_address: false,
      show_city: showCity,
      operator_address: showCity,
    })

    await page.goto('/e2e')
    await page.getByRole('button', { name: '590 ₽' }).click()
    await expect(page.getByRole('dialog', { name: 'Как получить заказ?' })).toHaveCount(0)
    await page.locator('header').getByRole('button', { name: '590 ₽' }).click()
    await page.getByRole('button', { name: 'К оформлению заказа' }).click()
    await expect(page.getByRole('button', { name: 'Подтвердить адрес' })).toHaveCount(0)

    const address = page.getByLabel('Город, улица, дом')
    const operator = page.getByText('Назову адрес оператору по телефону')
    await expect(address).toBeVisible()
    await address.fill('Москва, Тверская, 7')
    await expect(address).toHaveValue('Москва, Тверская, 7')

    if (showCity) {
      await expect(operator).toBeVisible()
      await operator.click()
      await expect(address).toBeHidden()
      await operator.click()
      await expect(address).toBeVisible()
      await expect(address).toHaveValue(/Москва, Тверская, д 7/)
    } else {
      await expect(operator).toBeHidden()
    }
  })
}

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
  const address = page.getByLabel('Город, улица, дом')
  await expect(address).toBeVisible()
  await address.fill('Москва, Тверская, 7')
  await expect(page.getByRole('button', { name: 'Подтвердить адрес' })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Назову адрес оператору по телефону' })).toBeVisible()
})
