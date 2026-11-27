import { adminUrl } from '../support/env'
import { branchPage } from '../support/staff'
import { expect, test } from '../support/test'

test('dashboard shares its saved widgets across scopes and adapts without horizontal scrolling', async ({ staff }) => {
  const page = await staff('e2e_admin')
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 1600, height: 1000 })
  await branchPage(page, 'dashboard')

  const grid = page.locator('#dashboard-grid')
  const widget = (key: string) => grid.locator(`[data-widget-id="${key}"]`)
  const reset = async () => {
    await page.locator('#dashboard-reset').click()
    await expect(page.locator('#dashboard-save')).toBeVisible()
  }
  await page.locator('#dashboard-edit').click()
  await reset()
  await page.locator('#dashboard-save').click()
  await expect(widget('hourly')).toBeVisible()
  await expect(widget('quick_actions')).toBeVisible()
  await expect(widget('hourly').locator('#dashboard-hourly-statistics')).toBeVisible()

  await page.locator('#dashboard-edit').click()
  const revenue = widget('revenue')
  await expect(page.locator('#dashboard-save')).toBeVisible()
  await expect(grid).toHaveClass(/\bgs-12\b/)
  await expect(revenue).toHaveAttribute('gs-w', '3')
  await revenue.hover()
  const handle = revenue.locator('.ui-resizable-se')
  await expect(handle).toBeVisible()
  const columnWidth = (await grid.boundingBox())!.width / 12
  const otherGeometry = async () => grid.locator('[data-widget-id]:not([data-widget-id="revenue"])').evaluateAll(items =>
    Object.fromEntries(items.map(item => [item.getAttribute('data-widget-id'),
      ['gs-x', 'gs-y', 'gs-w', 'gs-h'].map(attribute => item.getAttribute(attribute))]))
  )
  const beforeResize = await otherGeometry()
  const resizeHandle = (await handle.boundingBox())!
  const x = resizeHandle.x + resizeHandle.width / 2
  const y = resizeHandle.y + resizeHandle.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + columnWidth, y, { steps: 12 })
  await page.mouse.up()
  await expect(revenue).toHaveAttribute('gs-w', '3')
  expect(await otherGeometry()).toEqual(beforeResize)

  // Shrinking leaves every neighbouring card in place.
  const shrinkHandle = (await handle.boundingBox())!
  const shrinkX = shrinkHandle.x + shrinkHandle.width / 2
  const shrinkY = shrinkHandle.y + shrinkHandle.height / 2
  await page.mouse.move(shrinkX, shrinkY)
  await page.mouse.down()
  await page.mouse.move(shrinkX - columnWidth, shrinkY, { steps: 12 })
  await page.mouse.up()
  await expect(revenue).toHaveAttribute('gs-w', '2')
  expect(await otherGeometry()).toEqual(beforeResize)
  const moveHandle = (await revenue.locator('.dashboard-drag-handle').boundingBox())!
  const moveX = moveHandle.x + moveHandle.width / 2
  const moveY = moveHandle.y + moveHandle.height / 2
  await page.mouse.move(moveX, moveY)
  await page.mouse.down()
  await page.mouse.move(moveX + columnWidth * 2, moveY, { steps: 12 })
  await page.mouse.up()
  // The first column is free; the next column belongs to the adjacent card.
  const savedRevenuePosition = () => page.locator('#dashboard-grid-controller').evaluate(controller =>
    JSON.parse(controller.getAttribute('data-layout') ?? '[]').find((item: {id: string}) => item.id === 'revenue').x
  )
  await expect.poll(savedRevenuePosition).toBe(1)
  expect(await otherGeometry()).toEqual(beforeResize)
  await page.locator('#dashboard-remove-hourly').click()
  await expect(widget('hourly')).toHaveCount(0)
  await page.locator('#dashboard-cancel').click()
  await expect(widget('hourly')).toBeVisible()
  await page.locator('#dashboard-edit').click()
  await expect(page.locator('#dashboard-save')).toBeVisible()
  await expect(revenue).toHaveAttribute('gs-w', '3')

  const statisticsAction = page.locator('#dashboard-action-statistics')
  await expect(statisticsAction).toHaveAttribute('aria-pressed', 'true')
  await page.locator('#dashboard-add-cumulative_revenue').click()
  await expect(widget('cumulative_revenue').locator('canvas').first()).toBeVisible()
  await page.locator('#dashboard-remove-hourly').click()
  await expect(page.locator('#dashboard-header-statistics')).toBeVisible()
  await statisticsAction.click()
  await expect(statisticsAction).toHaveAttribute('aria-pressed', 'false')
  await page.locator('#dashboard-save').click()
  await expect(page.locator('#dashboard-edit')).toBeVisible()
  await expect(widget('hourly')).toHaveCount(0)

  await page.goto(`${adminUrl}/staff/dashboard`)
  await page.locator('[data-phx-main].phx-connected').waitFor()
  await expect(widget('quick_actions')).toHaveCount(0)
  await expect(widget('hourly')).toHaveCount(0)
  await expect(widget('cumulative_revenue').locator('canvas').first()).toBeVisible()
  await expect(page.locator('#dashboard-header-statistics')).toHaveCount(0)
  await page.setViewportSize({ width: 1024, height: 900 })
  await expect(grid).toHaveClass(/\bgs-6\b/)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(grid).toHaveClass(/\bgs-2\b/)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - innerWidth))
    .toBeLessThanOrEqual(1)
  const cumulative = await widget('cumulative_revenue').boundingBox()
  expect(cumulative?.width).toBeLessThanOrEqual(390)

  await page.locator('#dashboard-edit').click()
  await page.locator('#dashboard-move-up-revenue').click()
  const revenueBeforeAttention = async () => {
    const revenueCard = await widget('revenue').boundingBox()
    const attention = await widget('attention').boundingBox()
    return Boolean(revenueCard && attention && revenueCard.y < attention.y)
  }
  await expect.poll(revenueBeforeAttention).toBe(true)
  await page.locator('#dashboard-save').click()
  await expect(page.locator('#dashboard-edit')).toBeVisible()
  await page.reload()
  await expect(grid).toHaveClass(/\bgs-2\b/)
  await expect.poll(revenueBeforeAttention).toBe(true)
  await page.locator('#dashboard-edit').click()
  await reset()
  await page.locator('#dashboard-save').click()
  await expect(widget('hourly')).toBeVisible()
  await branchPage(page, 'dashboard')
  await expect(widget('hourly')).toBeVisible()
  await page.setViewportSize({ width: 800, height: 900 })
  await expect(page.locator('#main-sidebar')).toBeVisible()
  await expect(grid).toHaveClass(/\bgs-2\b/)
  await expect(grid).toHaveClass(/\bdashboard-grid-ready\b/)
  await expect.poll(() => grid.evaluate(element => {
    const cards = ['revenue', 'orders', 'avg_check', 'in_work'].map(id => {
      const widget = element.querySelector(`[data-widget-id="${id}"]`)!
      const card = widget.querySelector('.dashboard-kpi-card')!.getBoundingClientRect()
      const value = widget.querySelector('.dashboard-kpi-value')!.getBoundingClientRect()
      const context = widget.querySelector('.dashboard-kpi-context')!.getBoundingClientRect()
      return { card, value, context }
    })
    const [revenue, orders, average, inWork] = cards
    return {
      paired: Math.abs(revenue.card.y - orders.card.y) <= 1 &&
        Math.abs(average.card.y - inWork.card.y) <= 1 &&
        average.card.y > revenue.card.y + revenue.card.height - 1,
      compact: cards.every(({ card }) => card.height <= 150),
      contentFits: cards.every(({ card, value, context }) =>
        value.y > card.y + 25 && context.y > card.y + card.height / 2 &&
        context.bottom <= card.bottom - 8),
    }
  })).toEqual({ paired: true, compact: true, contentFits: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${adminUrl}/staff/b/e2e-board/dashboard`)
  await expect(page.locator('#dashboard-alert-ready')).toBeVisible()
  await expect(widget('hourly').locator('canvas').first()).toBeVisible()
  await expect(widget('latest_orders').locator('[id^="dashboard-order-"]').first()).toBeVisible()
  // Expanding the accessible data must grow the chart card at either width.
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    const details = widget('hourly').locator('details')
    if (width === 390) {
      await expect.poll(async () => {
        const [revenue, orders] = await Promise.all([widget('revenue').boundingBox(), widget('orders').boundingBox()])
        return !!revenue && !!orders && Math.abs(revenue.y - orders.y) < 1
      }).toBe(true)
    }
    await details.locator('summary').click()
    await expect.poll(async () => {
      const lastRow = await details.locator('tr').last().boundingBox()
      const card = await widget('hourly').boundingBox()
      return !!lastRow && !!card && lastRow.y + lastRow.height <= card.y + card.height + 1
    }).toBe(true)
    await details.locator('summary').click()
    const scrollableCards = await grid.locator('.dashboard-widget-card').evaluateAll(cards =>
      cards.filter(card =>
        /auto|scroll/.test(getComputedStyle(card).overflowY) && card.scrollHeight > card.clientHeight + 1
      ).length
    )
    expect(scrollableCards).toBe(0)
  }
  expect(errors).toEqual([])
})
