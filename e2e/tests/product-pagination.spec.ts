import { test, expect } from '../support/test'
import { adminUrl } from '../support/env'

const productsUrl = `${adminUrl}/staff/b/e2e-pagination/products`
const pageOneUrl = `${productsUrl}?page=1&page_size=10`
const pageTwoUrl = `${productsUrl}?page=2&page_size=10`

const rows = (page: import('@playwright/test').Page) => page.locator('tbody#products tr[id]')
const names = async (page: import('@playwright/test').Page) =>
  rows(page).locator('td[data-column="name"] a').allTextContents()

const expectFirstPage = async (page: import('@playwright/test').Page) => {
  await expect(rows(page)).toHaveCount(10)
  await expect(page).toHaveURL(/(?:\?|&)page=1(?:&|$)/)
}

test('staff product pagination preserves pages, filters, sorting, and browser history', async ({ staff }) => {
  const page = await staff('e2e_pagination')
  await page.goto(pageOneUrl)
  await expectFirstPage(page)
  const firstPageNames = await names(page)
  expect(firstPageNames).toHaveLength(10)
  expect(firstPageNames).not.toContain('Pagination Hidden')

  await page.locator('.join a').last().click()
  await expect(page).toHaveURL(/(?:\?|&)page=2(?:&|$)/)
  await expect(rows(page)).toHaveCount(1)
  const secondPageNames = await names(page)
  expect(new Set([...firstPageNames, ...secondPageNames]).size).toBe(11)
  expect([...firstPageNames, ...secondPageNames].sort()).toEqual(
    Array.from({ length: 11 }, (_, index) => `Pagination ${String(index + 1).padStart(2, '0')}`),
  )
  expect(secondPageNames).not.toContain('Pagination Hidden')

  const deepLink = page.url()
  await page.reload()
  await expect(rows(page)).toHaveCount(1)
  await expect(names(page)).resolves.toEqual(secondPageNames)
  await page.goBack()
  await expectFirstPage(page)
  await expect(names(page)).resolves.toEqual(firstPageNames)

  await page.goto(pageTwoUrl)
  await page.locator('#products-filter input[name="search"]').fill('Pagination 01')
  await expect(page).toHaveURL(/(?:\?|&)page=1(?:&|$)/)
  await expect(rows(page)).toHaveCount(1)
  await expect(names(page)).resolves.toEqual(['Pagination 01'])

  await page.goto(pageTwoUrl)
  await page.locator('#products-filter select[name="category_id"]').selectOption({ label: 'E2E Pagination A' })
  await expect(page).toHaveURL(/(?:\?|&)page=1(?:&|$)/)
  await expect(rows(page)).toHaveCount(6)

  await page.goto(pageTwoUrl)
  await page.locator('#products-filter select[name="is_active"]').selectOption('true')
  await expect(page).toHaveURL(/(?:\?|&)page=1(?:&|$)/)
  await expect(rows(page)).toHaveCount(6)

  await page.goto(pageTwoUrl)
  const nameSort = page.locator('table thead th[data-column="name"] a')
  await nameSort.click()
  await expectFirstPage(page)
  await expect(page).toHaveURL(/order_directions\[\]=asc/)
  await expect(rows(page).first().locator('td[data-column="name"] a')).toHaveText('Pagination 01')
  await nameSort.click()
  await expectFirstPage(page)
  await expect(page).toHaveURL(/order_directions\[\]=desc/)
  await expect(rows(page).first().locator('td[data-column="name"] a')).toHaveText('Pagination 11')

  await page.goto(deepLink)
  await expect(rows(page)).toHaveCount(1)
  await expect(names(page)).resolves.toEqual(secondPageNames)

  await page.goto(`${adminUrl}/staff/b/e2e-pagination-other/products`)
  await expect(page).toHaveURL(/\/staff\/branches\/select/)
})
