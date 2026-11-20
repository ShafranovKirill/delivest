import { createRequire } from 'node:module'
import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'

const require = createRequire(new URL('../e2e/package.json', import.meta.url))
const { chromium } = require('@playwright/test')
const args = Object.fromEntries(process.argv.slice(2).map(value => {
  const [name, ...rest] = value.split('=')
  return [name.replace(/^--/, ''), rest.join('=')]
}))
const url = new URL(args.url ?? 'http://localhost:3000/demo-center')
const api = new URL(args.api ?? 'http://localhost:4000')
for (const address of [url, api]) {
  if (address.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(address.hostname) ||
      address.username || address.password) throw new Error('Local HTTP benchmark only')
}
const durationMs = Number(args['duration-ms'] ?? 61_000)
if (!Number.isInteger(durationMs) || durationMs < 1_000 || durationMs > 300_000) {
  throw new Error('duration-ms must be 1000..300000')
}
const pid = args.pid === undefined ? undefined : Number(args.pid)
if (pid !== undefined && (!Number.isInteger(pid) || pid < 1)) throw new Error('Invalid --pid')
const ticks = pid === undefined ? undefined : Number(execFileSync('getconf', ['CLK_TCK'], { encoding: 'utf8' }).trim())
async function processStats() {
  if (pid === undefined) return undefined
  const stat = await readFile(`/proc/${pid}/stat`, 'utf8')
  const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
  const status = await readFile(`/proc/${pid}/status`, 'utf8')
  return {
    cpu_seconds: (Number(fields[11]) + Number(fields[12])) / ticks,
    rss_kib: Number(status.match(/^VmRSS:\s+(\d+)/m)?.[1] ?? 0),
  }
}

const requests = new Map()
const pageErrors = []
let phase = 'startup'
const browser = await chromium.launch({ headless: true })
try {
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
  page.on('pageerror', error => pageErrors.push(String(error)))
  cdp.on('Network.requestWillBeSent', event => {
    if (!event.request.url.startsWith('http')) return
    const address = new URL(event.request.url)
    if (address.origin !== api.origin) return
    requests.set(event.requestId, {
      phase, method: event.request.method, path: address.pathname + address.search,
      start: event.timestamp,
    })
  })
  cdp.on('Network.responseReceived', event => {
    const request = requests.get(event.requestId)
    if (request) request.status = event.response.status
  })
  cdp.on('Network.loadingFinished', event => {
    const request = requests.get(event.requestId)
    if (request) Object.assign(request, {
      duration_ms: Math.round((event.timestamp - request.start) * 1000),
      encoded_bytes: event.encodedDataLength, complete: true,
    })
  })
  cdp.on('Network.loadingFailed', event => {
    const request = requests.get(event.requestId)
    if (request) request.failed = event.errorText
  })

  await page.goto(url.href, { waitUntil: 'domcontentloaded' })
  await page.locator('[id^="category-"] [role="button"]').first()
    .waitFor({ state: 'visible', timeout: 30_000 })
  if (new URL(page.url()).pathname !== url.pathname) throw new Error('Menu redirected')
  await page.waitForTimeout(2500)
  const cpuBefore = await processStats()
  phase = 'idle'
  const idleStarted = performance.now()
  await page.waitForTimeout(durationMs)
  phase = 'done'
  const observedMs = Math.round(performance.now() - idleStarted)
  const cpuAfter = await processStats()
  const all = [...requests.values()].map(({ start, ...request }) => request)
  const startup = all.filter(request => request.phase === 'startup')
  const idle = all.filter(request => request.phase === 'idle')
  const failed = all.filter(request => request.failed || request.status >= 400 || !request.complete)
  const summarize = values => ({
    requests: values.length,
    get_requests: values.filter(request => request.method === 'GET').length,
    encoded_bytes: values.reduce((sum, request) => sum + (request.encoded_bytes ?? 0), 0),
  })
  const result = {
    label: args.label, captured_at: new Date().toISOString(), url: url.href,
    api_origin: api.origin, duration_ms: observedMs,
    network: { down_mbps: 10, up_mbps: 2, cdp_latency_ms: 80 },
    viewport: { width: 390, height: 844 }, service_workers: 'blocked', settle_ms: 2500,
    startup: summarize(startup), idle: summarize(idle),
    backend: pid === undefined ? undefined : {
      pid, cpu_seconds: cpuAfter.cpu_seconds - cpuBefore.cpu_seconds,
      rss_kib_before: cpuBefore.rss_kib, rss_kib_after: cpuAfter.rss_kib,
      cpu_tick_seconds: 1 / ticks,
    },
    requests: all, page_errors: pageErrors,
  }
  if (args.output) await writeFile(args.output, JSON.stringify(result, null, 2) + '\n')
  console.log(JSON.stringify({ output: args.output, startup: result.startup, idle: result.idle,
    backend: result.backend, page_errors: pageErrors.length, failed_requests: failed.length }, null, 2))
  if (failed.length || pageErrors.length) throw new Error(`Idle benchmark failed: ${failed.length} API requests, ${pageErrors.length} page errors`)
} finally {
  await browser.close()
}
