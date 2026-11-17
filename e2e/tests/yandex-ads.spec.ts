import { expect, test } from '../support/test'
import { adminUrl, branchSlug } from '../support/env'

test('a direct product opens while the background menu fails', async ({ page, request }) => {
  const branches = await (await request.get(`${adminUrl}/client/branches`)).json()
  const branch = branches.data.find((item: { slug: string }) => item.slug === branchSlug)
  expect(branch).toBeTruthy()
  const menu = await (await request.get(`${adminUrl}/client/branches/${branch.id}/menu`)).json()
  const product = menu.data.flatMap((category: { products: unknown[] }) => category.products)
    .find((item: { stopped: boolean }) => !item.stopped)
  expect(product).toBeTruthy()
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route(`**/client/branches/${branch.id}/menu`, route => route.abort())
  await page.goto(`/${branchSlug}/product/${product.id}`)
  await expect(page.getByRole('dialog').getByRole('heading', { name: product.name, exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('disabled Metrika makes no provider or identity requests', async ({ page }) => {
  const unexpected: string[] = []
  page.on('request', request => {
    const url = new URL(request.url())
    if (/^(?:mc|mc\.webvisor)\.yandex\./.test(url.hostname) || url.pathname.endsWith('/advertising/identity')) {
      unexpected.push(request.url())
    }
  })
  await page.route('**/advertising/config', route => route.fulfill({ json: {
    data: { enabled: false, counter_id: null, generation: 1, ecommerce: false, capture: false, collection_basis: 'disabled' },
  } }))
  await page.goto(`/${branchSlug}?yclid=123456789`)
  await expect(page.locator('.boot')).toHaveCount(0)
  await expect(page.getByRole('button', { name: '590 ₽' }).first()).toBeVisible()
  expect(unexpected).toEqual([])
})

test('Yandex settings and advertising report work in the existing staff shell', async ({ staff }) => {
  const admin = await staff('e2e_admin')
  const errors: string[] = []
  admin.on('pageerror', error => errors.push(error.message))
  await admin.goto(`${adminUrl}/staff/integrations/yandex-ads`)
  await expect(admin.locator('#yandex-ads-settings')).toBeVisible()
  await expect(admin.locator('#yandex-oauth-connect')).toBeVisible()
  await expect(admin.locator('#yandex-ensure-funnel-goals')).toBeVisible()
  await expect(admin.locator('input[name="yandex_ads[direct_token]"]')).toHaveValue('')
  await admin.goto(`${adminUrl}/staff/analytics/advertising`)
  await expect(admin.locator('#advertising-coverage')).toBeVisible()
  await expect(admin.locator('#advertising-no-costs')).toBeVisible()
  for (const width of [1440, 390]) {
    await admin.setViewportSize({ width, height: 900 })
    await expect.poll(() => admin.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
    await test.info().attach(`advertising-${width}`, { body: await admin.screenshot({ fullPage: true }), contentType: 'image/png' })
  }
  expect(errors).toEqual([])
})
