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

test('desktop category bar keeps complete names and moves the remainder into More on resize', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 844 })
  const names = [
    'Многокомпонентные наборы',
    'Свежеприготовленные новинки',
    'Свежезапечённые роллы',
    'Свежеприготовленные десерты',
    'Прохладительные напитки',
    'Дополнительные ингредиенты',
    'Тридцатитрёхсантиметровая пицца',
    longName,
  ]
  await mockCategories(page, names)
  await page.goto('/e2e')
  const nav = page.getByTestId('desktop-category-nav')
  const visible = nav.locator(':scope > button')
  const more = page.getByTestId('desktop-category-more')
  await expect(more).toBeVisible()
  await expect.poll(() => visible.count()).toBeGreaterThan(0)
  const narrowCount = await visible.count()
  expect(narrowCount).toBeLessThan(names.length)
  await expect(more.getByRole('button')).toHaveText('Ещё')

  const checkLayout = async (width: number) => {
    const count = await visible.count()
    expect(await visible.allTextContents()).toEqual(names.slice(0, count))
    expect(await more.locator('.overflow-y-auto > div').allTextContents()).toEqual(names.slice(count))
    const geometry = await nav.evaluate((element) => {
      const style = getComputedStyle(element)
      const right = element.getBoundingClientRect().right - parseFloat(style.paddingRight)
      const buttons = [...element.querySelectorAll(':scope > button')]
      return {
        buttonsFit: buttons.every((button) => {
          const bounds = button.getBoundingClientRect()
          return bounds.right <= right + 1 && button.scrollWidth <= button.clientWidth + 1
        }),
        moreFits: element.querySelector('[data-testid="desktop-category-more"]')!.getBoundingClientRect().right <= right + 1,
        pageFits: document.documentElement.scrollWidth <= window.innerWidth,
      }
    })
    expect(geometry).toEqual({ buttonsFit: true, moreFits: true, pageFits: true })
    expect(await page.evaluate(() => window.innerWidth)).toBe(width)
  }

  await checkLayout(900)
  await page.setViewportSize({ width: 1280, height: 844 })
  await expect.poll(() => visible.count()).toBeGreaterThan(narrowCount)
  await checkLayout(1280)
  await page.setViewportSize({ width: 900, height: 844 })
  await expect.poll(() => visible.count()).toBe(narrowCount)
  await checkLayout(900)

  await more.hover()
  const item = more.getByText(longName)
  await expect(item).toBeVisible()
  const dropdownText = await textFits(page, '[data-testid="desktop-category-more"] .overflow-y-auto > div:last-child p')
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
  const scrollBefore = await page.evaluate(() => window.scrollY)
  await item.click()
  const moreButton = more.getByRole('button')
  await expect(moreButton).toHaveText('Ещё')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBefore)
})

test('desktop category bar hides More when every category fits', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 844 })
  await mockCategories(page, ['Пицца', 'Роллы'])
  await page.goto('/e2e')
  const nav = page.getByTestId('desktop-category-nav')
  await expect(nav.locator(':scope > button')).toHaveCount(2)
  await expect(page.getByTestId('desktop-category-more')).toHaveCount(0)
})
