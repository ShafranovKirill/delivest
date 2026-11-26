import { expect, test, type Page } from '@playwright/test'

// Targeted run: pnpm --dir e2e exec playwright test menu-performance.spec.ts
// MENU_CAPTURE=1 enables video and screenshots; traces are retained on failure.
test.use({ viewport: { width: 390, height: 844 },
  video: process.env.MENU_CAPTURE ? 'on' : 'off',
  screenshot: process.env.MENU_CAPTURE ? 'on' : 'only-on-failure' })

test.beforeEach(async ({ page }) => { await page.emulateMedia({ reducedMotion: 'reduce' }) })

const bootstrapUrl = /\/client\/storefront\/v1\/bootstrap(?:\?|$)/
const menuSectionUrl = /\/client\/storefront\/v1\/sections\/menu(?:\?|$)/
const manifestUrl = /\/client\/storefront\/v1\/manifest(?:\?|$)/
const cards = (page: Page) => page.locator('[id^="category-"] [role="button"]')

async function bootstrap(page: Page, change: (body: any, slug: string | null) => any) {
  await page.route(bootstrapUrl, async route => {
    const response = await route.fetch()
    await route.fulfill({ response, json: change(await response.json(), new URL(route.request().url()).searchParams.get('slug')) })
  })
}

function longMenu(body: any) {
  const first = body.menu.find((category: any) => category.products?.length)
  if (!first) throw new Error('E2E seed has no product category')
  return [0, 1, 2].map(section => ({ ...first, id: `${first.id}-${section}`, name: `Section ${section}`,
    products: Array.from({ length: 24 }, (_, index) => {
      const original = first.products[index % first.products.length]
      return { ...original, id: `${original.id}-${section}-${index}`,
        slug: `product-${section}-${index}`, name: `Product ${section}-${index}` }
    }) }))
}

test('delayed section shows skeleton until first card', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await bootstrap(page, body => ({ ...body, menu: null }))
  await page.route(menuSectionUrl, async route => { await gate; await route.continue() })
  try {
    await page.goto('/e2e', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('.p-skeleton').first()).toBeVisible()
    await expect(cards(page)).toHaveCount(0)
    release()
    await expect(cards(page).first()).toBeVisible()
  } finally { release?.() }
})

test('failed section retries, and empty bootstrap has no cards', async ({ page }) => {
  await bootstrap(page, body => ({ ...body, menu: null }))
  let attempts = 0
  await page.route(menuSectionUrl, async route => {
    if (++attempts <= 3) await route.fulfill({ status: 503, body: 'Unavailable' })
    else await route.continue()
  })
  await page.goto('/e2e')
  await expect(page.getByRole('button', { name: /попробовать снова|retry/i })).toBeVisible()
  await page.getByRole('button', { name: /попробовать снова|retry/i }).click()
  await expect(cards(page).first()).toBeVisible()
  expect(attempts).toBeGreaterThanOrEqual(4)

  await page.unrouteAll({ behavior: 'wait' })
  await bootstrap(page, body => ({ ...body, menu: [] }))
  await page.reload()
  await expect(cards(page)).toHaveCount(0)
})

test('large menu reveals late cards, category jump and product route work', async ({ page }) => {
  await bootstrap(page, body => ({ ...body, menu: longMenu(body) }))
  await page.goto('/e2e')
  await expect(cards(page).first()).toBeVisible()
  const lastCategory = page.locator('[id^="category-"]').last()
  await page.locator('.sticky button[data-id]').last().click()
  await expect(lastCategory).toBeInViewport()
  await expect(lastCategory.getByRole('img').first()).toBeVisible()
  await lastCategory.locator('[role="button"]').last().scrollIntoViewIfNeeded()
  await expect(lastCategory.locator('[role="button"]').last()).toBeVisible()

  // The seeded slug remains reachable independent of the large menu mock.
  await page.goto('/e2e/product/e2e-1')
  await expect(page.getByRole('dialog').first()).toBeVisible()
  await page.getByRole('dialog').first().getByRole('button', { name: /закрыть|close/i }).first().click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('manifest revision updates displayed cards in the background', async ({ page }) => {
  await page.clock.install()
  let initial: any
  await bootstrap(page, body => { initial = body; return body })
  await page.route(manifestUrl, async route => {
    const revisions = { ...initial.revisions, menu: `${initial.revisions.menu}:updated` }
    await route.fulfill({ json: { revisions, advertising: initial.advertising,
      valid_until: new Date(Date.now() + 120_000).toISOString() } })
  })
  let updates = 0
  await page.route(menuSectionUrl, async route => {
    updates++
    const data = initial.menu.map((category: any, index: number) => index === 0
      ? { ...category, products: category.products.map((product: any, productIndex: number) => productIndex === 0
        ? { ...product, name: 'Updated fixture product' } : product) } : category)
    await route.fulfill({ json: { data, valid_until: new Date(Date.now() + 120_000).toISOString() },
      headers: { 'content-type': 'application/json', etag: '"menu-performance-updated"' } })
  })
  await page.goto('/e2e')
  await expect(cards(page).first()).toBeVisible()
  await page.clock.fastForward(21_000)
  await expect(page.getByText('Updated fixture product').first()).toBeVisible()
  expect(updates).toBeGreaterThan(0)
})

test('selecting another branch clears old menu without a full page reload', async ({ page }) => {
  let initial: any
  const otherId = 'e4b4bfee-8273-4aaa-857c-904782f8b882'
  await page.route(bootstrapUrl, async route => {
    const slug = new URL(route.request().url()).searchParams.get('slug')
    if (!initial) initial = await (await route.fetch()).json()
    const other = { ...initial.selected_branch, id: otherId, slug: 'other-fixture', name: 'Other fixture' }
    await route.fulfill({ json: { ...initial, branches: [...initial.branches, other],
      selected_branch: slug === 'other-fixture' ? other : initial.selected_branch,
      menu: slug === 'other-fixture' ? [] : initial.menu } })
  })
  await page.goto('/e2e')
  await expect(cards(page).first()).toBeVisible()
  await page.locator('#mobile-menu-button').click()
  await page.locator('#mobile-sidebar').getByRole('button', { name: /E2E/ }).first().click()
  await page.getByRole('button', { name: /Other fixture/i }).click()
  await expect(page).toHaveURL(/\/other-fixture$/)
  await expect(cards(page)).toHaveCount(0)
})

test('closing a pending direct product keeps the menu usable after late response', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route(/\/client\/branches\/[^/]+\/products\/pending-fixture(?:\?|$)/, async route => {
    await gate
    await route.fulfill({ status: 404, body: 'No product' })
  })
  try {
    await page.goto('/e2e/product/pending-fixture')
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('dialog').getByRole('button', { name: /закрыть|close/i }).click()
    release()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(cards(page).first()).toBeVisible()
    await cards(page).last().scrollIntoViewIfNeeded()
    await expect(cards(page).last()).toBeVisible()
  } finally { release?.() }
})


test('closing during the product modal chunk download ignores late completion', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  let requested = false
  await page.route(/\/assets\/ProductModal-[^/]+\.js(?:\?|$)/, async route => {
    requested = true
    await gate
    await route.continue()
  })
  try {
    await page.goto('/e2e')
    await expect(cards(page).first()).toBeVisible()
    await cards(page).first().click()
    await expect(page.getByRole('dialog').getByRole('status')).toBeVisible()
    await expect.poll(() => requested).toBe(true)
    await page.getByRole('dialog').getByRole('button', { name: /вернуться|return/i }).click()
    release()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page).toHaveURL(/\/e2e$/)
    await expect(cards(page).first()).toBeVisible()
  } finally { release?.() }
})

for (const dpr of [1, 2]) {
  test.describe(`responsive DPR ${dpr}`, () => {
    test.use({ deviceScaleFactor: dpr })
    test('native responsive photo selection', async ({ page }) => {
      const response = page.waitForResponse(bootstrapUrl)
      await page.goto('/e2e')
      const body = await (await response).json()
      expect(body.menu.flatMap((c: any) => c.products).find((p: any) => p.slug === 'e2e-1').photo_variants).toHaveLength(3)
      const image = cards(page).filter({ has: page.getByText('Маргарита', { exact: true }) }).first().getByRole('img')
      await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
      expect(await image.evaluate((img: HTMLImageElement) => img.currentSrc)).toContain(`menu-performance-${dpr === 1 ? 192 : 384}.webp`)
    })
  })
}

test('failed responsive photo falls back and preserves card geometry', async ({ page }) => {
  await page.route('**/images/menu-performance-192.webp', route => route.fulfill({ status: 404, body: '' }))
  await page.goto('/e2e')
  const card = page.getByRole('button', { name: 'Маргарита', exact: true }).first()
  const image = card.getByRole('img')
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(800)
  const before = await card.boundingBox()
  expect(await image.evaluate((img: HTMLImageElement) => img.currentSrc)).toContain('menu-performance-800.webp')
  await card.click()
  await expect(page.getByRole('dialog').first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  const after = await card.boundingBox()
  expect(after?.height).toBe(before?.height)
})

for (const width of [320, 390, 1280]) {
  test(`skeleton reserves the ready photo area at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    await bootstrap(page, body => ({ ...body, menu: null }))
    await page.route(menuSectionUrl, async route => { await gate; await route.continue() })
    try {
      await page.goto('/e2e')
      const placeholder = page.locator('.grid .p-skeleton.aspect-square').first()
      await expect(placeholder).toBeVisible()
      const before = (await placeholder.boundingBox())!
      expect(before.width).toBeGreaterThan(140)
      expect(Math.abs(before.width - before.height)).toBeLessThan(1)
      expect(await placeholder.evaluate(element => getComputedStyle(element, '::after').animationName)).toBe('none')
      release()
      const photo = cards(page).first().locator('.aspect-square').first()
      await expect(photo).toBeVisible()
      const after = (await photo.boundingBox())!
      expect(Math.abs(after.width - before.width)).toBeLessThan(1)
      expect(Math.abs(after.height - before.height)).toBeLessThan(1)
      expect(Math.abs(after.y - before.y)).toBeLessThan(1)
      await page.screenshot({ path: `../artifacts/menu-performance/ready-${width}.png` })
    } finally { release?.() }
  })
}

test('fast bootstrap and warm reload do not flash the menu skeleton', async ({ page }) => {
  await page.addInitScript(() => {
    ;(window as any).__menuSkeletonFrames = 0
    const sample = () => {
      if (document.querySelector('.grid .p-skeleton.aspect-square')) (window as any).__menuSkeletonFrames++
      requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  })
  await page.goto('/e2e')
  await expect(cards(page).first()).toBeVisible()
  expect(await page.evaluate(() => (window as any).__menuSkeletonFrames)).toBe(0)
  await page.reload()
  await expect(cards(page).first()).toBeVisible()
  expect(await page.evaluate(() => (window as any).__menuSkeletonFrames)).toBe(0)
})
