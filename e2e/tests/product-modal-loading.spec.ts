import { expect, test } from '@playwright/test'

test.use({ viewport: { width: 390, height: 844 },
  video: process.env.MENU_CAPTURE ? 'on' : 'off' })

const cards = '[id^="category-"] [role="button"]'
const title = 'Картофель по-деревенски'

for (const [width, name] of [[320, title], [768, title], [1024, title],
  [1024, 'Картофельподеревенскисрозмариномичернымперцем']] as const) {
  test(`product title wraps clear of the close button: ${width}px ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.route('**/client/storefront/v1/bootstrap?*', async route => {
      const response = await route.fetch()
      const body = await response.json()
      for (const category of body.menu) for (const product of category.products) product.name = name
      await route.fulfill({ response, json: body })
    })
    await page.goto('/e2e')
    await page.locator(cards).first().click()
    const dialog = page.getByRole('dialog').first()
    await expect(dialog.getByRole('heading', { name, exact: true })).toBeVisible()
    const geometry = await dialog.evaluate(element => {
      const heading = element.querySelector('h2')!
      const close = element.querySelector('button[aria-label="Закрыть"], .p-dialog-close-button, button:has(.pi-times)')!
      const range = document.createRange()
      range.selectNodeContents(heading)
      const button = close.getBoundingClientRect()
      const root = element.getBoundingClientRect()
      const text = [...range.getClientRects()].filter(r => r.width > 0 && r.height > 0)
      return { overlaps: text.some(r => r.left < button.right && r.right > button.left &&
        r.top < button.bottom && r.bottom > button.top),
      inside: text.every(r => r.left >= root.left && r.right <= root.right),
      scrollWidth: heading.scrollWidth, clientWidth: heading.clientWidth }
    })
    expect(geometry.overlaps).toBe(false)
    expect(geometry.inside).toBe(true)
    expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
    await page.screenshot({ path: `../artifacts/menu-background/title-${width}-${name === title ? 'normal' : 'unbroken'}.png` })
  })
}

for (const width of [390, 1024]) {
  test(`pending modal chunk shows a skeleton without loading copy at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 })
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    await page.route(/\/assets\/ProductModal-[^/]+\.js(?:\?|$)/, async route => {
      await gate
      await route.continue()
    })
    try {
      await page.goto('/e2e')
      await page.locator(cards).first().click()
      const dialog = page.getByRole('dialog')
      await expect(dialog.getByRole('status')).toBeVisible()
      await expect(dialog.getByRole('status')).toHaveText('')
      await expect(dialog.locator('img[src="/placeholder/product-placeholder.svg"]')).toBeVisible()
      await expect(page.getByText('Загружаем товар', { exact: true })).toHaveCount(0)
      await page.screenshot({ path: `../artifacts/menu-background/pending-${width}.png` })
      await dialog.getByRole('button', { name: /вернуться|return/i }).click()
      release()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(page.locator(cards).first()).toBeVisible()
    } finally { release?.() }
  })
}

test('pending direct product uses the same visual skeleton', async ({ page }) => {
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  await page.route(/\/client\/branches\/[^/]+\/products\/pending-fixture(?:\?|$)/, async route => {
    await gate
    await route.fulfill({ status: 404, body: 'No product' })
  })
  try {
    await page.goto('/e2e/product/pending-fixture')
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('status')).toBeVisible()
    await expect(dialog.getByRole('status')).toHaveText('')
    await expect(page.getByText('Загружаем товар', { exact: true })).toHaveCount(0)
    await dialog.getByRole('button', { name: /закрыть|close/i }).first().click()
    release()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  } finally { release?.() }
})
