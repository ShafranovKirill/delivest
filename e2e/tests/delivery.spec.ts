import { expect, test } from '../support/test'
import { placeOrder } from '../support/customer'
import { advance, branchPage, expectStatus, orderCard, tagged } from '../support/staff'

test('a delivery order goes from the customer through the kitchen to the courier', async ({
  page,
  staff,
}) => {
  const number = await placeOrder(page, 'delivery')

  const operator = await staff('e2e_operator')
  await branchPage(operator, 'orders')
  const card = orderCard(operator, number)
  await expectStatus(card, 'Новый')
  await advance(card, 'Подтвердить')
  await expectStatus(card, 'Готовится')

  const kitchen = await staff('e2e_kitchen')
  await branchPage(kitchen, 'kitchen')
  const ticket = kitchen.locator('[id^="ticket-"]', { hasText: tagged(number) })
  await ticket.locator('[id^="ready-"]').click()
  await expectStatus(card, 'Готов')

  const courier = await staff('e2e_courier')
  courier.on('dialog', (dialog) => dialog.accept())
  await branchPage(courier, 'deliveries')
  const delivery = courier.locator('[id^="delivery-"]', { hasText: tagged(number) }).first()
  await delivery.locator('[id^="take-"]').click()
  await delivery.locator('[id^="pick-up-"]').click()
  await expectStatus(card, 'Доставляется')
  await delivery.locator('[id^="hand-over-"]').click()
  await expectStatus(card, 'Выполнен')
  await expect(courier.locator('#courier-mine', { hasText: tagged(number) })).toBeHidden()
})
