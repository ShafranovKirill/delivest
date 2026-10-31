import { expect, test } from '../support/test'
import { placeOrder } from '../support/customer'
import { adminUrl } from '../support/env'
import { advance, branchPage, expectStatus, orderCard, tagged } from '../support/staff'

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
  const onBoard = (column: string) => board.locator(column).getByText(number, { exact: true })
  await expect(onBoard('#board-preparing')).toBeVisible()

  const kitchen = await staff('e2e_kitchen')
  await branchPage(kitchen, 'kitchen')
  await kitchen.locator('[id^="ticket-"]', { hasText: tagged(number) }).locator('[id^="ready-"]').click()
  // The kitchen allows 10 seconds to undo, then Oban processes the scheduled job.
  await expectStatus(card, 'Готов', 30_000)
  await expect(onBoard('#board-ready')).toBeVisible()
  await expect(onBoard('#board-preparing')).toBeHidden()

  await advance(card, 'Выдан')
  await expectStatus(card, 'Выполнен')
  await expect(onBoard('#board-ready')).toBeHidden()
})
