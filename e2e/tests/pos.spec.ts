import { expect, test } from '../support/test'
import { adminUrl } from '../support/env'
import { branchPage, expectStatus, orderCard, tagged } from '../support/staff'

test('the cashier sells for cash, the kitchen cooks and the cashier hands the order out', async ({
  page,
  staff,
}) => {
  const cashier = await staff('e2e_cashier')
  await branchPage(cashier, 'pos')

  await cashier.locator('[id^="pos-product-"]', { hasText: 'Маргарита' }).click()
  await cashier.locator('#pos-type-pickup').click()
  await expect(cashier.locator('#pos-check-total')).toContainText('590')

  await cashier.locator('#pos-pay').click()
  await cashier.locator('#pos-cash input').fill('1000')
  await expect(cashier.locator('#pos-change')).toContainText('410')
  await cashier.locator('#pos-confirm').click()

  const done = cashier.locator('#pos-done')
  await expect(done).toContainText('410')
  const number = (await done.locator('.font-mono.text-6xl').innerText()).trim()

  const board = await page.context().newPage()
  await board.goto(`${adminUrl}/board/e2e-board`)
  await expect(board.locator('#board-preparing').getByText(number, { exact: true })).toBeVisible()

  const kitchen = await staff('e2e_kitchen')
  await branchPage(kitchen, 'kitchen')
  await kitchen.locator('[id^="ticket-"]', { hasText: tagged(number) }).locator('[id^="ready-"]').click()
  await expect(board.locator('#board-ready').getByText(number, { exact: true })).toBeVisible()

  await cashier.locator('#pos-tab-handout').click()
  await cashier.locator('[id^="pos-ready-"]', { hasText: number }).click()
  await expect(cashier.locator('[id^="pos-ready-"]', { hasText: number })).toBeHidden()

  const operator = await staff('e2e_operator')
  await branchPage(operator, 'orders?status=completed')
  await expectStatus(orderCard(operator, number), 'Выполнен')
})
