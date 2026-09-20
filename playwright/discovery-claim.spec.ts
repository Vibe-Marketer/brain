import { expect, test } from '@playwright/test'

const PRIVATE_PREVIEW = /board meeting|recording owner|transcript|summary|provider/i

function runtimeClaimToken(): string {
  return `${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`
}

test.describe('Phase 39 discovery claim journeys (Wave 0 RED)', () => {
  test.beforeEach(() => {
    test.fail(true, 'RED: Phase 39 routes and claim UI are implemented by Plans 13-14')
  })

  test('captures a claim from email, scrubs history, and offers signed-out continuation', async ({ page }) => {
    const token = runtimeClaimToken()
    await page.goto(`/claim-participation?token=${encodeURIComponent(token)}`)

    await expect(page).toHaveURL(/\/claim-participation$/)
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible()
    await expect(page.locator('body')).not.toContainText(PRIVATE_PREVIEW)
    expect(await page.evaluate(() => Object.keys(localStorage))).not.toContain('pendingParticipationClaim')
    expect(await page.evaluate(() => history.state)).not.toContain(token)
  })

  test('password authentication restores the clean claim route and completes at Events', async ({ page }) => {
    await page.goto(`/claim-participation?token=${encodeURIComponent(runtimeClaimToken())}`)
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByLabel('Email').fill('claim-user@callvault.test')
    await page.getByLabel('Password').fill('runtime-password-from-test-environment')
    await page.getByRole('button', { name: /Sign in/i }).click()

    await expect(page).toHaveURL(/\/events$/)
    await expect(page.getByRole('heading', { name: 'Events' })).toBeFocused()
  })

  test('signup and OAuth root return preserve the session-only pending claim', async ({ page }) => {
    await page.goto(`/claim-participation?token=${encodeURIComponent(runtimeClaimToken())}`)
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByRole('link', { name: /Create account/i }).click()
    await expect(page).toHaveURL(/\/login\?signup=true/)

    await page.goto('/')
    await expect(page).toHaveURL(/\/claim-participation$/)
    await expect(page.locator('body')).not.toContainText(PRIVATE_PREVIEW)
  })

  test('different primary account requires Add email or Use another account without preview', async ({ page }) => {
    await page.goto(`/claim-participation?token=${encodeURIComponent(runtimeClaimToken())}`)
    await expect(page.getByRole('button', { name: 'Add email and continue' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Use another account' })).toBeVisible()
    await expect(page.locator('body')).not.toContainText(PRIVATE_PREVIEW)
  })

  test('parallel and replayed consume attempts produce one winner and generic terminal copy', async ({ browser }) => {
    const context = await browser.newContext()
    const first = await context.newPage()
    const second = await context.newPage()
    const token = runtimeClaimToken()
    await Promise.all([
      first.goto(`/claim-participation?token=${encodeURIComponent(token)}`),
      second.goto(`/claim-participation?token=${encodeURIComponent(token)}`),
    ])

    await expect(first.getByRole('heading', { name: 'Events' })).toBeVisible()
    await expect(second.getByText(/This claim link is unavailable/i)).toBeVisible()
    await context.close()
  })
})
