#!/usr/bin/env node
// Repeatable mobile storefront measurements. Install e2e dependencies first.
import { createRequire } from 'node:module'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const require = createRequire(new URL('../e2e/package.json', import.meta.url))
const { chromium } = require('@playwright/test')
const argv = process.argv.slice(2)
const args = new Map()
for (let index = 0; index < argv.length; index++) {
  const token = argv[index]
  if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`)
  const equal = token.indexOf('=')
  const name = token.slice(2, equal < 0 ? undefined : equal)
  if (equal >= 0) args.set(name, token.slice(equal + 1))
  else if (name === 'capture') args.set(name, true)
  else {
    const value = argv[++index]
    if (!value || value.startsWith('--')) throw new Error(`Missing value for --${name}`)
    args.set(name, value)
  }
}
const legacyCli = argv.length === 0 || argv.some(value => /^--(?:url|api|runs|modes|settle-ms|output|label)=/.test(value)) ||
  ['api', 'runs', 'modes', 'settle-ms', 'label'].some(name => args.has(name))
const url = new URL(args.get('url') ?? (legacyCli ? 'http://localhost:3000/demo-center' : 'http://localhost:3100/e2e'))
if (!['http:', 'https:'].includes(url.protocol)) throw new Error('URL must be HTTP(S)')
const apiOrigin = new URL(args.get('api') ?? (legacyCli ? 'http://localhost:4000' : 'http://localhost:4100')).origin
const outputArg = args.get('output') ?? (legacyCli ? 'docs/tasks/storefront-performance/measurement.json' : 'artifacts/storefront')
const outputFile = resolve(outputArg.endsWith('.json') ? outputArg : `${outputArg}/browser.json`)
const output = resolve(outputArg.endsWith('.json') ? `${outputArg.slice(0, -5)}-captures` : outputArg)
const passes = Number(args.get('passes') ?? args.get('runs') ?? (legacyCli ? '7' : '5'))
if (!Number.isInteger(passes) || passes < 1 || passes > 100) throw new Error('runs/passes must be 1..100')
const modes = (args.get('modes') ?? 'cold-browser,warm-reload').split(',')
if (!modes.length || modes.some(mode => !['cold-browser', 'warm-reload'].includes(mode)) ||
    new Set(modes).size !== modes.length) throw new Error('Invalid --modes')
const settleMs = Number(args.get('settle-ms') ?? '2500')
if (!Number.isFinite(settleMs) || settleMs < 0 || settleMs > 120_000) throw new Error('Invalid --settle-ms')
const capture = args.has('capture')
const dpr = Number(args.get('dpr') ?? '1')
if (![1, 2, 3].includes(dpr)) throw new Error('--dpr must be 1, 2 or 3')
const priorityPhoto = args.get('priority-photo') ?? null
if (capture && url.search) throw new Error('--capture requires a URL without query parameters')
const safeUrl = value => {
  try { const parsed = new URL(value); return parsed.origin + parsed.pathname } catch { return null }
}
const samples = []
await mkdir(output, { recursive: true })
await mkdir(resolve(outputFile, '..'), { recursive: true })
const browser = await chromium.launch({ headless: true })
try {
  for (let pass = 1; pass <= passes; pass++) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: dpr,
      ...(capture ? { recordVideo: { dir: `${output}/videos`, size: { width: 390, height: 844 } } } : {}),
      isMobile: true, hasTouch: true, locale: 'ru-RU', serviceWorkers: 'block' })
    const page = await context.newPage()
    if (priorityPhoto) await page.addInitScript(prefix => {
      // Measurement-only A/B: set priority before the selected image's source.
      const setAttribute = Element.prototype.setAttribute
      Element.prototype.setAttribute = function (name, value) {
        if (this instanceof HTMLImageElement && ['src', 'srcset'].includes(name) && String(value).includes(prefix))
          setAttribute.call(this, 'fetchpriority', 'high')
        return setAttribute.call(this, name, value)
      }
      for (const name of ['src', 'srcset']) {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, name)
        Object.defineProperty(HTMLImageElement.prototype, name, { ...descriptor, set(value) {
          if (String(value).includes(prefix)) setAttribute.call(this, 'fetchpriority', 'high')
          descriptor.set.call(this, value)
        } })
      }
    }, priorityPhoto)
    await page.addInitScript(() => {
      window.__storefrontVitals = { lcp: null, cls: null, firstPhoto: null }
      try {
        new PerformanceObserver(list => {
          const e = list.getEntries().at(-1)
          if (e) window.__storefrontVitals.lcp = { time: Math.round(e.startTime), tag: e.element?.tagName ?? null,
            url: e.url ? new URL(e.url, location.href).origin + new URL(e.url, location.href).pathname : null }
        }).observe({ type: 'largest-contentful-paint', buffered: true })
        window.__storefrontVitals.cls = 0
        let windowStart = 0, lastShift = 0, windowScore = 0
        new PerformanceObserver(list => {
          for (const e of list.getEntries()) {
            if (e.hadRecentInput) continue
            if (!lastShift || e.startTime - lastShift > 1000 || e.startTime - windowStart > 5000) {
              windowStart = e.startTime
              windowScore = 0
            }
            windowScore += e.value
            lastShift = e.startTime
            window.__storefrontVitals.cls = Math.max(window.__storefrontVitals.cls, windowScore)
          }
        }).observe({ type: 'layout-shift', buffered: true })
      } catch { /* unsupported observers are reported as null below */ }
      let checking = false
      const decoding = new WeakSet()
      const decoded = new WeakSet()
      const marking = new WeakSet()
      function checkPhoto() {
        checking = false
        if (window.__storefrontVitals.firstPhoto) return
        const images = document.querySelectorAll('[id^="category-"] [role="button"] img')
        for (const img of images) {
          const src = img.currentSrc || img.src
          const card = img.closest('[role="button"]')
          if (!card || !img.alt || img.alt !== card.getAttribute('aria-label')) continue
          const rect = img.getBoundingClientRect()
          if (!src || src.includes('/placeholder/') || !img.complete || img.naturalWidth === 0 ||
              rect.width <= 0 || rect.height <= 0 || rect.bottom <= 0 || rect.top >= innerHeight ||
              rect.right <= 0 || rect.left >= innerWidth) continue
          if (!decoded.has(img) && !decoding.has(img)) {
            decoding.add(img)
            img.decode().then(() => { decoded.add(img); schedule() }).catch(() => {})
          }
          if (decoded.has(img) && getComputedStyle(img).opacity !== '0' && !marking.has(img)) {
            // Wait for paint after decode and the opacity transition has begun.
            marking.add(img)
            requestAnimationFrame(() => requestAnimationFrame(() => {
              if (window.__storefrontVitals.firstPhoto || !img.isConnected || getComputedStyle(img).opacity === '0') return
              const box = img.getBoundingClientRect()
              if (box.bottom > 0 && box.top < innerHeight && box.right > 0 && box.left < innerWidth)
                window.__storefrontVitals.firstPhoto = { time: Math.round(performance.now()),
                  url: new URL(img.currentSrc || img.src, location.href).origin + new URL(img.currentSrc || img.src, location.href).pathname }
            }))
          }
        }
        // Keep checking through the product image's CSS opacity transition.
        schedule()
      }
      function schedule() { if (!checking && !window.__storefrontVitals.firstPhoto) { checking = true; requestAnimationFrame(checkPhoto) } }
      new MutationObserver(schedule).observe(document, { subtree: true, childList: true, attributes: true,
        attributeFilter: ['src', 'class', 'style'] })
      document.addEventListener('load', schedule, true)
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule, { once: true })
      else schedule()
    })
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 80,
      downloadThroughput: 1_250_000, uploadThroughput: 250_000, connectionType: 'cellular4g' })
    let current
    cdp.on('Network.requestWillBeSent', e => {
      if (!current || !/^https?:/.test(e.request.url)) return
      current.requests.set(e.requestId, { url: safeUrl(e.request.url), method: e.request.method,
        type: e.type, started: e.wallTime * 1000, stage: e.initiator.type,
        initialPriority: e.request.initialPriority })
    })
    cdp.on('Network.resourceChangedPriority', e => {
      const req = current?.requests.get(e.requestId)
      if (req) req.finalPriority = e.newPriority
    })
    cdp.on('Network.requestServedFromCache', e => {
      const req = current?.requests.get(e.requestId)
      if (req) req.servedFromCache = true
    })
    cdp.on('Network.responseReceived', e => {
      const req = current?.requests.get(e.requestId)
      if (!req) return
      const headers = Object.fromEntries(Object.entries(e.response.headers).map(([k, v]) => [k.toLowerCase(), v]))
      Object.assign(req, { type: e.type, status: e.response.status, disk: e.response.fromDiskCache,
        worker: e.response.fromServiceWorker, mime: e.response.mimeType,
        cacheControl: headers['cache-control'], declaredBytes: headers['content-length'],
        encoding: headers['content-encoding'], etag: Boolean(headers.etag) })
    })
    cdp.on('Network.responseReceivedExtraInfo', e => {
      const req = current?.requests.get(e.requestId)
      if (req) req.networkStatus = e.statusCode
    })
    cdp.on('Network.loadingFinished', e => {
      const req = current?.requests.get(e.requestId)
      if (req) Object.assign(req, { bytes: e.encodedDataLength, done: true })
    })
    cdp.on('Network.loadingFailed', e => {
      const req = current?.requests.get(e.requestId)
      if (req) req.failed = true
    })
    cdp.on('Network.webSocketCreated', e => {
      if (current) current.sockets.set(e.requestId, { url: safeUrl(e.url), sentFrames: 0, receivedFrames: 0,
        sentPayloadBytes: 0, receivedPayloadBytes: 0 })
    })
    cdp.on('Network.webSocketHandshakeResponseReceived', e => {
      const socket = current?.sockets.get(e.requestId)
      if (socket) socket.status = e.response.status
    })
    if (modes[0] === 'warm-reload') await page.goto(url.href, { waitUntil: 'domcontentloaded' })
    for (const mode of modes) {
      const navigate = mode === 'cold-browser'
        ? () => page.goto(url.href, { waitUntil: 'domcontentloaded' })
        : () => page.reload({ waitUntil: 'domcontentloaded' })
      current = { requests: new Map(), sockets: new Map(), errors: 0 }
      const sampleState = current
      const onError = () => { sampleState.errors++ }
      page.on('pageerror', onError)
      const onSent = e => { const s = sampleState.sockets.get(e.requestId); if (s) { s.sentFrames++; s.sentPayloadBytes += Buffer.byteLength(e.response.payloadData || '') } }
      const onReceived = e => { const s = sampleState.sockets.get(e.requestId); if (s) { s.receivedFrames++; s.receivedPayloadBytes += Buffer.byteLength(e.response.payloadData || '') } }
      cdp.on('Network.webSocketFrameSent', onSent)
      cdp.on('Network.webSocketFrameReceived', onReceived)
      if (capture) await context.tracing.start({ screenshots: true, snapshots: true })
      const started = Date.now()
      try {
        await navigate()
        await page.locator('[id^="category-"] [role="button"]').first().waitFor({ state: 'visible', timeout: 30_000 })
        const menuVisible = Date.now()
        await page.waitForTimeout(settleMs)
        const details = await page.evaluate(() => ({
          vitals: window.__storefrontVitals ?? null,
          navigation: performance.getEntriesByType('navigation').map(e => ({ ttfb: Math.round(e.responseStart),
            domContentLoaded: Math.round(e.domContentLoadedEventEnd), type: e.type })),
          categories: document.querySelectorAll('[id^="category-"]').length,
          products: document.querySelectorAll('[id^="category-"] [role="button"]').length,
          productImages: [...document.querySelectorAll('[id^="category-"] [role="button"] img')].filter(img =>
            img.alt && img.alt === img.closest('[role="button"]')?.getAttribute('aria-label')
          ).map(img => ({ url: new URL(img.currentSrc || img.src, location.href).origin + new URL(img.currentSrc || img.src, location.href).pathname,
            top: Math.round(img.getBoundingClientRect().top), width: img.clientWidth,
            naturalWidth: img.naturalWidth, complete: img.complete })),
          visiblePhotoCandidates: [...document.querySelectorAll('[id^="category-"] [role="button"] img')].filter(img => {
            const b = img.getBoundingClientRect()
            return img.alt && img.alt === img.closest('[role="button"]')?.getAttribute('aria-label') &&
              !img.src.includes('/placeholder/') && b.bottom > 0 && b.top < innerHeight && b.width > 0
          }).length,
        }))
        const requests = [...sampleState.requests.values()]
        const summary = { totalBytes: 0, scriptBytes: 0, imageBytes: 0, scriptRequests: 0,
          imageRequests: 0, cacheHits: 0, status304: 0, failedRequests: 0 }
        for (const req of requests) {
          const bytes = req.bytes ?? 0
          summary.totalBytes += bytes
          if (req.type === 'Script') { summary.scriptBytes += bytes; summary.scriptRequests++ }
          if (req.type === 'Image') { summary.imageBytes += bytes; summary.imageRequests++ }
          if (req.servedFromCache || req.disk || req.worker) summary.cacheHits++
          if (req.networkStatus === 304 || req.status === 304) summary.status304++
          if (req.failed || (req.networkStatus ?? req.status ?? 0) >= 400 ||
              (!req.done && req.type !== 'WebSocket')) summary.failedRequests++
        }
        const sample = { pass, mode, started, menuVisible, ended: Date.now(),
          menuVisibleMs: menuVisible - started, requests, sockets: [...sampleState.sockets.values()],
          pageErrors: sampleState.errors, summary, ...details }
        samples.push(sample)
        if (capture) await page.screenshot({ path: `${output}/${pass}-${mode}.png`, fullPage: false })
        console.log(pass, mode, `card=${sample.menuVisibleMs}ms`,
          `photo=${sample.vitals?.firstPhoto?.time ?? 'missing'}`, `LCP=${sample.vitals?.lcp?.time ?? 'missing'}`)
      } finally {
        if (capture) await context.tracing.stop({ path: `${output}/${pass}-${mode}.zip` })
        page.off('pageerror', onError)
        cdp.off('Network.webSocketFrameSent', onSent)
        cdp.off('Network.webSocketFrameReceived', onReceived)
        current = null
      }
    }
    await context.close()
  }
} finally {
  await browser.close()
  // No query values, response bodies, or raw error messages are persisted.
  const median = values => {
    const present = values.filter(value => typeof value === 'number' && Number.isFinite(value)).sort((a, b) => a - b)
    if (!present.length) return null
    const middle = Math.floor(present.length / 2)
    return present.length % 2 ? present[middle] : (present[middle - 1] + present[middle]) / 2
  }
  const summary = Object.fromEntries(modes.map(mode => {
    const group = samples.filter(sample => sample.mode === mode)
    return [mode, {
      runs: group.length,
      cardMs: median(group.map(s => s.menuVisibleMs)),
      lcpMs: median(group.map(s => s.vitals?.lcp?.time)),
      firstPhotoMs: median(group.map(s => s.vitals?.firstPhoto?.time)),
      photoPresentRuns: group.filter(s => s.vitals?.firstPhoto).length,
      cls: median(group.map(s => s.vitals?.cls)),
      totalBytes: median(group.map(s => s.summary.totalBytes)),
      scriptBytes: median(group.map(s => s.summary.scriptBytes)),
      imageBytes: median(group.map(s => s.summary.imageBytes)),
      cacheHits: median(group.map(s => s.summary.cacheHits)),
      status304: median(group.map(s => s.summary.status304)),
      failedRequests: median(group.map(s => s.summary.failedRequests)),
      pageErrors: median(group.map(s => s.pageErrors)),
      // Historical fields used by the original storefront measurement consumers.
      samples: group.length,
      median_ms: median(group.map(s => s.menuVisibleMs)),
      p95_ms: group.map(s => s.menuVisibleMs).sort((a, b) => a - b)[Math.max(0, Math.ceil(group.length * 0.95) - 1)],
      min_ms: Math.min(...group.map(s => s.menuVisibleMs)),
      max_ms: Math.max(...group.map(s => s.menuVisibleMs)),
      api_requests: group.map(s => s.requests.filter(r => new URL(r.url).origin === apiOrigin && r.method !== 'OPTIONS').length),
      api_bytes: group.map(s => s.requests.filter(r => new URL(r.url).origin === apiOrigin && r.method !== 'OPTIONS')
        .reduce((total, r) => total + (r.bytes ?? 0), 0)),
    }]
  }))
  const results = samples.map(sample => {
    const api = sample.requests.filter(r => new URL(r.url).origin === apiOrigin && r.method !== 'OPTIONS')
    return { run: sample.pass, mode: sample.mode, menu_visible_ms: sample.menuVisibleMs,
      api_requests: api.length, api_bytes: api.reduce((total, r) => total + (r.bytes ?? 0), 0),
      all_http_requests: sample.requests.length, all_http_bytes: sample.summary.totalBytes,
      requests: sample.requests.map(r => {
        const parsed = new URL(r.url)
        return { ...r, origin: parsed.origin, path: parsed.pathname, start: r.started,
          api: parsed.origin === apiOrigin, from_cache: Boolean(r.servedFromCache || r.disk || r.worker),
          complete: Boolean(r.done) }
      }), errors: Array(sample.pageErrors).fill('page error') }
  })
  await writeFile(outputFile, JSON.stringify({
    label: args.get('label') ?? null, captured_at: new Date().toISOString(),
    url: safeUrl(url.href), apiOrigin, network: { down_mbps: 10, up_mbps: 2, cdp_latency_ms: 80 },
    viewport: { width: 390, height: 844 }, service_workers: 'blocked', settle_ms: settleMs,
    configuration: { url: safeUrl(url.href), passes, modes, viewport: '390x844', dpr, priorityPhoto,
      downloadMbps: 10, uploadMbps: 2, latencyMs: 80, serviceWorkers: 'block', settleMs },
    summary, samples, results,
  }, null, 2))
}
