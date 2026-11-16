import { expect, type Page } from '@playwright/test'

export async function openPickupPreview(page: Page, branchName = 'E2E') {
  const list = page.getByTestId('pickup-branch-list')
  await expect(list).toBeVisible()
  await list.getByTestId('pickup-branch-row').filter({ has: page.getByText(branchName, { exact: true }) }).click()
  await expect(page.getByTestId('pickup-branch-detail')).toBeVisible()
}

export async function selectPickupLocation(page: Page) {
  const list = page.getByTestId('pickup-branch-list')
  await list.getByTestId('pickup-branch-row').filter({ has: page.getByText('E2E', { exact: true }) }).click()
  const detail = page.getByTestId('pickup-branch-detail')
  await expect(detail).toBeVisible()
  await detail.getByRole('button', { name: 'Заберу здесь' }).click()
}
