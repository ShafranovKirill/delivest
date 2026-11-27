import { test, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { selectPickupLocation } from '../support/pickup'
import { mockDeliveryAddressSuggestion, selectDeliveryAddress } from '../support/delivery-address'

test.use({ viewport: { width: 390, height: 844 }, video: 'on' })

for (const mode of ['pickup', 'delivery']) {
  test(`cart and ${mode} checkout icon transfers`, async ({ page, context }) => {
    const output = resolve(process.env.MENU_ICON_OUTPUT || '../artifacts/menu-performance/icons')
    await mkdir(output, { recursive: true })
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    const requests = new Map<string, { url: string; bytes?: number }>()
    const network = new Map<string, { type: string; bytes?: number }>()
    cdp.on('Network.requestWillBeSent', event => {
      if (!/^https?:/.test(event.request.url)) return
      network.set(event.requestId, { type: event.type || 'Other' })
      const url = new URL(event.request.url)
      if (/(cart-basket-bold|clock|courier|restaurant)[-.].*\.(png|webp)$/.test(url.pathname))
        requests.set(event.requestId, { url: url.pathname })
    })
    cdp.on('Network.loadingFinished', event => {
      const request = requests.get(event.requestId)
      if (request) request.bytes = event.encodedDataLength
      const all = network.get(event.requestId)
      if (all) all.bytes = event.encodedDataLength
    })
    // Keep fixture availability deterministic without changing database settings.
    await page.clock.setFixedTime(new Date('2026-11-16T07:00:00Z'))
    await page.route('**/client/storefront/v1/bootstrap?*', async route => {
      const response = await route.fetch()
      const body = await response.json()
      for (const branch of [...body.branches, body.selected_branch]) {
        if (branch?.slug !== 'e2e' || !branch.branch_info) continue
        Object.assign(branch.branch_info, { intake: { mode: 'active' }, special_hours: {},
          working_hours: Object.fromEntries(['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
            .map(day => [day, { enabled: true, open: '09:00', close: '23:00' }])) })
      }
      await route.fulfill({ response, json: body })
    })
    if (mode === 'delivery') await mockDeliveryAddressSuggestion(page)
    await page.goto('/e2e')
    await page.getByRole('button', { name: '590 ₽', exact: true }).click()
    if (mode === 'pickup') {
      await page.getByText('Заберу самостоятельно').click()
      await selectPickupLocation(page)
    } else {
      await page.getByText('Указать адрес доставки').click()
      await selectDeliveryAddress(page)
      await page.getByRole('button', { name: 'Подтвердить адрес' }).click()
    }
    await page.getByRole('button', { name: '590 ₽', exact: true }).click()
    await page.screenshot({ path: `${output}/${mode}-cart.png` })
    await page.getByRole('button', { name: 'К оформлению заказа' }).click()
    const time = page.getByRole('button', { name: new RegExp(`^Время ${mode === 'pickup' ? 'самовывоза' : 'доставки'}:`) })
    await expect(time).toBeVisible()
    await time.click()
    await expect(page.getByRole('dialog').last()).toBeVisible()
    await page.screenshot({ path: `${output}/${mode}-checkout.png` })
    await expect.poll(() => [...requests.values()].filter(r => r.bytes).length).toBeGreaterThanOrEqual(1)
    const inlineIcons = await page.locator('[style*="data:image/webp"]').evaluateAll(elements =>
      elements.flatMap(element => [...(element.getAttribute('style') || '').matchAll(/data:image\/webp;base64,([A-Za-z0-9+/=]+)/g)]
        .map(match => ({ decodedBytes: atob(match[1]!).length, encodedCharacters: match[1]!.length }))))
    // Small WebP masks are inlined by Vite; they contribute to script transfer.
    if (requests.size < 3) {
      expect(inlineIcons).toHaveLength(2)
      expect(inlineIcons.every(icon => icon.decodedBytes > 0)).toBe(true)
    }
    const samples = [...requests.values()]
    await writeFile(`${output}/${mode}.json`, JSON.stringify({ mode, samples, inlineIcons,
      scenarioNetworkBytes: [...network.values()].reduce((sum, r) => sum + (r.bytes || 0), 0),
      scenarioScriptBytes: [...network.values()].filter(r => r.type === 'Script').reduce((sum, r) => sum + (r.bytes || 0), 0),
      totalBytes: samples.reduce((sum, r) => sum + (r.bytes || 0), 0) }, null, 2))
  })
}
