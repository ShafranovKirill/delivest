import { expect, type Page } from '@playwright/test'

type Fulfillment = 'delivery' | 'pickup'

const chooseFulfillment = async (page: Page, fulfillment: Fulfillment) => {
  if (fulfillment === 'pickup') {
    await page.getByText('Заберу из пиццерии').click()
  } else {
    await page.getByText('Указать адрес доставки').click()
    await page.getByPlaceholder('Улица').fill('Тверская')
    await page.getByPlaceholder('Дом').fill('7')
  }

  await page.getByRole('button', { name: 'Заказать сюда' }).click()
}

export const placeOrder = async (page: Page, fulfillment: Fulfillment) => {
  await page.goto('/')
  await page.getByRole('button', { name: '590 ₽' }).click()
  await chooseFulfillment(page, fulfillment)

  await page.locator('header').getByRole('button', { name: '590 ₽' }).click()
  await page.getByRole('button', { name: 'К оформлению заказа' }).click()
  await page.getByRole('button', { name: 'Перейти к оформлению' }).click()

  await page.getByPlaceholder('Иван').fill('Тест')
  await page.locator('input[name=phone]').fill('+79990001122')
  await page.getByRole('button', { name: 'Оформить заказ' }).click()

  const heading = page.getByText(/^Заказ [A-Z0-9]+$/)
  await expect(heading).toBeVisible()
  return (await heading.innerText()).replace('Заказ ', '')
}
