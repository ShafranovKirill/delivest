import { test } from '../support/test'
import { placeOrder } from '../support/customer'
import { advance, branchPage, expectStatus, orderCard } from '../support/staff'

test('a pickup order is cooked and handed over at the counter', async ({ page, staff }) => {
  const number = await placeOrder(page, 'pickup')

  const operator = await staff('e2e_operator')
  await branchPage(operator, 'orders')
  const card = orderCard(operator, number)
  await advance(card, 'Подтвердить')
  await expectStatus(card, 'Готовится')

  const kitchen = await staff('e2e_kitchen')
  await branchPage(kitchen, 'kitchen')
  await kitchen.locator('[id^="ticket-"]', { hasText: number }).locator('[id^="ready-"]').click()
  await expectStatus(card, 'Готов')

  await advance(card, 'Выдан')
  await expectStatus(card, 'Выполнен')
})
