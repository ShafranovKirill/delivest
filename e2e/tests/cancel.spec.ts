import { test } from '../support/test'
import { placeOrder } from '../support/customer'
import { branchPage, expectStatus, orderCard } from '../support/staff'

test('the operator cancels an order and the admin reverts it with a reason', async ({
  page,
  staff,
}) => {
  const number = await placeOrder(page, 'delivery')

  const operator = await staff('e2e_operator')
  await branchPage(operator, 'orders')
  const card = orderCard(operator, number)
  await card.locator('[id^="order-cancel-"]').click()
  await operator.locator('#cancel-order-form input[type=radio]').first().check()
  await operator.locator('#cancel-order-form button[type=submit]').click()
  await expectStatus(card, 'Отменен')

  const admin = await staff('e2e_admin')
  await branchPage(admin, 'orders')
  const adminCard = orderCard(admin, number)
  await adminCard.locator('[id^="order-revert-"]').click()
  await admin
    .locator('#revert-status-form [name="revert[reason]"]')
    .fill('Клиент передумал отменять')
  await admin.locator('#revert-status-form button[type=submit]').click()
  await expectStatus(adminCard, 'Новый')
  await expectStatus(card, 'Новый')
})
