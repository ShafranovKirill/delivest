// First card click through to usable modal controls, with a cold browser cache.
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
const require = createRequire(new URL('../e2e/package.json', import.meta.url))
const { chromium } = require('@playwright/test')
const output = process.argv[2]
if (!output) throw new Error('Pass an output directory')
await mkdir(output, { recursive: true })
const browser = await chromium.launch()
const samples = []
try {
  for (let pass = 1; pass <= 5; pass++) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'ru-RU', serviceWorkers: 'block' })
    try {
      const page = await context.newPage()
      const cdp = await context.newCDPSession(page)
      await cdp.send('Network.enable')
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 80,
        downloadThroughput: 1_250_000, uploadThroughput: 250_000, connectionType: 'cellular4g' })
      await page.goto('http://localhost:3100/demo-center', { waitUntil: 'domcontentloaded' })
      const card = page.locator('[id^="category-"] [role="button"]').first()
      await card.waitFor({ state: 'visible' })
      await page.waitForTimeout(2500)
      const start = await page.evaluate(() => performance.now())
      await card.click()
      await page.getByRole('dialog').getByRole('button', { name: /В корзину за/ }).waitFor({ state: 'visible' })
      const controlsMs = Math.round(await page.evaluate(() => performance.now()) - start)
      const scripts = await page.evaluate(() => performance.getEntriesByType('resource')
        .filter(r => r.initiatorType === 'script').map(r => ({ url: new URL(r.name).pathname,
          bytes: r.transferSize, started: Math.round(r.startTime) })))
      samples.push({ pass, controlsMs, scripts })
      if (pass === 1) await page.screenshot({ path: `${output}/first-click.png` })
    } finally { await context.close() }
  }
} finally { await browser.close() }
const ordered = samples.map(s => s.controlsMs).sort((a, b) => a - b)
await writeFile(`${output}/modal.json`, JSON.stringify({ samples, medianControlsMs: ordered[2],
  configuration: { viewport: '390x844', dpr: 1, latencyMs: 80, downloadMbps: 10, uploadMbps: 2,
    settleBeforeClickMs: 2500, serviceWorkers: 'block' } }, null, 2))
console.log(JSON.stringify({ medianControlsMs: ordered[2], samples: ordered }))
