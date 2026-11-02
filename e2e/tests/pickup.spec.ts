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

test('the pickup board pages long lists without an indicator', async ({ page }) => {
  const board = await page.context().newPage()
  await board.setViewportSize({ width: 1280, height: 720 })
  await board.goto(`${adminUrl}/board/e2e-board-many`)

  const items = (column: string) => board.locator(`#board-${column} [data-board-order]`)
  const visible = (column: string) => board.locator(`#board-${column} [data-board-order]:visible`)
  const grid = (column: string) => board.locator(`#board-${column} [data-board-grid]`)

  await expect(items('preparing')).toHaveCount(20)
  await expect(items('ready')).toHaveCount(20)
  await expect.poll(() => visible('preparing').count(), { timeout: 10_000 }).toBeLessThan(20)
  await expect.poll(() => visible('ready').count(), { timeout: 10_000 }).toBeLessThan(20)

  const first = await visible('preparing').allTextContents()
  const firstReady = await visible('ready').allTextContents()
  expect(first.length).toBeGreaterThan(0)
  expect(first.length).toBeLessThan(20)
  expect(firstReady.length).toBeGreaterThan(0)
  expect(firstReady.length).toBeLessThan(20)

  await expect
    .poll(() => visible('preparing').allTextContents().then((numbers) => numbers.join('|')), {
      timeout: 12_000,
    })
    .not.toBe(first.join('|'))

  expect(await visible('ready').allTextContents()).not.toEqual(firstReady)

  const seen = new Set(first.map((number) => number.trim()))
  const collect = async () => {
    for (const number of await visible('preparing').allTextContents()) seen.add(number.trim())
  }

  await collect()

  for (let attempt = 0; attempt < 4 && seen.size < 20; attempt++) {
    await board.waitForTimeout(8_500)
    await collect()
  }

  expect(seen.size).toBe(20)
  await expect(board.getByText(/\d+\s*\/\s*\d+/)).toHaveCount(0)

  for (const column of ['preparing', 'ready']) {
    expect(await grid(column).evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(
      1,
    )
  }

  await board.setViewportSize({ width: 1920, height: 1080 })
  await expect.poll(() => visible('preparing').count(), { timeout: 10_000 }).toBe(20)
  await expect.poll(() => visible('ready').count(), { timeout: 10_000 }).toBe(20)

  for (const column of ['preparing', 'ready']) {
    expect(await grid(column).evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(
      1,
    )
  }

  await board.close()
})
