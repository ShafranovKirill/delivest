import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const longName = 'ОченьДлинноеНазваниеКатегорииБезПробелов'.repeat(4)
const twoWordName = 'ОченьДлинноеНазваниеКатегории СНеобычайноДлиннымВторымСловом'

async function mockCategories(page: Page, names: string[]) {
  await page.route(/\/client\/branches\/[^/]+\/menu(?:\?|$)/, async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    const first = body.data.find((category: { products?: unknown[] }) => category.products?.length)
    if (!first) throw new Error('Fixture menu has no category with products')
    body.data = names.map((name, index) => ({ ...first, id: `${first.id}-${index}`, name }))
    await route.fulfill({ response, json: body })
  })
}

async function textFits(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((element) => {
    const range = document.createRange()
    range.selectNodeContents(element)
    const bounds = element.getBoundingClientRect()
    const lines = [...range.getClientRects()]
    return {
      lines: lines.length,
      fits: lines.every((line) => line.left >= bounds.left - 1 && line.right <= bounds.right + 1),
    }
  })
}

test('long category name fits mobile button and heading', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockCategories(page, [twoWordName, 'Другая'])
  await page.goto('/e2e')
  const button = page.locator('main .sticky button[data-id]').first()
  await expect(button).toContainText(twoWordName)
  const buttonBox = await button.boundingBox()
  expect(buttonBox).not.toBeNull()
  expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(390)
  const buttonText = await textFits(page, 'main .sticky button[data-id] p')
  expect(buttonText.fits).toBe(true)
  expect(buttonText.lines).toBeGreaterThan(1)
  const heading = await textFits(page, '[id^="category-"] h2')
  expect(heading.fits).toBe(true)
  expect(heading.lines).toBeGreaterThan(1)
})

test('long category name fits desktop dropdown and active More label', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 844 })
  await mockCategories(page, [...Array.from({ length: 8 }, (_, index) => `Категория ${index}`), longName])
  await page.goto('/e2e')
  const more = page.locator('main .sticky .group')
  await expect(more).toBeVisible()
  await more.hover()
  const item = more.getByText(longName)
  await expect(item).toBeVisible()
  const dropdownText = await textFits(page, 'main .sticky .group .overflow-y-auto > div:last-child p')
  expect(dropdownText.fits).toBe(true)
  expect(dropdownText.lines).toBeGreaterThan(1)
  const fitsDropdown = await item.evaluate((element) => {
    const menu = element.closest('.overflow-y-auto')!
    const bounds = menu.getBoundingClientRect()
    const range = document.createRange()
    range.selectNodeContents(element)
    return [...range.getClientRects()].every((line) =>
      line.left >= bounds.left - 1 && line.right <= bounds.right + 1,
    )
  })
  expect(fitsDropdown).toBe(true)
  await item.click()
  const moreButton = more.getByRole('button')
  await expect(moreButton).toContainText(longName)
  const text = await textFits(page, 'main .sticky .group button p')
  expect(text.fits).toBe(true)
  expect(text.lines).toBeGreaterThan(1)
  const buttonBox = await moreButton.boundingBox()
  expect(buttonBox).not.toBeNull()
  expect(buttonBox!.x + buttonBox!.width).toBeLessThanOrEqual(900)
})
