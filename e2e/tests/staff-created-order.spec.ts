import { expect, test } from '../support/test'
import { branchPage } from '../support/staff'

test('on mobile a new order scrolls inside the catalog and the checkout form', async ({ staff }) => {
  const operator = await staff('e2e_operator')
  await operator.setViewportSize({ width: 390, height: 480 })
  await branchPage(operator, 'orders/new')

  const workspace = operator.locator('#order-workspace')
  const catalog = workspace.locator('#catalog-products')
  const search = workspace.locator('#catalog-search')
  const [checkoutTab, checkoutButton] = await workspace.locator('button[phx-value-tab="details"]').all()
  const initialSearchTop = (await search.boundingBox())!.y
  const catalogBox = (await catalog.boundingBox())!
  await operator.mouse.move(catalogBox.x + catalogBox.width / 2, catalogBox.y + catalogBox.height / 2)
  await operator.mouse.wheel(0, 600)
  await expect.poll(() => catalog.evaluate(list => list.scrollTop)).toBeGreaterThan(0)
  expect((await search.boundingBox())!.y).toBe(initialSearchTop)
  expect(await operator.evaluate(() => window.scrollY)).toBe(0)

  await workspace.locator('[phx-click="toggle_mobile_cart"]').click()
  await expect(checkoutButton).toBeInViewport({ ratio: 1 })
  await checkoutTab.click()
  const form = workspace.locator('#order-checkout-scroll')
  const formBox = (await form.boundingBox())!
  await operator.mouse.move(formBox.x + formBox.width / 2, formBox.y + formBox.height / 2)
  await operator.mouse.wheel(0, 600)
  await expect.poll(() => form.evaluate(panel => panel.scrollTop)).toBeGreaterThan(0)
  expect(await operator.evaluate(() => window.scrollY)).toBe(0)
  await expect(workspace.locator('button[type="submit"][form="order-details-form"]')).toBeInViewport()
})

test('an order created by an operator reaches the kitchen without manual confirmation', async ({ staff }) => {
  const operator = await staff('e2e_operator')
  await operator.setViewportSize({ width: 1440, height: 1000 })
  await branchPage(operator, 'orders/new')
  await operator.locator('[id^="catalog-product-"]', { hasText: 'Маргарита' }).click()
  const marker = `Автопринятие ${Date.now()}`
  await operator.locator('#order_comment').fill(marker)
  await operator.locator('button[type="submit"][form="order-details-form"]').click()
  await expect(operator).toHaveURL(/\/orders$/)

  const card = operator.locator('article').filter({ hasText: marker })
  await expect(card.locator('[id^="order-next-"]')).not.toContainText('Подтвердить')
  const orderId = (await card.locator('[id^="order-status-"]').getAttribute('id'))!.replace('order-status-', '')

  const kitchen = await staff('e2e_kitchen')
  await branchPage(kitchen, 'kitchen')
  await expect(kitchen.locator(`#ticket-${orderId}`)).toBeVisible()
  await expect(kitchen.locator('#sidebar-group-orders')).toHaveAttribute('open', '')
  await expect(kitchen.locator('#sidebar-section-nav-kitchen')).toHaveAttribute('aria-current', 'page')

  for (const width of [1440, 390]) {
    await kitchen.setViewportSize({ width, height: 1000 })
    const padding = await kitchen.locator('main').evaluate((main) => {
      const style = getComputedStyle(main)
      return [style.paddingTop, style.paddingRight, style.paddingLeft].map(parseFloat)
    })
    for (const value of padding) expect(value).toBeGreaterThanOrEqual(8)
    await expect(kitchen.locator('#staff-page-header')).toBeVisible()
    if (width === 390) {
      await expect(kitchen.locator('#staff-context-navigation #section-nav-kitchen')).toBeVisible()
    }
    await kitchen.screenshot({ path: test.info().outputPath(`kitchen-${width}.png`), animations: 'disabled' })
  }

  await kitchen.setViewportSize({ width: 1440, height: 1000 })
  await kitchen.locator('#kitchen-start').click()
  await expect(kitchen.locator('#kitchen-fullscreen-toolbar')).toBeVisible()
  await expect(kitchen.locator('#kitchen-screen')).toHaveJSProperty('clientWidth', 1440)
  await kitchen.screenshot({ path: test.info().outputPath('kitchen-fullscreen.png'), animations: 'disabled' })
  await kitchen.locator('#kitchen-stop').click()
  await expect(kitchen.locator('#kitchen-fullscreen-toolbar')).toBeHidden()
})
