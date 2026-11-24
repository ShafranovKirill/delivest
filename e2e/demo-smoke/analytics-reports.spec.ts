import { expect, test } from '@playwright/test'

test('existing demo renders the four analytics reports without resetting data', async ({ page }) => {
  const base = new URL(test.info().project.use.baseURL!)
  await page.goto('/staff/auth/login')
  await page.locator('[data-phx-main].phx-connected').waitFor()
  await page.locator('#user_login').fill('demo_admin')
  await page.locator('#user_password').fill(process.env.DEMO_STAFF_PASSWORD ?? 'DemoPassword123!')
  await page.locator('#user_password').press('Enter')
  await page.waitForURL(url => !url.pathname.startsWith('/staff/auth'))

  for (const path of ['/staff/dashboard', '/staff/b/demo-center/dashboard']) {
    await page.goto(path)
    await expect(page.locator('#dashboard-orders-by-hour-plot canvas').first()).toBeVisible()
    await expect(page.locator('#statistics-heatmap-chart')).toHaveCount(0)
  }

  await page.goto('/staff/statistics')
  await page.locator('[data-phx-main].phx-connected').waitFor()
  await page.locator('#statistics-heatmap-link').click()
  await expect(page).toHaveURL(/tab=overview.*#statistics-heatmap$/)
  const heatmap = page.locator('#statistics-heatmap-chart')
  await expect(heatmap.locator('canvas').first()).toBeVisible()
  const data = JSON.parse((await heatmap.getAttribute('data-chart'))!) as {
    kind: string; cells: { day: number; hour: number; total: number; dates: number }[]
  }
  expect(data.kind).toBe('heatmap')
  expect(data.cells).toHaveLength(168)
  const positive = data.cells.find(cell => cell.total > 0)
  expect(positive, 'demo needs historical orders; an empty heatmap is not proof').toBeDefined()
  await heatmap.locator('[role="img"]').click({
    position: await heatmap.locator('[role="img"]').evaluate((plot, cell) => {
      const width = plot.getBoundingClientRect().width
      const height = plot.getBoundingClientRect().height
      return {
        x: 72 + (cell.hour + 0.5) * (width - 90) / 24,
        y: 48 + (cell.day + 0.5) * (height - 118) / 7,
      }
    }, positive!),
  })
  const detail = page.locator('#statistics-heatmap-detail tbody tr')
  await expect(detail).toHaveCount(4)
  const totals = (await detail.locator('td:last-child').allInnerTexts()).map(Number)
  expect(totals.reduce((sum, count) => sum + count, 0)).toBe(positive!.total)

  await page.goto(new URL('/staff/analytics/comparison?period=month&channel=app', base).toString())
  await page.locator('[data-phx-main].phx-connected').waitFor()
  const ranking = page.locator('#statistics-ranking-chart')
  await expect(ranking.locator('canvas').first()).toBeVisible()
  const rows = JSON.parse((await ranking.getAttribute('data-chart'))!) as {
    kind: string; rows: { name: string }[]
  }
  expect(rows.kind).toBe('ranking')
  expect(rows.rows.length, 'demo needs collected branch data').toBeGreaterThan(0)
  const names = await page.locator(
    'tbody#statistics-branch-comparison tr td[data-column="branch"]',
  ).allInnerTexts()
  expect(names.map(name => name.trim())).toEqual(rows.rows.map(row => row.name))
  await expect(page.locator('#statistics-filter select[name="channel"]')).toHaveValue('app')

  await page.goto('/staff/b/demo-center/analytics/funnel?period=custom&from=2026-11-04&to=2026-11-17')
  const funnel = page.locator('#statistics-funnel-chart')
  await expect(funnel.locator('canvas').first()).toBeVisible()
  await expect.poll(async () => {
    const series = JSON.parse((await funnel.getAttribute('data-chart'))!) as {
      stages: { sessions: number }[]
    }
    return series.stages[0].sessions
  }).toBeGreaterThan(0)

  await page.goto('/staff/b/demo-center/statistics?tab=overview&period=custom&from=2026-11-04&to=2026-11-17')
  const quality = page.locator('#statistics-delivery-quality-chart')
  await expect(quality.locator('canvas').first()).toBeVisible()
  const qualityData = JSON.parse((await quality.getAttribute('data-chart'))!) as {
    days: { total: number }[]
  }
  expect(qualityData.days.some(day => day.total > 0)).toBe(true)
})
