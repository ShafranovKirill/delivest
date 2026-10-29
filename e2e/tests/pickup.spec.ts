import { expect, test } from '../support/test'
import { placeOrder } from '../support/customer'
import { adminUrl } from '../support/env'
import { advance, branchPage, expectStatus, orderCard } from '../support/staff'

test('a pickup order is cooked, shown on the board and handed over at the counter', async ({
  page,
  staff,
}) => {
  const number = await placeOrder(page, 'pickup')

  const operator = await staff('e2e_operator')
  await branchPage(operator, 'orders')
  const card = orderCard(operator, number)
  await advance(card, 'Подтвердить')
  await expectStatus(card, 'Готовится')

  const board = await page.context().newPage()
  await board.goto(`${adminUrl}/board/e2e-board`)
  await expect(board.locator('#board-preparing')).toContainText(number)

  const kitchen = await staff('e2e_kitchen')
  await branchPage(kitchen, 'kitchen')
  await kitchen.locator('[id^="ticket-"]', { hasText: number }).locator('[id^="ready-"]').click()
  await expectStatus(card, 'Готов')
  await expect(board.locator('#board-ready')).toContainText(number)
  await expect(board.locator('#board-preparing')).not.toContainText(number)

  await advance(card, 'Выдан')
  await expectStatus(card, 'Выполнен')
  await expect(board.locator('#board-ready')).not.toContainText(number)
})
