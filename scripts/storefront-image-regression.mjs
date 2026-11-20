import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(new URL('../e2e/package.json', import.meta.url))
const { chromium } = require('@playwright/test')
const url = process.argv[2] ?? 'http://localhost:3000/demo-center'
const target = new URL(url)
if (!['localhost', '127.0.0.1'].includes(target.hostname)) throw new Error('Local benchmark URL required')

const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, serviceWorkers: 'block',
  })
  const page = await context.newPage()
  const errors = []
  let configResponses = 0
  let validConfigResponses = 0
  page.on('pageerror', error => errors.push(String(error)))
  page.on('requestfailed', request => {
    errors.push(`${request.url()}: ${request.failure()?.errorText}`)
  })
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`)
    if (new URL(response.url()).pathname === '/env-config.js') {
      configResponses++
      if (response.status() === 200) {
        if (response.headers()['content-type']?.includes('javascript')) validConfigResponses++
        else errors.push('env-config.js is not JavaScript')
      }
    }
  })
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false, latency: 80, downloadThroughput: 1_250_000,
    uploadThroughput: 250_000, connectionType: 'cellular4g',
  })
  let photos = []
  page.on('request', request => {
    if (request.url().endsWith('.webp')) photos.push(request.url())
  })
  const settle = async () => {
    await page.locator('[id^="category-"] [role="button"]').first().waitFor({ state: 'visible' })
    await page.waitForTimeout(2500)
  }
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await settle()
  const cold = new Set(photos)
  photos = []
  await page.reload({ waitUntil: 'domcontentloaded' })
  await settle()
  const reload = new Set(photos)
  const extra = [...reload].filter(photo => !cold.has(photo))
  const far = await page.evaluate(() => [...document.querySelectorAll('[id^="category-"] [role="button"] span.relative.block.overflow-hidden')]
    .filter(img => img.getBoundingClientRect().top > innerHeight + 1250)
    .map(img => ({ top: Math.round(img.getBoundingClientRect().top), src: img.querySelector('img[loading="lazy"]')?.getAttribute('src') })))
  assert.ok(far.length > 0, 'Expected offscreen product photos in benchmark fixture')
  assert.ok(far.every(image => !image.src), 'Offscreen product photo received src')
  assert.equal(extra.length, 0, 'Reload requested new offscreen photos')

  await page.locator('[id^="category-"]').last().scrollIntoViewIfNeeded()
  await page.waitForFunction(() => {
    const visible = [...document.querySelectorAll('[id^="category-"] img[loading="lazy"]')]
      .filter(img => img.getBoundingClientRect().top < innerHeight && img.getBoundingClientRect().bottom > 0)
    return visible.length > 0 && visible.every(img => img.complete && img.naturalWidth > 0)
  })
  const scrolled = new Set(photos)
  assert.ok(scrolled.size > reload.size, 'Scrolling did not request more photos')
  const bottom = await page.evaluate(() => [...document.querySelectorAll('[id^="category-"] img[loading="lazy"]')]
    .filter(img => img.getBoundingClientRect().top < innerHeight && img.getBoundingClientRect().bottom > 0)
    .map(img => ({ src: img.getAttribute('src'), complete: img.complete, width: img.naturalWidth })))
  assert.ok(bottom.length > 0 && bottom.every(image => image.src && image.complete && image.width > 0), 'Visible product photos did not load')

  await page.locator('[id^="category-"] [role="button"]').first().click()
  const modalImage = page.locator('[role="dialog"] img[src$=".webp"]').first()
  await modalImage.waitFor({ state: 'visible' })
  await page.waitForFunction(img => img?.complete && img.naturalWidth > 0, await modalImage.elementHandle())
  const firstProductPhoto = await modalImage.getAttribute('src')

  await page.keyboard.press('Escape')
  await page.locator('[id^="category-"] [role="button"]').nth(1).click()
  await modalImage.waitFor({ state: 'visible' })
  await page.waitForFunction(img => img?.complete && img.naturalWidth > 0, await modalImage.elementHandle())
  const secondProductPhoto = await modalImage.getAttribute('src')
  assert.ok(secondProductPhoto && secondProductPhoto !== firstProductPhoto, 'Second product photo did not replace the first')

  await page.keyboard.press('Escape')
  await page.locator('section button').first().click()
  await page.waitForURL(current => current.searchParams.has('story'))
  const storyImage = page.locator('[role="dialog"] img[src$=".webp"]').last()
  await storyImage.waitFor({ state: 'visible' })
  await page.waitForFunction(img => img?.complete && img.naturalWidth > 0, await storyImage.elementHandle())
  assert.ok(configResponses > 0 && validConfigResponses > 0, 'Valid runtime env-config.js was not loaded')
  assert.deepEqual(errors, [], 'Page or HTTP request failed')

  const fallback = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' })
  await fallback.addInitScript(() => { globalThis.IntersectionObserver = undefined })
  const fallbackPage = await fallback.newPage()
  fallbackPage.on('pageerror', error => errors.push(String(error)))
  fallbackPage.on('requestfailed', request => {
    errors.push(`${request.url()}: ${request.failure()?.errorText}`)
  })
  fallbackPage.on('response', response => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`)
    if (new URL(response.url()).pathname === '/env-config.js') {
      configResponses++
      if (response.status() === 200) {
        if (response.headers()['content-type']?.includes('javascript')) validConfigResponses++
        else errors.push('env-config.js is not JavaScript')
      }
    }
  })
  await fallbackPage.goto(url, { waitUntil: 'domcontentloaded' })
  await fallbackPage.locator('[id^="category-"] [role="button"]').first().waitFor({ state: 'visible' })
  await fallbackPage.waitForFunction(() => {
    const visible = [...document.querySelectorAll('[id^="category-"] img[loading="lazy"]')]
      .filter(img => img.getBoundingClientRect().top < innerHeight && img.getBoundingClientRect().bottom > 0)
    return visible.length > 0 && visible.every(img => img.complete && img.naturalWidth > 0)
  })
  await fallback.close()
  assert.ok(configResponses > 1, 'Fallback did not request runtime env-config.js')
  assert.deepEqual(errors, [], 'Page or HTTP request failed')

  console.log(JSON.stringify({ cold: cold.size, reload: reload.size, extra: extra.length,
    farWithoutSource: far.length, afterScroll: scrolled.size, visibleBottomLoaded: bottom.filter(x => x.width > 0).length,
    productModalLoaded: true, secondProductPhotoLoaded: true, storyViewerLoaded: true,
    noIntersectionObserverFallbackLoaded: true, errors }, null, 2))
  await context.close()
} finally {
  await browser.close()
}
