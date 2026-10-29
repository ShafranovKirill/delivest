import { test as base, type Page } from '@playwright/test'
import { signIn } from './staff'

export const test = base.extend<{ staff: (login: string) => Promise<Page> }>({
  staff: async ({ browser }, use) => {
    const pages: Page[] = []

    await use(async (login) => {
      const page = await signIn(browser, login)
      pages.push(page)
      return page
    })

    await Promise.all(pages.map((page) => page.context().close()))
  },
})

export { expect } from '@playwright/test'
