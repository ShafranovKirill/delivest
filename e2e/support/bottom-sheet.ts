import { expect, type Locator, type Page } from '@playwright/test'

export async function expectBottomSheet(page: Page, dialog: Locator) {
  const mask = page.locator('.p-dialog-mask').filter({ has: dialog })
  await expect(dialog).toBeVisible()
  await expect.poll(async () => {
    const box = await dialog.boundingBox()
    const maskBox = await mask.boundingBox()
    if (!box || !maskBox) return null
    return {
      left: Math.round(box.x - maskBox.x),
      right: Math.round(maskBox.x + maskBox.width - box.x - box.width),
      bottom: Math.round(maskBox.y + maskBox.height - box.y - box.height),
    }
  }).toEqual({ left: 0, right: 0, bottom: 0 })
  await expect(dialog.locator('.p-dialog-close-button, button:has(.pi-times)')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Закрыть' })).toBeVisible()
}

export async function dragSheetHandle(page: Page, handle: Locator, distance: number) {
  const box = (await handle.boundingBox())!
  const x = box.x + box.width / 2
  const y = box.y + box.height / 2
  const client = await page.context().newCDPSession(page)
  try {
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    for (let step = 1; step <= 8; step++) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x, y: y + (distance * step) / 8 }],
      })
    }
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  } finally {
    await client.detach()
  }
}
