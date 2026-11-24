import type { Locator, Page } from '@playwright/test'
import { adminUrl } from '../support/env'
import { branchPage } from '../support/staff'
import { expect, test } from '../support/test'

type HeatmapCell = { day: number; hour: number; value: number; total: number; dates: number }
type HeatmapData = { kind: string; cells: HeatmapCell[] }
type RankingRow = { name: string; value: number | null; days: number; completed: number }
type RankingData = { kind: string; metric: string; rows: RankingRow[] }

test('delivery quality draws daily rates and opens the selected day', async ({ staff }) => {
  const page = await staff('e2e_admin')
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await branchPage(page, 'statistics?tab=overview&period=month')
  const chart = page.locator('#statistics-delivery-quality-chart')
  await expectDrawn(chart)
  const data = await chartData<{ kind: string; days: { date: string; total: number; measured: number; on_time: number; late: number; coverage: number | null; on_time_rate: number | null }[] }>(chart)
  expect(data.kind).toBe('delivery')
  expect(data.days.length).toBeGreaterThan(0)
  for (const day of data.days) {
    expect(day.late).toBe(day.measured - day.on_time)
    if (day.measured) expect(day.on_time_rate).toBeCloseTo(100 * day.on_time / day.measured)
    else expect(day.on_time_rate).toBeNull()
    if (day.total) expect(day.coverage).toBeCloseTo(100 * day.measured / day.total)
  }
  await chart.locator('summary').click()
  await page.locator('#statistics-delivery-quality-data tbody tr').first().getByRole('button').click()
  await expect(page.locator('#statistics-delivery-quality-detail')).toContainText(data.days[0].date)
  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoPageOverflow(page)
  expect(errors).toEqual([])
})

test('storefront funnel renders ordered stage conversions', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await branchPage(page, 'analytics/funnel?period=today')
  const chart = page.locator('#statistics-funnel-chart')
  await expectDrawn(chart)
  const data = await chartData<{ kind: string; stages: { sessions: number; previous: number | null; start: number | null; lost: number | null }[] }>(chart)
  expect(data.kind).toBe('funnel')
  expect(data.stages).toHaveLength(5)
  for (let index = 1; index < data.stages.length; index++) {
    const current = data.stages[index]
    const previous = data.stages[index - 1]
    expect(current.sessions).toBeLessThanOrEqual(previous.sessions)
    expect(previous.lost).toBe(previous.sessions - current.sessions)
    if (previous.sessions) expect(current.previous).toBeCloseTo(100 * current.sessions / previous.sessions)
    else expect(current.previous).toBeNull()
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await expectNoPageOverflow(page)
})

async function chartData<T>(chart: Locator): Promise<T> {
  return JSON.parse((await chart.getAttribute('data-chart'))!) as T
}

async function expectDrawn(chart: Locator) {
  const canvas = chart.locator('canvas').first()
  await expect(canvas).toBeVisible()
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => {
    if (!element.width || !element.height) return 0
    const { data } = element.getContext('2d')!.getImageData(
      0, 0, element.width, element.height,
    )
    let colored = 0
    for (let offset = 3; offset < data.length; offset += 4) {
      if (data[offset] > 0) colored += 1
    }
    return colored
  })).toBeGreaterThan(500)
}

async function expectNoPageOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(1)
}

async function theme(page: Page, value: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: value })
  await expect(page.locator('html')).toHaveAttribute('data-theme', value)
}

// Heatmap grid coordinates are CSS pixels within the ECharts plot, not device pixels.
async function cellPosition(chart: Locator, cell: HeatmapCell) {
  const plot = chart.locator('[role="img"]')
  const box = (await plot.boundingBox())!
  return {
    x: 72 + (cell.hour + 0.5) * (box.width - 72 - 18) / 24,
    y: 48 + (cell.day + 0.5) * (box.height - 48 - 70) / 7,
  }
}

test('overview heatmap draws, filters fulfillment and opens four dated cell details', async ({
  staff,
}) => {
  const admin = await staff('e2e_admin')
  const errors: string[] = []
  admin.on('pageerror', error => errors.push(error.message))
  await branchPage(admin, 'statistics?tab=overview')
  const chart = admin.locator('#statistics-heatmap-chart')
  await expect(chart).toHaveAttribute('data-chart', /"kind":"heatmap"/)
  await expectDrawn(chart)
  const all = await chartData<HeatmapData>(chart)
  expect(all.cells).toHaveLength(168)
  const fulfillment = admin.locator('#statistics-heatmap-filter select[name="fulfillment"]')
  const from = admin.locator('#statistics-heatmap-filter input[name="heatmap_from"]')
  const to = admin.locator('#statistics-heatmap-filter input[name="heatmap_to"]')
  expect((Date.parse(await to.inputValue()) - Date.parse(await from.inputValue())) / 86_400_000)
    .toBe(27)
  await fulfillment.selectOption('pickup')
  await expect(admin).toHaveURL(/fulfillment=pickup/)
  await expect(fulfillment).toHaveValue('pickup')
  const filtered = await chartData<HeatmapData>(chart)
  expect(filtered.cells).toHaveLength(168)
  expect(filtered.cells.every(cell => cell.dates === 4)).toBe(true)
  expect(filtered.cells.reduce((total, cell) => total + cell.total, 0))
    .toBeLessThanOrEqual(all.cells.reduce((total, cell) => total + cell.total, 0))
  await fulfillment.selectOption('delivery')
  await expect(admin).toHaveURL(/fulfillment=delivery/)
  await expect(fulfillment).toHaveValue('delivery')
  const delivery = await chartData<HeatmapData>(chart)
  expect(
    JSON.stringify(filtered.cells) !== JSON.stringify(all.cells) ||
    JSON.stringify(delivery.cells) !== JSON.stringify(all.cells),
    'at least one fulfillment must change the heatmap payload',
  ).toBe(true)
  await fulfillment.selectOption('all')
  await expect(fulfillment).toHaveValue('all')
  await expect.poll(async () => JSON.stringify((await chartData<HeatmapData>(chart)).cells))
    .toBe(JSON.stringify(all.cells))
  await expectDrawn(chart)
  await expect(admin.locator('#statistics-heatmap-detail')).toHaveCount(0)
  // The default period ends on the preceding Sunday. Today's browser-created
  // orders cannot seed it; this assertion must not pass on an all-zero fixture.
  const cell = all.cells.find(point => point.total > 0)
  const zeroCell = all.cells.find(point => point.total === 0)
  expect(cell, 'fixture needs at least one historical order').toBeDefined()
  expect(zeroCell, 'fixture needs an empty hour to verify four zero dates').toBeDefined()
  await chart.locator('[role="img"]').click({ position: await cellPosition(chart, cell!) })
  const details = admin.locator('#statistics-heatmap-detail')
  await expect(details.locator('tbody tr')).toHaveCount(4)
  const values = await details.locator('tbody tr td:last-child').allInnerTexts()
  expect(values.map(Number).reduce((sum, count) => sum + count, 0)).toBe(cell!.total)
  await expect(details.locator('tbody tr td:first-child').first()).toContainText(/\d{4}-\d{2}-\d{2}/)

  const touchContext = await admin.context().browser()!.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
    storageState: await admin.context().storageState(),
  })
  const mobile = await touchContext.newPage()
  await branchPage(mobile, 'statistics?tab=overview')
  const mobileChart = mobile.locator('#statistics-heatmap-chart')
  await expectNoPageOverflow(mobile)
  await expect.poll(async () => (await mobileChart.locator('canvas').first().boundingBox())?.width ?? Infinity)
    .toBeLessThanOrEqual(390)
  for (const selected of [cell!, zeroCell!]) {
    const plot = mobileChart.locator('[role="img"]')
    await plot.scrollIntoViewIfNeeded()
    const box = (await plot.boundingBox())!
    const offset = await cellPosition(mobileChart, selected)
    await mobile.touchscreen.tap(box.x + offset.x, box.y + offset.y)
    const rows = mobile.locator('#statistics-heatmap-detail tbody tr')
    await expect(rows).toHaveCount(4)
    const totals = (await rows.locator('td:last-child').allInnerTexts()).map(Number)
    expect(totals.reduce((sum, count) => sum + count, 0)).toBe(selected.total)
    if (selected.total === 0) expect(totals).toEqual([0, 0, 0, 0])
  }
  await admin.setViewportSize({ width: 390, height: 844 })
  for (const mode of ['light', 'dark'] as const) {
    await theme(admin, mode)
    await expectDrawn(chart)
    await admin.mouse.move(0, 0)
    await chart.locator('[role="img"]').hover({ position: await cellPosition(chart, cell!) })
    const tooltip = chart.locator('.echarts-tooltip')
    // ECharts tooltip is an HTML overlay inside the chart, clamped to its viewport.
    await expect(tooltip).toBeVisible()
    const bounds = (await tooltip.boundingBox())!
    expect(bounds.x).toBeGreaterThanOrEqual(-1)
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(391)
    await expectNoPageOverflow(admin)
  }

  // The ECharts saveAsImage toolbox button is painted on the same canvas.
  const surface = chart.locator('[role="img"]')
  const plot = (await surface.boundingBox())!
  const download = admin.waitForEvent('download', { timeout: 8_000 })
  await surface.click({ position: { x: plot.width - 17, y: 13 } })
  const png = await download
  expect(png.suggestedFilename()).toMatch(/orders-heatmap.*\.png$/)
  await touchContext.close()
  expect(errors).toEqual([])
})

test('monthly network comparison ranks the exact branch table while preserving channel', async ({
  staff,
}) => {
  const admin = await staff('e2e_admin')
  const errors: string[] = []
  admin.on('pageerror', error => errors.push(error.message))
  await admin.goto(`${adminUrl}/staff/analytics/comparison?period=month&channel=app`)
  await admin.locator('[data-phx-main].phx-connected').waitFor()
  const chart = admin.locator('#statistics-ranking-chart')
  const table = admin.locator('tbody#statistics-branch-comparison')
  const metric = admin.locator('#statistics-ranking-metric select[name="metric"]')
  const channel = admin.locator('#statistics-filter select[name="channel"]')
  await expect(chart).toHaveAttribute('data-chart', /"kind":"ranking"/)
  await expect(channel).toHaveValue('app')
  await expect(table.locator('tr').first()).toBeVisible()
  for (const selected of ['revenue', 'orders_per_day', 'avg_check']) {
    await metric.selectOption(selected)
    await expect(metric).toHaveValue(selected)
    await expect(admin).toHaveURL(/period=month/)
    await expect(admin).toHaveURL(/channel=app/)
    await expect(channel).toHaveValue('app')
    await expect.poll(async () => (await chartData<RankingData>(chart)).metric).toBe(selected)
    const data = await chartData<RankingData>(chart)
    expect(data.rows.length).toBeGreaterThan(0)
    await expectDrawn(chart)
    await expect(table.locator('tr')).toHaveCount(data.rows.length)
    const names = await table.locator('tr td[data-column="branch"]').allInnerTexts()
    expect(names.map(name => name.trim())).toEqual(data.rows.map(row => row.name))
    for (let index = 0; index < data.rows.length; index += 1) {
      const current = data.rows[index]
      const cells = table.locator('tr').nth(index)
      expect(Number(await cells.locator('td[data-column="completed"]').textContent()))
        .toBe(current.completed)
      const monetary = (await cells.locator(
        `td[data-column="${selected === 'avg_check' ? 'average' : 'revenue'}"]`,
      ).textContent() ?? '')
        .replace(/[^\d,.-]/g, '').replace(',', '.')
      if (selected !== 'orders_per_day' && current.value !== null) {
        expect(Number(monetary)).toBeCloseTo(current.value / 100, 2)
      }
      if (selected === 'orders_per_day') {
        expect(Number((await cells.locator('td[data-column="per_day"]').textContent() ?? '').replace(',', '.')))
          .toBeCloseTo(current.completed / current.days, 2)
      }
      if (index > 0) {
        const previous = data.rows[index - 1]
        expect(previous.value ?? -Infinity).toBeGreaterThanOrEqual(current.value ?? -Infinity)
      }
    }
  }
  expect(errors).toEqual([])
})
