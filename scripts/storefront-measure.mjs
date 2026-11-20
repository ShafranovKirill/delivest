import { createRequire } from 'node:module'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Uses the project's pinned browser runner, without running the E2E suite.
const require = createRequire(new URL('../e2e/package.json', import.meta.url))
const { chromium } = require('@playwright/test')
const root = fileURLToPath(new URL('..', import.meta.url))
const args = Object.fromEntries(process.argv.slice(2).map(value => {
  const [name, ...rest] = value.split('=')
  return [name.replace(/^--/, ''), rest.join('=')]
}))
const url = args.url ?? 'http://localhost:3000/demo-center'
const apiOrigin = args.api ?? 'http://localhost:4000'
const runs = Number(args.runs ?? 7)
const settleMs = Number(args['settle-ms'] ?? 2500)
const modes = args.modes?.split(',') ?? ['cold-browser', 'warm-reload']
if (!Number.isInteger(runs) || runs < 1 || runs > 100) throw new Error('runs must be 1..100')
if (!Number.isFinite(settleMs) || settleMs < 0 || settleMs > 120_000) throw new Error('Invalid settle-ms')
if (!modes.every(mode => ['cold-browser', 'warm-reload'].includes(mode))) throw new Error('Invalid modes')
const browser = await chromium.launch({ headless: true })
const results = []
try {
  for (let run = 1; run <= runs; run++) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 }, deviceScaleFactor: 1,
      locale: 'ru-RU', timezoneId: 'Europe/Moscow', serviceWorkers: 'block',
    })
    const page = await context.newPage()
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: 80, downloadThroughput: 1_250_000,
      uploadThroughput: 250_000, connectionType: 'cellular4g',
    })
    let requests = new Map()
    let errors = []
    page.on('pageerror', error => errors.push(String(error)))
    cdp.on('Network.requestWillBeSent', event => {
      if (!event.request.url.startsWith('http')) return
      const address = new URL(event.request.url)
      requests.set(event.requestId, {
        origin: address.origin, path: address.pathname + address.search,
        method: event.request.method, type: event.type,
        start: event.timestamp, api: address.origin === apiOrigin,
      })
    })
    cdp.on('Network.responseReceived', event => {
      const request = requests.get(event.requestId)
      if (request) Object.assign(request, {
        status: event.response.status, mime: event.response.mimeType,
        from_cache: Boolean(event.response.fromDiskCache || event.response.fromServiceWorker),
      })
    })
    cdp.on('Network.loadingFinished', event => {
      const request = requests.get(event.requestId)
      if (request) Object.assign(request, {
        bytes: event.encodedDataLength, duration_ms: (event.timestamp - request.start) * 1000,
        complete: true,
      })
    })
    cdp.on('Network.loadingFailed', event => {
      const request = requests.get(event.requestId)
      if (request) Object.assign(request, { failed: event.errorText })
    })
    for (const mode of modes) {
      requests = new Map()
      errors = []
      const start = performance.now()
      if (mode === 'cold-browser') await page.goto(url, { waitUntil: 'domcontentloaded' })
      else await page.reload({ waitUntil: 'domcontentloaded' })
      // Real product card, not a header button or a skeleton section.
      await page.locator('[id^="category-"] [role="button"]').first()
        .waitFor({ state: 'visible', timeout: 30_000 })
      const menu_visible_ms = performance.now() - start
      if (new URL(page.url()).pathname !== new URL(url).pathname) throw new Error('Menu redirected')
      // Same observation window in both revisions; no periodic 20s poll included.
      await page.waitForTimeout(settleMs)
      const all = [...requests.values()]
      const api = all.filter(request => request.api && request.method !== 'OPTIONS')
      const pending = api.filter(request => !request.complete)
      if (pending.length) throw new Error(`Incomplete API requests: ${JSON.stringify(pending)}`)
      if (api.some(request => request.status >= 400 || request.failed)) {
        throw new Error(`Failed API requests: ${JSON.stringify(api)}`)
      }
      if (errors.length) throw new Error(`Page errors: ${errors.join('; ')}`)
      results.push({
        run, mode, menu_visible_ms: Math.round(menu_visible_ms),
        api_requests: api.length, api_bytes: api.reduce((sum, request) => sum + (request.bytes ?? 0), 0),
        all_http_requests: all.length,
        all_http_bytes: all.reduce((sum, request) => sum + (request.bytes ?? 0), 0),
        requests: all, errors,
      })
    }
    await context.close()
  }
} finally {
  await browser.close()
}
const summary = {}
for (const mode of modes) {
  const samples = results.filter(result => result.mode === mode)
  const sorted = samples.map(sample => sample.menu_visible_ms).sort((a, b) => a - b)
  const percentile = p => sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)]
  summary[mode] = {
    samples: samples.length, median_ms: percentile(0.5), p95_ms: percentile(0.95),
    min_ms: sorted[0], max_ms: sorted.at(-1),
    api_requests: samples.map(sample => sample.api_requests),
    api_bytes: samples.map(sample => sample.api_bytes),
  }
}
const output = resolve(root, args.output ?? 'docs/tasks/storefront-performance/measurement.json')
await writeFile(output, JSON.stringify({
  label: args.label, captured_at: new Date().toISOString(), url, apiOrigin,
  network: { down_mbps: 10, up_mbps: 2, cdp_latency_ms: 80 },
  viewport: { width: 390, height: 844 }, service_workers: 'blocked', settle_ms: settleMs, summary, results,
}, null, 2) + '\n')
console.log(JSON.stringify({ output, summary }, null, 2))
