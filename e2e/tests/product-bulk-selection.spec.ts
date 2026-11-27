import { adminUrl } from '../support/env'
import { expect, test } from '../support/test'

const productsUrl = `${adminUrl}/staff/b/e2e-pagination/products?page=1&page_size=10`

test('product bulk selection is scoped to the visible page and filters', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.goto(productsUrl)
  await page.locator('[data-phx-main].phx-connected').waitFor()

  const rows = page.locator('#products input[form="product-selection"]')
  const bar = page.locator('#product-selection-bar')
  const selectPage = page.locator('#product-select-page-header')
  await expect(rows).toHaveCount(10)
  await expect(bar).toHaveCount(0)

  await rows.first().press('Space')
  await expect(rows.first()).toBeFocused()
  await expect(bar).toBeInViewport()
  await expect(bar.getByRole('status')).toContainText(/\b1\b/)
  await rows.first().press('Space')
  await expect(rows.first()).not.toBeChecked()
  await expect(bar).toHaveCount(0)

  await selectPage.check()
  await expect(rows.and(page.locator(':checked'))).toHaveCount(10)
  await expect(bar.getByRole('status')).toContainText(/\b10\b/)

  await page.locator('.join a').last().click()
  await expect(page).toHaveURL(/(?:\?|&)page=2(?:&|$)/)
  await expect(rows).toHaveCount(1)
  await expect(rows.first()).not.toBeChecked()
  await expect(bar).toHaveCount(0)

  await selectPage.check()
  await expect(rows.first()).toBeChecked()
  await page.locator('#products-filter input[name="search"]').fill('Pagination 01')
  await expect(page.locator('#products td[data-column="name"] a')).toHaveText('Pagination 01')
  await expect(rows.first()).not.toBeChecked()
  await expect(bar).toHaveCount(0)
})

test('product bulk actions fit a narrow screen and can be cleared by keyboard', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(productsUrl)
  await page.locator('[data-phx-main].phx-connected').waitFor()
  await page.evaluate(() => { document.documentElement.dataset.theme = 'dark' })

  await page.locator('#product-select-page').click()

  const bar = page.locator('#product-selection-bar')
  const pagination = page.locator('.join').last()
  await expect(bar).toBeInViewport()
  await expect.poll(() => page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )).toBeLessThanOrEqual(1)
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect(pagination).toBeInViewport()
  await expect.poll(async () => {
    const paginationBounds = await pagination.boundingBox()
    const barBounds = await bar.boundingBox()
    return paginationBounds && barBounds && paginationBounds.y + paginationBounds.height <= barBounds.y + 1
  }).toBe(true)

  await bar.getByRole('button', { name: 'Удалить' }).click()
  const confirmation = page.locator('#bulk-delete-products-modal')
  await expect(confirmation).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(confirmation).toBeHidden()
  await expect(bar).toBeVisible()

  await page.locator('#product-selection-bar-clear').press('Enter')
  await expect(bar).toHaveCount(0)
  await expect(page.locator('#products input[form="product-selection"]:checked')).toHaveCount(0)
})
