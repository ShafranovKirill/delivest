import { expect, test, type Page } from '@playwright/test'

async function fillCartAndOpenCheckout(page: Page, waitForForm = true) {
  await page.goto('/')
  await page.getByRole('button', { name: '590 ₽' }).click()
  await page.getByText('Заберу самостоятельно').click()
  await page.getByRole('button', { name: 'Заказать сюда' }).click()

  const cartButton = page.viewportSize()!.width < 768 ? page : page.locator('header')
  await cartButton.getByRole('button', { name: '590 ₽' }).click()
  await page.getByRole('button', { name: 'К оформлению заказа' }).click()
  await expect(page).toHaveURL(/\/e2e\/checkout$/)
  if (waitForForm) {
    await expect(page.getByRole('button', { name: 'Оформить заказ' })).toBeVisible()
  }
}

async function expectCartOnMenu(page: Page, mobile: boolean) {
  await expect(page).toHaveURL(/\/e2e\/?$/)
  const checkoutButton = page.getByRole('button', { name: 'К оформлению заказа' })
  await expect(checkoutButton).toBeVisible()
  const cart = checkoutButton.locator('..').locator('..')
  await expect(cart.getByRole('heading', { name: 'Маргарита' })).toBeVisible()
  await expect(cart.getByText('590 ₽', { exact: true }).last()).toBeVisible()

  if (mobile) {
    await page.getByRole('button', { name: 'Закрыть' }).click()
  } else {
    await page.locator('.p-drawer-close-button').click()
  }
  await expect(checkoutButton).toBeHidden()
  await expect(page.locator('[id^="category-"]').first()).toBeVisible()
}

test('desktop back to cart navigates to branch menu before opening the preserved cart', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await fillCartAndOpenCheckout(page)
  await page.getByRole('button', { name: 'Назад в корзину' }).click()
  await expectCartOnMenu(page, false)
})

test('mobile header back opens the preserved cart after direct checkout reload', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await fillCartAndOpenCheckout(page)

  const direct = await page.context().newPage()
  await direct.setViewportSize({ width: 390, height: 844 })
  await direct.goto('/e2e/checkout')
  await direct.reload()
  await expect(direct.getByRole('button', { name: 'Оформить заказ' })).toBeVisible()
  await direct.locator('header').getByRole('button', { name: 'Назад' }).click()
  await expectCartOnMenu(direct, true)
  await direct.close()
})

test('immediate mobile return keeps the reopened cart after the old close timer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await fillCartAndOpenCheckout(page, false)
  await page.locator('header').getByRole('button', { name: 'Назад' }).click()

  await expect(page).toHaveURL(/\/e2e\/?$/)
  const cartItem = page.getByRole('dialog').getByRole('heading', { name: 'Маргарита' })
  await expect(cartItem).toBeVisible()
  // The previous cart close schedules cleanup at 300 ms; it must not clear the reopened cart.
  await page.waitForTimeout(450)
  await expect(cartItem).toBeVisible()
  await expect(page.getByRole('button', { name: 'К оформлению заказа' })).toBeVisible()
})
