import { readFile } from 'node:fs/promises'
import { test, expect } from '../support/test'
import { adminUrl } from '../support/env'

const sourceSlug = 'e2e-pagination'
const targetSlug = 'e2e-pagination-other'
const operationsUrl = (slug: string) => `${adminUrl}/staff/b/${slug}/products/operations`
const productsUrl = (slug: string) => `${adminUrl}/staff/b/${slug}/products`
const productRows = (page: import('@playwright/test').Page) => page.locator('tbody#products tr[id]')

const previewCounts = async (page: import('@playwright/test').Page) => {
  const text = await page.locator('#operations-preview h2').innerText()
  const counts = text.match(/новых\s+(\d+),\s+совпадений\s+(\d+),\s+ошибок\s+(\d+)/)
  expect(counts, text).not.toBeNull()
  return { created: Number(counts![1]), matched: Number(counts![2]), errors: Number(counts![3]) }
}

const expectResult = async (page: import('@playwright/test').Page, created: number, updated: number, skipped: number) => {
  await expect(page.locator('#operations-result')).toContainText(`Создано: ${created}, обновлено: ${updated}, пропущено: ${skipped}`)
}

test('product operations copy idempotently and round-trip a downloaded workbook', async ({ staff }) => {
  const page = await staff('e2e_admin')
  await page.goto(operationsUrl(sourceSlug))
  await expect(page.locator('#copy-preview-form')).toBeVisible()
  await page.locator('#copy-preview-form select[name="target_branch_id"]').selectOption({ label: 'E2E Pagination Other' })
  await page.locator('#copy-preview-form button[type="submit"]').click()

  const firstCopy = await previewCounts(page)
  expect(firstCopy.created + firstCopy.matched).toBe(11)
  expect(firstCopy.errors).toBe(0)
  await page.locator('#operations-apply-form button[type="submit"]').click()
  await expectResult(page, firstCopy.created, 0, firstCopy.matched)

  await page.goto(`${productsUrl(sourceSlug)}?page=1&page_size=10`)
  await expect(productRows(page)).toHaveCount(10)
  await page.goto(`${productsUrl(sourceSlug)}?page=2&page_size=10`)
  await expect(productRows(page)).toHaveCount(1)

  await page.goto(operationsUrl(sourceSlug))
  await page.locator('#copy-preview-form select[name="target_branch_id"]').selectOption({ label: 'E2E Pagination Other' })
  await page.locator('#copy-preview-form button[type="submit"]').click()
  await expect(previewCounts(page)).resolves.toEqual({ created: 0, matched: 11, errors: 0 })
  await page.locator('#operations-apply-form button[type="submit"]').click()
  await expectResult(page, 0, 0, 11)

  await page.goto(`${productsUrl(targetSlug)}?page=1&page_size=10`)
  await expect(productRows(page)).toHaveCount(10)
  await page.goto(`${productsUrl(targetSlug)}?page=2&page_size=10`)
  await expect(productRows(page)).toHaveCount(2)

  await page.goto(operationsUrl(targetSlug))
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('#workbook-export a').click(),
  ])
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/)
  const workbook = await readFile(await download.path())
  expect(workbook.length).toBeGreaterThan(0)

  await page.locator('#workbook-upload-form input[type="file"]').setInputFiles({
    name: 'roundtrip.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: workbook,
  })
  await expect(page.locator('#workbook-import')).toContainText('roundtrip.xlsx')
  await page.locator('#workbook-upload-form button[type="submit"]').click()
  await expect(previewCounts(page)).resolves.toEqual({ created: 0, matched: 12, errors: 0 })
  await page.locator('#operation-row-2 select').selectOption('update')
  await page.locator('#operations-apply-form button[type="submit"]').click()
  await expectResult(page, 0, 1, 11)

  await page.goto(`${productsUrl(targetSlug)}?page=2&page_size=10`)
  await expect(productRows(page)).toHaveCount(2)
})
