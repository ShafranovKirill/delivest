import { expect } from '@playwright/test'
import { test } from '../support/test'
import { branchPage } from '../support/staff'

test('the admin opens the delivery sections and saves the courier settings', async ({ staff }) => {
  const admin = await staff('e2e_admin')
  await branchPage(admin, 'delivery')

  await admin.locator('#delivery-zones-card').click()
  await expect(admin.locator('#delivery-settings')).toBeVisible()
  await expect(admin.locator('#delivery-zone-map, #delivery-settings')).not.toHaveCount(0)

  await branchPage(admin, 'delivery')
  await admin.locator('#delivery-couriers-card').click()
  const search = admin.locator('#couriers-form select[name="couriers[search]"]')
  const before = await search.inputValue()
  const next = before === 'ready' ? 'preparing' : 'ready'

  await search.selectOption(next)
  await admin.locator('#couriers-form button[type=submit]').click()
  await admin.waitForURL(/\/delivery$/)

  await admin.locator('#delivery-couriers-card').click()
  await expect(search).toHaveValue(next)

  await search.selectOption(before)
  await admin.locator('#couriers-form button[type=submit]').click()
  await admin.waitForURL(/\/delivery$/)
})
