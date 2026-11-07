import { expect, test } from '../support/test'

test('fulfillment map loads only after opening the picker and survives reopening', async ({
  page,
}) => {
  const mapRequests: string[] = []
  page.on('request', (request) => {
    const url = request.url()
    if (/\/assets\/(?:PickupPane|DeliveryPane|BaseMap)-[^/?]+\.js(?:\?|$)/.test(url)) {
      mapRequests.push(url)
    }
  })

  await page.goto('/')
  await page.getByRole('button', { name: '590 ₽' }).waitFor()
  // The old prefetch fired on idle (or after its 2 s fallback).
  await page.waitForTimeout(2_300)
  expect(mapRequests).toEqual([])

  await page.getByRole('button', { name: '590 ₽' }).click()
  await page.getByText('Заберу самостоятельно').click()
  await expect(page.getByRole('button', { name: 'Заказать сюда' })).toBeVisible()
  await expect.poll(() => mapRequests.some((url) => url.includes('PickupPane'))).toBe(true)
  await expect.poll(() => mapRequests.some((url) => url.includes('BaseMap'))).toBe(true)

  await page.getByRole('button', { name: 'Закрыть' }).click()
  await expect(page.getByRole('button', { name: 'Заказать сюда' })).toBeHidden()
  await page.getByRole('button', { name: '590 ₽' }).click()
  await page.getByRole('button', { name: 'К оформлению заказа' }).click()
  await page.getByRole('button', { name: 'Адрес не выбран' }).click()
  await page.getByRole('radio', { name: 'Самовывоз' }).click()
  await expect(page.getByRole('button', { name: 'Заказать сюда' })).toBeVisible()
})
