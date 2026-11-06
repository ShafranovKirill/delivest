import { expect, test, type Page } from '@playwright/test'

type Fulfillment = 'pickup' | 'delivery'

async function openMobileCheckout(page: Page, fulfillment: Fulfillment) {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: '590 ₽' }).click()

  if (fulfillment === 'pickup') {
    await page.getByText('Заберу самостоятельно').click()
  } else {
    await page.getByText('Указать адрес доставки').click()
    await page.getByLabel('Город, улица, дом').fill('Москва, Тверская, 7')
  }
  await page
    .getByRole('button', { name: fulfillment === 'pickup' ? 'Заказать сюда' : 'Подтвердить адрес' })
    .click()
  await page.getByRole('button', { name: '590 ₽' }).click()
  await page.getByRole('button', { name: 'К оформлению заказа' }).click()
  await expect(page).toHaveURL(/checkout/)
  await expect(page.getByRole('button', { name: 'Другое время' })).toBeVisible()
}

for (const fulfillment of ['pickup', 'delivery'] as const) {
  test(`mobile ${fulfillment} checkout keeps time chips scrollable and summary concise`, async ({
    page,
  }) => {
    await openMobileCheckout(page, fulfillment)

    const row = page.getByRole('button', { name: 'Другое время' }).locator('..')
    const firstChip = row.locator('button').first()
    const phoneInput = page.locator('input[name=phone]')
    const layout = await row.evaluate((element, input) => {
      const rowBox = element.getBoundingClientRect()
      const firstBox = element.querySelector('button')!.getBoundingClientRect()
      const inputBox = document.querySelector(input)!.getBoundingClientRect()
      const chips = Array.from(element.querySelectorAll('button'))
      return {
        scrollLeft: element.scrollLeft,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        rowLeft: rowBox.left,
        firstLeft: firstBox.left,
        firstRight: firstBox.right,
        inputLeft: inputBox.left,
        chipTops: chips.map((chip) => chip.getBoundingClientRect().top),
        pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
      }
    }, 'input[name=phone]')

    await expect(firstChip).toBeVisible()
    await expect(phoneInput).toBeVisible()
    expect(layout.scrollLeft).toBe(0)
    expect(layout.scrollWidth).toBeGreaterThan(layout.clientWidth)
    expect(layout.firstLeft).toBeGreaterThanOrEqual(layout.rowLeft - 1)
    expect(layout.firstRight).toBeLessThanOrEqual(layout.rowLeft + layout.clientWidth + 1)
    expect(Math.abs(layout.rowLeft - layout.inputLeft)).toBeLessThanOrEqual(1)
    expect(Math.max(...layout.chipTops) - Math.min(...layout.chipTops)).toBeLessThanOrEqual(1)
    expect(layout.pageOverflow).toBeLessThanOrEqual(1)

    await row.evaluate((element) => { element.scrollLeft = element.scrollWidth })
    await expect.poll(() => row.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0)
    await row.evaluate((element) => { element.scrollLeft = 0 })
    await expect.poll(() => row.evaluate((element) => element.scrollLeft)).toBe(0)
    await expect(firstChip).toBeInViewport()

    const compositionButton = page.getByRole('button', { name: '1 товар' })
    const summary = compositionButton.locator('..')
    await expect(compositionButton).toBeVisible()
    await expect(summary.locator('div.flex.justify-between', { hasText: '1 товар' })).toHaveCount(0)
    await expect(summary.getByText('Сумма заказа')).toBeVisible()
    if (fulfillment === 'delivery') await expect(summary.getByText('Доставка')).toBeVisible()

    await compositionButton.click()
    await expect(compositionButton).toHaveAttribute('aria-expanded', 'true')
    await expect(summary.getByText('Маргарита')).toBeVisible()
  })
}
