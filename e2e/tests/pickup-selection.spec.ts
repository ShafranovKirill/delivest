import { expect, test } from '../support/test'
import { openPickupPreview, selectPickupLocation } from '../support/pickup'

const screenshots = process.env.ORDER_SUCCESS_SCREENSHOTS

for (const [name, width] of [['mobile', 390], ['desktop', 1280]] as const) {
  test(`${name} pickup previews another branch without selecting it`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.route('**/client/franchise', async (route) => {
      const response = await route.fetch()
      const body = await response.json()
      body.data.address_map = true
      await route.fulfill({ response, json: body })
    })
    await page.route('**/client/branches', async (route) => {
      const response = await route.fetch()
      const body = await response.json()
      body.data = body.data.filter((item: { name: string }) => item.name !== 'E2E Board')
      const branch = body.data.find((item: { slug: string }) => item.slug === 'e2e')
      body.data.push({
        ...branch,
        id: '22222222-2222-4222-8222-222222222222',
        slug: 'e2e-board',
        name: 'E2E Board',
        branch_info: { ...branch.branch_info, address: 'Москва, Арбат, 10', latitude: 55.752, longitude: 37.591 },
      })
      await route.fulfill({ response, json: body })
    })
    await page.route('**/styles/liberty', (route) => route.fulfill({ json: {
      version: 8,
      glyphs: 'https://tiles.openfreemap.org/qa-glyphs/{fontstack}/{range}.pbf',
      sources: { openmaptiles: { type: 'vector', tiles: ['https://tiles.openfreemap.org/qa-tiles/{z}/{x}/{y}.pbf'] } },
      layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#eef1f5' } }],
    } }))
    await page.route('**/qa-tiles/**', (route) => route.fulfill({ contentType: 'application/x-protobuf', body: Buffer.alloc(0) }))
    const selections: string[] = []
    page.on('request', (request) => {
      if (request.method() === 'POST' && /\/client\/branches\/[^/]+\/select$/.test(request.url())) selections.push(request.url())
    })

    await page.goto('/e2e')
    await page.getByRole('button', { name: '590 ₽' }).click()
    await page.getByText('Заберу самостоятельно').click()
    const list = page.getByTestId('pickup-branch-list')
    await expect(list).toBeVisible()
    await expect(page.getByTestId('pickup-branch-detail')).toHaveCount(0)
    const selectionCount = selections.length
    if (screenshots) await page.screenshot({ path: `${screenshots}/pickup-${name}-list.png`, animations: 'disabled' })

    await openPickupPreview(page, 'E2E Board')
    await expect(page.getByTestId('pickup-branch-detail')).toContainText('Москва, Арбат, 10')
    await expect(page.getByTestId('pickup-branch-detail').getByRole('button', { name: 'Назад' })).toBeFocused()
    await page.getByTestId('pickup-branch-detail').getByRole('button', { name: 'Назад' }).click()
    await expect(list).toBeVisible()
    await expect(list.getByTestId('pickup-branch-row').filter({ has: page.getByText('E2E Board', { exact: true }) })).toBeFocused()
    await expect(page.getByRole('dialog')).toBeVisible()
    expect(selections).toHaveLength(selectionCount)
    await expect(page).toHaveURL(/\/e2e\/?$/)

    await page.locator('button[title="E2E Board"]').click()
    await expect(page.getByTestId('pickup-branch-detail')).toContainText('E2E Board')
    await page.getByTestId('pickup-branch-detail').getByRole('button', { name: 'Назад' }).click()
    await openPickupPreview(page)
    const detail = page.getByTestId('pickup-branch-detail')
    await expect(detail).toContainText('Москва, Тверская улица, 7')
    await expect(detail).toContainText('Сегодня')
    await expect(detail.getByRole('link', { name: /\+7/ })).toBeVisible()
    await detail.getByText('Вся неделя').click()
    await expect(detail.getByText('Понедельник')).toBeVisible()
    if (screenshots) await page.screenshot({ path: `${screenshots}/pickup-${name}-detail.png`, animations: 'disabled' })
    await detail.getByRole('button', { name: 'Заберу здесь' }).click()
    await expect(page.getByTestId('pickup-branch-detail')).toHaveCount(0)
  })
}

test('pickup without coordinates stays compact and supports list, back and confirm', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.route('**/client/franchise', async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    body.data.address_map = true
    await route.fulfill({ response, json: body })
  })
  await page.route('**/client/branches', async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    body.data = body.data.map((branch: { branch_info?: Record<string, unknown> }) => ({
      ...branch,
      branch_info: { ...branch.branch_info, latitude: null, longitude: null, address: null },
    }))
    await route.fulfill({ response, json: body })
  })
  await page.goto('/e2e')
  await page.getByRole('button', { name: '590 ₽' }).click()
  await page.getByText('Заберу самостоятельно').click()
  await expect(page.getByTestId('pickup-branch-list')).toBeVisible()
  await expect(page.locator('.maplibregl-canvas')).toHaveCount(0)
  await openPickupPreview(page)
  await page.getByTestId('pickup-branch-detail').getByRole('button', { name: 'Назад' }).click()
  await expect(page.getByTestId('pickup-branch-list')).toBeVisible()
  await selectPickupLocation(page)
  await expect(page.getByTestId('pickup-branch-detail')).toHaveCount(0)
})
