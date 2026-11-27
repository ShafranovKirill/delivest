import { expect, test, type Page } from '@playwright/test'
import { resolve } from 'node:path'

test.use({ viewport: { width: 390, height: 844 },
  video: process.env.MENU_CAPTURE ? 'on' : 'off' })

function deferred() {
  let release!: () => void
  const promise = new Promise<void>(resolve => { release = resolve })
  return { promise, release }
}

const cards = (page: Page) => page.locator('[id^="category-"] [role="button"]')
const otherId = 'e4b4bfee-8273-4aaa-857c-904782f8b882'

async function photoFixture(page: Page, firstWaveHeld = true) {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const firstWave = deferred()
  if (!firstWaveHeld) firstWave.release()
  const background = new Map<number, ReturnType<typeof deferred>>()
  const started: Array<{ index: number; width: number }> = []
  const active = new Set<number>()
  let maxActive = 0
  let allReleased = false
  let initial: any
  await page.route('**/client/storefront/v1/bootstrap?*', async route => {
    if (!initial) initial = await (await route.fetch()).json()
    const other = { ...initial.selected_branch, id: otherId, slug: 'other-fixture', name: 'Other fixture' }
    const slug = new URL(route.request().url()).searchParams.get('slug')
    const apiOrigin = new URL(route.request().url()).origin
    const category = initial.menu.find((c: any) => c.products?.length)
    const product = category.products[0]
    const menu = [{ ...category, products: Array.from({ length: 30 }, (_, index) => ({
      ...product, id: `background-${index}`, slug: `background-${index}`, name: `Background ${index}`,
      photo_url: `${apiOrigin}/images/bg-photo-${index}-800.webp`,
      photo_variants: [192, 384, 800].map(width => ({ width,
        url: `${apiOrigin}/images/bg-photo-${index}-${width}.webp` })),
    })) }]
    await route.fulfill({ json: { ...initial, branches: [...initial.branches, other],
      selected_branch: slug === 'other-fixture' ? other : initial.selected_branch,
      menu: slug === 'other-fixture' ? [] : menu } })
  })
  await page.route('**/images/bg-photo-*.webp', async route => {
    const match = new URL(route.request().url()).pathname.match(/bg-photo-(\d+)-(\d+)\.webp$/)!
    const index = Number(match[1]), width = Number(match[2])
    started.push({ index, width })
    if (index < 12) await firstWave.promise
    else {
      const gate = deferred()
      background.set(index, gate)
      active.add(index)
      maxActive = Math.max(maxActive, active.size)
      if (!allReleased) await gate.promise
    }
    try {
      await route.fulfill({ path: resolve(`fixtures/menu-performance/menu-performance-${width}.webp`),
        contentType: 'image/webp' })
    } finally { active.delete(index) }
  })
  const releaseAll = () => {
    allReleased = true
    firstWave.release()
    for (const gate of background.values()) gate.release()
  }
  return { firstWave, background, started, active, errors, releaseAll, maxActive: () => maxActive }
}

const frames = (page: Page) => page.evaluate(() => new Promise<void>(resolve =>
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))

for (const dpr of [1, 2]) {
  test.describe(`background DPR ${dpr}`, () => {
    test.use({ deviceScaleFactor: dpr })
    test('visible photos finish first, then two background photos load without scrolling', async ({ page }) => {
      const fixture = await photoFixture(page)
      try {
        await page.goto('/e2e')
        await expect.poll(() => fixture.started.length).toBeGreaterThan(0)
        await frames(page)
        expect(fixture.errors).toEqual([])
        expect(fixture.started.some(request => request.index >= 12)).toBe(false)
        fixture.firstWave.release()
        await expect.poll(() => fixture.background.size).toBe(2)
        await frames(page)
        expect(fixture.background.size).toBe(2)
        const first = fixture.background.keys().next().value!
        const image = page.getByRole('img', { name: `Background ${first}`, exact: true })
        await expect(image).toHaveAttribute('loading', 'eager')
        await expect(image).toHaveAttribute('fetchpriority', 'low')
        fixture.background.get(first)!.release()
        await expect.poll(() => fixture.background.size).toBe(3)
        fixture.releaseAll()
        const last = cards(page).last().getByRole('img')
        await expect(last).toHaveJSProperty('complete', true)
        await expect(last).not.toHaveClass(/opacity-0/)
        expect(await page.evaluate(() => window.scrollY)).toBe(0)
        expect(fixture.maxActive()).toBeLessThanOrEqual(2)
        expect(fixture.started.every(request => request.width === (dpr === 1 ? 192 : 384))).toBe(true)
      } finally { fixture.releaseAll() }
    })
  })
}

test('branch selection discards queued photos even after late old responses', async ({ page }) => {
  const fixture = await photoFixture(page, false)
  try {
    await page.goto('/e2e')
    await expect.poll(() => fixture.background.size).toBe(2)
    await page.locator('#mobile-menu-button').click()
    await page.locator('#mobile-sidebar').getByRole('button', { name: /E2E/ }).first().click()
    await page.getByRole('button', { name: /Other fixture/i }).click()
    await expect(page).toHaveURL(/\/other-fixture$/)
    await expect(cards(page)).toHaveCount(0)
    fixture.releaseAll()
    await frames(page)
    expect(fixture.background.size).toBe(2)
  } finally { fixture.releaseAll() }
})
