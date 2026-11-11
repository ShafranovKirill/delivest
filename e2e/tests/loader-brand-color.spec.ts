import { expect, test } from '@playwright/test'
import { adminUrl, branchSlug } from '../support/env'

const apiOrigin = adminUrl

for (const cached of [false, true])
  for (const mode of ['light', 'dark'] as const) {
    test(`first visible scooter uses SSI ${mode} color with ${cached ? 'stale cache' : 'cold cache'}`, async ({
      page,
      request,
    }) => {
      const seoResponse = await request.get(`${apiOrigin}/seo/head`)
      expect(seoResponse.ok()).toBeTruthy()
      const seoHead = await seoResponse.text()
      const color = seoHead.match(
        /<meta name="theme-color" content="(#[0-9a-fA-F]{6})">/,
      )?.[1]
      expect(color).toBeTruthy()
      const darkColor =
        seoHead.match(
          /<meta name="delivest-brand-color-dark" content="(#[0-9a-fA-F]{6})">/,
        )?.[1] ?? color

      await page.addInitScript(
        ({ hasCache, theme }) => {
          localStorage.setItem('delivest-theme', theme)
          if (hasCache) {
            localStorage.setItem(
              'franchise',
              JSON.stringify({
                franchise: {
                  primary_color: '#abcdef',
                  dark_primary_color: '#fedcba',
                },
              }),
            )
          } else {
            localStorage.removeItem('franchise')
          }
        },
        { hasCache: cached, theme: mode },
      )

      let release!: () => void
      const gate = new Promise<void>((resolve) => (release = resolve))
      await page.route('**/client/franchise', async (route) => {
        await gate
        await route.continue()
      })
      await page.route('**/*', async (route) => {
        if (route.request().isNavigationRequest()) {
          const response = await route.fetch()
          const html = (await response.text()).replace(
            '<!--# include virtual="/__seo/head" -->',
            seoHead,
          )
          await route.fulfill({ response, body: html })
        } else {
          await route.fallback()
        }
      })

      await page.goto(`/${branchSlug}`, { waitUntil: 'domcontentloaded' })
      const scooter = page.locator('.boot-scooter')
      await expect(scooter).toBeVisible()
      const visibleColor = await scooter.evaluate(
        (element) => getComputedStyle(element).color,
      )
      const hex = mode === 'dark' ? darkColor! : color!
      const rgb = `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`
      expect(visibleColor).toBe(rgb)
      release()
      await expect(scooter).toHaveCount(0)
    })
  }

test('without SSI, stale scooter stays hidden while the API is pending', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'franchise',
      JSON.stringify({ franchise: { primary_color: '#abcdef' } }),
    )
  })
  let release!: () => void
  const gate = new Promise<void>((resolve) => (release = resolve))
  await page.route('**/client/franchise', async (route) => {
    await gate
    await route.continue()
  })
  await page.goto(`/${branchSlug}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('.boot-scooter')).toBeHidden()
  await expect(page.locator('.boot')).toBeVisible()
  await expect(page.locator('.boot-road')).toBeVisible()
  release()
  await expect(page.locator('.boot')).toHaveCount(0)
})

test('rejects an unsafe cached color before the API responds', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'franchise',
      JSON.stringify({
        franchise: { primary_color: '#abcdef; background: red' },
      }),
    )
  })
  let release!: () => void
  const gate = new Promise<void>((resolve) => (release = resolve))
  await page.route('**/client/franchise', async (route) => {
    await gate
    await route.continue()
  })
  await page.goto(`/${branchSlug}`, { waitUntil: 'domcontentloaded' })
  expect(
    await page
      .locator('html')
      .evaluate((html) => html.style.getPropertyValue('--boot-color-light')),
  ).toBe('')
  await expect(page.locator('.boot-scooter')).toBeHidden()
  release()
  await expect(page.locator('.boot')).toHaveCount(0)
})

test('switching branches keeps franchise colors and changing theme selects its dark color', async ({
  page,
}) => {
  await page.goto(`/${branchSlug}`)
  await expect(page.locator('.boot')).toHaveCount(0)
  const lightColor = await page
    .locator('html')
    .evaluate((html) => html.style.getPropertyValue('--boot-color-light'))
  const darkColor = await page
    .locator('html')
    .evaluate((html) => html.style.getPropertyValue('--boot-color-dark'))
  expect(lightColor).toMatch(/^#[0-9a-fA-F]{6}$/)
  expect(darkColor).toMatch(/^#[0-9a-fA-F]{6}$/)

  const secondBranchId = '00000000-0000-4000-8000-000000000003'
  let secondBranch: Record<string, unknown> | undefined
  await page.route('**/client/branches', async (route) => {
    const response = await route.fetch()
    const body = await response.json()
    secondBranch = {
      ...body.data.find(
        (branch: { slug: string }) => branch.slug === branchSlug,
      ),
      id: secondBranchId,
      slug: 'e2e-second',
      name: 'E2E Second',
    }
    await route.fulfill({
      response,
      json: { data: [...body.data, secondBranch] },
    })
  })
  await page.route(
    `**/client/branches/${secondBranchId}/select`,
    async (route) => {
      await route.fulfill({ json: { data: secondBranch } })
    },
  )

  await page.getByRole('button', { name: 'E2E', exact: true }).first().click()
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /E2E Second/ })
    .click()
  await expect(page).toHaveURL(/\/e2e-second\/?$/)
  await expect(page.locator('html')).toHaveCSS('--boot-color-light', lightColor)
  await expect(page.locator('html')).toHaveCSS('--boot-color-dark', darkColor)

  await page.evaluate(() => localStorage.setItem('delivest-theme', 'dark'))
  await page.goto(`/${branchSlug}`)
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.locator('html')).toHaveCSS('--boot-color-dark', darkColor)
  await page.unrouteAll({ behavior: 'wait' })
})
