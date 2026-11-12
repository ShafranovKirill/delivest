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
  test(`manual delivery opens address fields at checkout with city ${showCity ? 'shown' : 'hidden'}`, async ({
    page,
  }) => {
    await configureAddressMode(page, {
      map_address: false,
      show_city: showCity,
      operator_address: showCity,
    })

    await page.goto('/e2e')
    await page.getByRole('button', { name: '590 ₽' }).click()
    await expect(page.getByText('Заберу самостоятельно')).toBeVisible()
    const method = page.getByRole('dialog', { name: 'Как получить заказ?' })
    await method.getByRole('button', { name: 'Доставка', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Подтвердить адрес' })).toHaveCount(0)
    if (showCity) {
      await page.getByRole('button', { name: 'Изменить', exact: true }).click()
      const pickup = page.getByRole('button', { name: 'Заказать сюда' })
      await expect(pickup).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(pickup).toBeHidden()
    }
    await page.getByRole('button', { name: '590 ₽' }).click()
    await page.getByRole('button', { name: 'К оформлению заказа' }).click()

    const city = page.getByLabel('Город', { exact: true })
    const street = page.getByLabel('Улица и дом', { exact: true })
    const operator = page.getByText('Назову адрес оператору по телефону')
    await expect(street).toBeVisible()

    if (showCity) {
      await expect(city).toBeVisible()
      await city.fill('Москва')
      await street.fill('Тверская, 7')
      await operator.click()
      await expect(city).toBeHidden()
      await expect(street).toBeHidden()
      await operator.click()
      await expect(city).toHaveValue('Москва')
      await expect(street).toHaveValue('Тверская, 7')
    } else {
      await expect(city).toBeHidden()
      await expect(operator).toBeHidden()
    }
  })
}

test('explicit map mode does not offer manual delivery when the map integration is disabled', async ({
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
  await expect(page.getByRole('alert')).toContainText('Карта адресов временно недоступна')
  await expect(page.getByRole('button', { name: 'Подтвердить адрес' })).toBeDisabled()
  await expect(page.getByLabel('Улица и дом', { exact: true })).toBeHidden()
  await expect(page.getByText('Назову адрес оператору по телефону')).toBeHidden()
})
