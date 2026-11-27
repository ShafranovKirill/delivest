import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 }, actionTimeout: 7000 })

const comboName = 'Обед с бургером'
const comboKey = 'ea526768-e2c5-4b0c-a594-6a177e13ee51'
const burger = 'efadd200-a0f1-4c91-b982-ea526768e2c5'
const sauce = 'efadd200-a0f1-4c91-b982-ea526768e2c6'
const stoppedBurger = 'efadd200-a0f1-4c91-b982-ea526768e2c7'

function option(id: string, name: string, price: number, stopped = false) {
  return { id, name, price, stopped, is_default: false, max_quantity: 1 }
}

function combo() {
  return {
    name: comboName,
    price: 50000,
    old_price: null,
    is_combo: true,
    stopped: false,
    modifier_groups: [
      {
        id: 'burger-group',
        name: 'Бургер',
        min: 1,
        max: 1,
        is_size: false,
        modifiers: [
          option(burger, 'Чизбургер', 7000),
          option(stoppedBurger, 'Двойной бургер', 12000, true),
        ],
      },
      {
        id: 'sauce-group',
        name: 'Соус',
        min: 0,
        max: 1,
        is_size: false,
        modifiers: [option(sauce, 'Сырный соус', 2500)],
      },
    ],
  }
}

test('a combo opens configuration, displays surcharges and requires an available choice', async ({
  page,
}) => {
  let comboProductId: string
  const addRequests: unknown[] = []

  await page.route('**/client/storefront/v1/bootstrap?*', async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    const category = body.menu.find((entry: { products: unknown[] }) => entry.products?.length)
    comboProductId = category.products[0].id
    Object.assign(category.products[0], combo())
    await route.fulfill({ response, json: body })
  })
  await page.route(/\/client\/branches\/[^/]+\/products\/[^/?]+(?:\?|$)/, async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    if (body.data?.id === comboProductId) Object.assign(body.data, combo())
    await route.fulfill({ response, json: body })
  })
  await page.route(/\/client\/cart\/[^/]+\/items\/[^/?]+(?:\?|$)/, async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    addRequests.push(route.request().postDataJSON())
    await route.fulfill({
      status: 400,
      json: { error: 'product_unavailable' },
    })
  })

  await page.goto('/e2e')
  await page.getByRole('button', { name: 'Собрать комбо' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: comboName })).toBeVisible()
  const add = dialog.getByRole('button', { name: /В корзину за/ })
  await expect(add).toBeDisabled()
  await expect(dialog.getByRole('button', { name: /Двойной бургер/ })).toBeDisabled()
  await expect(dialog.getByRole('button', { name: /Чизбургер.*70/ })).toBeVisible()
  expect(addRequests).toEqual([])

  await dialog.getByRole('button', { name: /Чизбургер/ }).click()
  await expect(add).toHaveText(/570\s*₽/)
  await dialog.getByRole('button', { name: /Сырный соус/ }).click()
  await expect(add).toHaveText(/595\s*₽/)

  await add.click()
  await expect
    .poll(() => addRequests)
    .toEqual([
      {
        quantity: 1,
        modifiers: [
          { id: burger, quantity: 1 },
          { id: sauce, quantity: 1 },
        ],
      },
    ])
})

test('checkout explains an incompatible combo and removes that line directly', async ({ page }) => {
  let emptyCart: Record<string, unknown>
  let removed = false
  const item = {
    key: comboKey,
    product_id: comboKey,
    name: comboName,
    quantity: 1,
    price: 50000,
    base_total: 50000,
    total_price: 50000,
    promotion_ids: [],
    modifiers: [],
    unavailable: true,
    unavailable_reason: 'combo_requires_delivest',
  }
  await page.route(/\/client\/cart(?:\?|$)/, async (route) => {
    const response = await route.fetch()
    const { data } = await response.json()
    emptyCart = data
    await route.fulfill({
      response,
      json: { data: removed ? data : { ...data, items: [item] } },
    })
  })
  await page.route('**/client/session/bootstrap?*', async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    if (body.cart) {
      emptyCart = body.cart
      if (!removed) body.cart = { ...body.cart, items: [item] }
    }
    await route.fulfill({ response, json: body })
  })
  await page.route(`**/client/cart/*/items/${comboKey}?all=true`, async (route) => {
    expect(route.request().method()).toBe('DELETE')
    removed = true
    await route.fulfill({ json: { data: emptyCart } })
  })

  await page.goto('/e2e/checkout')
  const warning = page.getByText('Комбо недоступно: филиал передаёт заказы во внешнюю систему.')
  await expect(warning).toBeVisible()
  const addressPicker = page.getByRole('dialog', { name: 'Куда привезти?' })
  await addressPicker.getByRole('button', { name: 'Закрыть' }).click()
  await expect(addressPicker).toBeHidden()
  await expect(page.getByRole('button', { name: 'Оформить заказ' })).toBeDisabled()
  await page.getByRole('button', { name: `Убрать «${comboName}» из корзины` }).click()
  await expect(warning).toBeHidden()
  expect(removed).toBe(true)
})
