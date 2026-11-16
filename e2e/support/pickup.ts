import { expect, type Page } from '@playwright/test'

export async function openPickupPreview(page: Page, branchName = 'E2E') {
  const list = page.getByTestId('pickup-branch-list')
  await expect(list).toBeVisible()
  await list.getByTestId('pickup-branch-row').filter({ has: page.getByText(branchName, { exact: true }) }).click()
  await expect(page.getByTestId('pickup-branch-detail')).toBeVisible()
}

export async function selectPickupLocation(page: Page) {
  const row = page.getByTestId('pickup-branch-list').getByTestId('pickup-branch-row').filter({ has: page.getByText('E2E', { exact: true }) })
  await expect(row).toBeVisible()
  await row.click()
  const detail = page.getByTestId('pickup-branch-detail')
  if (await detail.isVisible()) await detail.getByRole('button', { name: 'Заберу здесь' }).click()
}
