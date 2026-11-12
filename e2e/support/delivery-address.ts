import { expect, type Page } from '@playwright/test'

const address = {
  city: 'Москва',
  street: 'Тверская',
  house: '7',
  value: 'Москва, Тверская, 7',
  latitude: 55.757718,
  longitude: 37.611347,
  fias_id: null,
  postal_code: null,
  district: null,
  geo_precision: 0,
}

export async function mockDeliveryAddressSuggestion(page: Page) {
  await page.route('**/client/franchise', async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    body.data.address_map = true
    await route.fulfill({ response, json: body })
  })
  await page.route('**/client/geo/suggest**', async (route) => {
    await route.fulfill({ json: { data: [address] } })
  })
}

export async function selectDeliveryAddress(page: Page) {
  await page.getByLabel('Улица, дом').fill('Тверская, 7')
  await page.getByRole('option', { name: /Тверская.*7/ }).click()
  await expect(page.getByRole('button', { name: 'Подтвердить адрес' })).toBeEnabled()
}
