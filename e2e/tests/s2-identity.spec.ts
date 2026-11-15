import { expect, test, type Page } from '@playwright/test'
import { adminUrl } from '../support/env'
import { mockDeliveryAddressSuggestion, selectDeliveryAddress } from '../support/delivery-address'
import { selectPickupLocation } from '../support/pickup'

type ClientSession = {
  access_token: string
  client: { id: string; phone: string }
}

const suffix = () => String(Date.now() % 10_000_000).padStart(7, '0')

async function signIn(page: Page, phone: string): Promise<ClientSession> {
  await page.locator('header').getByRole('button', { name: 'Войти' }).click()
  const confirmed = page.waitForResponse((response) =>
    /\/client\/auth\/call\/[^/]+\/complete$/.test(new URL(response.url()).pathname) &&
    response.status() === 200,
  )
  await page.getByRole('dialog').locator('input[name="phone"]').fill(phone)
  await page.getByRole('button', { name: 'Продолжить' }).click()
  const body = (await confirmed).json() as Promise<{ data: ClientSession }>
  const session = (await body).data
  await expect(page.locator('header').getByRole('button', { name: 'Профиль' })).toBeVisible()
  return session
}

async function placePickupOrder(page: Page, phone: string): Promise<string> {
  await page.goto('/e2e')
  await page.getByRole('button', { name: '590 ₽' }).click()
  await page.getByText('Заберу самостоятельно').click()
  await selectPickupLocation(page)
  await page.locator('header').getByRole('button', { name: '590 ₽' }).click()
  await page.getByRole('button', { name: 'К оформлению заказа' }).click()
  await expect(page).toHaveURL(/\/e2e\/checkout$/)
  const phoneInput = page.locator('input[name="phone"]')
  if (await phoneInput.isVisible()) await phoneInput.fill(phone)
  await page.getByRole('button', { name: 'Оформить заказ' }).click()
  await expect(page).toHaveURL(/\/e2e\/checkout\/order\/[0-9a-f-]+$/)
  return page.url().split('/').at(-1)!
}

test('A private data and a late A socket token stay out of B session', async ({ page }) => {
  const unique = suffix()
  const phoneA = `+7998${unique}`
  const phoneB = `+7997${unique}`
  const streetA = `E2E private ${unique}`

  await page.goto('/e2e')
  const a = await signIn(page, phoneA)
  const addressResponse = await page.request.post(`${adminUrl}/client/addresses`, {
    headers: { authorization: `Bearer ${a.access_token}` },
    data: { city: 'Москва', street: streetA, house: '7' },
  })
  expect(addressResponse.ok()).toBe(true)
  const addressId = ((await addressResponse.json()) as { data: { id: string } }).data.id
  const orderId = await placePickupOrder(page, phoneA)

  await page.goto('/e2e/addresses')
  await expect(page.getByText(streetA)).toBeVisible()

  let releaseOldToken!: () => void
  const oldTokenGate = new Promise<void>((resolve) => { releaseOldToken = resolve })
  let sawOldRequest!: () => void
  const oldRequest = new Promise<void>((resolve) => { sawOldRequest = resolve })
  let oldSocketToken: string | null = null
  let firstTokenRequest = true
  const openedSocketUrls: string[] = []
  page.on('websocket', (socket) => openedSocketUrls.push(socket.url()))

  await page.route('**/client/socket_token', async (route) => {
    if (!firstTokenRequest) return route.continue()
    firstTokenRequest = false
    const response = await route.fetch()
    oldSocketToken = ((await response.json()) as { data: { token: string } }).data.token
    sawOldRequest()
    await oldTokenGate
    await route.fulfill({ response })
  })

  try {
    await page.reload({ waitUntil: 'domcontentloaded' })
    await oldRequest
    await expect(page.locator('header').getByRole('button', { name: 'Профиль' })).toBeVisible()
    await page.locator('header').getByRole('button', { name: 'Профиль' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Выйти' }).click()
    await expect(page.locator('header').getByRole('button', { name: 'Войти' })).toBeVisible()
    await expect(page.getByText(streetA)).toBeHidden()

    const b = await signIn(page, phoneB)
    expect(b.client.id).not.toBe(a.client.id)
    releaseOldToken()

    const headers = { authorization: `Bearer ${b.access_token}` }
    const addressesResponse = await page.request.get(`${adminUrl}/client/addresses`, { headers })
    expect(addressesResponse.ok()).toBe(true)
    const addresses = ((await addressesResponse.json()) as { data: { id: string }[] }).data
    expect(addresses).not.toContainEqual(expect.objectContaining({ id: addressId }))

    const ordersResponse = await page.request.get(`${adminUrl}/client/orders`, { headers })
    expect(ordersResponse.ok()).toBe(true)
    const orders = ((await ordersResponse.json()) as { data: { id: string }[] }).data
    expect(orders).not.toContainEqual(expect.objectContaining({ id: orderId }))

    const detail = await page.request.get(`${adminUrl}/client/orders/${orderId}`, { headers })
    expect(detail.status()).toBe(404)
    const active = await page.request.get(`${adminUrl}/client/orders/active`, { headers })
    expect(active.ok()).toBe(true)
    expect(((await active.json()) as { data: { id: string }[] }).data).not.toContainEqual(
      expect.objectContaining({ id: orderId }),
    )

    const updateA = await page.request.put(`${adminUrl}/client/addresses/${addressId}`, {
      headers,
      data: { street: 'Should remain private' },
    })
    expect(updateA.status()).toBe(404)

    await page.goto('/e2e/addresses')
    await expect(page.getByText(streetA)).toBeHidden()
    await page.goto('/e2e/orders')
    await expect(page.getByText(orderId)).toBeHidden()
    expect(openedSocketUrls.some((url) => url.includes(encodeURIComponent(oldSocketToken!)))).toBe(false)
  } finally {
    releaseOldToken()
    await page.unroute('**/client/socket_token')
  }
})

test('checkout contact and delivery draft are cleared when A signs out and B signs in', async ({ page }) => {
  await mockDeliveryAddressSuggestion(page)
  const unique = suffix()
  const phoneA = `+7996${unique}`
  const phoneB = `+7995${unique}`
  const privateComment = `A-only checkout ${unique}`
  const privateApartment = unique.slice(-4)

  await page.goto('/e2e')
  const a = await signIn(page, phoneA)
  await page.getByRole('button', { name: '590 ₽' }).click()
  await page.getByText('Указать адрес доставки').click()
  await selectDeliveryAddress(page)
  await page.getByLabel('Квартира').fill(privateApartment)
  await page.getByRole('button', { name: 'Подтвердить адрес' }).click()
  await page.locator('header').getByRole('button', { name: '590 ₽' }).click()
  await page.getByRole('button', { name: 'К оформлению заказа' }).click()
  await expect(page).toHaveURL(/\/e2e\/checkout$/)
  await page.getByPlaceholder('Например: без лука').fill(privateComment)
  await expect(page.getByPlaceholder('Например: без лука')).toHaveValue(privateComment)

  await page.locator('header').getByRole('button', { name: 'Профиль' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Выйти' }).click()
  await signIn(page, phoneB)

  await expect(page.getByText(privateComment)).toBeHidden()
  const savedDraft = await page.evaluate(() => sessionStorage.getItem('checkout-draft'))
  if (savedDraft) expect((JSON.parse(savedDraft) as { owner: string }).owner).not.toBe(a.client.id)

  await page.goto('/e2e/checkout')
  await expect(page).toHaveURL(/\/e2e\/checkout$/)
  await expect(page.getByPlaceholder('Например: без лука')).toHaveValue('')
  await expect(page.getByText(privateApartment, { exact: true })).toBeHidden()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('radio', { name: 'Доставка' })).toBeChecked()
  await expect(page.getByLabel('Квартира')).not.toHaveValue(privateApartment)
})
