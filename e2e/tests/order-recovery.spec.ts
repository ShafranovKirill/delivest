import type { Page, WebSocketRoute } from '@playwright/test'
import { placeOrder } from '../support/customer'
import { advance, branchPage, expectStatus, orderCard } from '../support/staff'
import { expect, test } from '../support/test'

async function controlLiveConnection(page: Page) {
  let socket: WebSocketRoute | undefined
  let blocked = false

  await page.routeWebSocket('**/live/websocket**', (ws) => {
    if (blocked) return ws.close()
    socket = ws
    ws.connectToServer()
  })

  return {
    disconnect: () => {
      blocked = true
      if (!socket) throw new Error('LiveView websocket did not connect')
      return socket.close()
    },
    reconnect: () => {
      blocked = false
    },
  }
}

test('checkout retry and staff reconnect recover the same order', async ({ page, staff }) => {
  const operator = await staff('e2e_operator')
  const confirmer = await staff('e2e_operator')
  const kitchen = await staff('e2e_kitchen')
  const operatorConnection = await controlLiveConnection(operator)
  const kitchenConnection = await controlLiveConnection(kitchen)
  await branchPage(operator, 'orders')
  await branchPage(confirmer, 'orders')
  await branchPage(kitchen, 'kitchen')

  const operatorView = operator.locator('[data-phx-main]')
  const kitchenView = kitchen.locator('[data-phx-main]')
  await operatorConnection.disconnect()
  await kitchenConnection.disconnect()
  await expect(operatorView).not.toHaveClass(/phx-connected/)
  await expect(kitchenView).not.toHaveClass(/phx-connected/)

  let responseDropped!: () => void
  const dropped = new Promise<void>((resolve) => {
    responseDropped = resolve
  })
  const attempts: { id: string; key: string }[] = []

  await page.route('**/client/orders', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()

    const response = await route.fetch()
    expect(response.ok()).toBeTruthy()
    const { data } = await response.json()
    attempts.push({ id: data.id, key: route.request().headers()['idempotency-key'] })

    if (attempts.length === 1) {
      await route.abort('timedout')
      responseDropped()
    } else {
      await route.fulfill({ response })
    }
  })

  const checkout = placeOrder(page, 'pickup')
  await Promise.race([
    dropped,
    checkout.then(() => {
      throw new Error('Checkout finished before the response was dropped')
    }),
  ])
  await page.getByRole('button', { name: 'Оформить заказ' }).click()
  const number = await checkout

  expect(attempts).toHaveLength(2)
  expect(attempts[0].key).toBeTruthy()
  expect(attempts[1]).toEqual(attempts[0])
  await expect(orderCard(confirmer, number)).toHaveCount(1)
  await advance(orderCard(confirmer, number), 'Подтвердить')
  await expectStatus(orderCard(confirmer, number), 'Готовится')

  operatorConnection.reconnect()
  kitchenConnection.reconnect()
  await expect(operatorView).toHaveClass(/phx-connected/, { timeout: 35_000 })
  await expect(kitchenView).toHaveClass(/phx-connected/, { timeout: 35_000 })
  await expect(orderCard(operator, number)).toHaveCount(1)
  await expectStatus(orderCard(operator, number), 'Готовится')
  await expect(kitchen.locator(`#ticket-${attempts[0].id}`)).toBeVisible()
})
