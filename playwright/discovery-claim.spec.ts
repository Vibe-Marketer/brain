import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test'

const PRIVATE_PREVIEW = /board meeting|private recording title|transcript|summary|provider/i
const TEST_USER_ID = 'ef054159-3a5a-49e3-9fd8-31fa5a180ee6'
const DEFAULT_EMAIL = 'claim-user@callvault.test'
const TEST_SUPABASE_URL = process.env.VITE_SUPABASE_URL

if (!TEST_SUPABASE_URL || !TEST_SUPABASE_URL.includes('swjzxiddcrtaqixsfaac')) {
  throw new Error('Discovery claim browser tests require the dedicated Phase 39 TEST project.')
}

const TEST_SUPABASE_ORIGIN = new URL(TEST_SUPABASE_URL).origin
const AUTH_STORAGE_KEY = `sb-${new URL(TEST_SUPABASE_URL).hostname.split('.')[0]}-auth-token`

interface ClaimScenario {
  confirmationRequired?: boolean
  confirmationSequence?: boolean[]
  inspectFailuresRemaining?: number
  terminal?: boolean
  consumed?: boolean
  discoveredEventCount?: number
}

interface RequestCounts {
  inspect: number
  consume: number
  confirmedConsume: number
}

function runtimeClaimToken(): string {
  return `${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '').slice(0, 11)}`
}

function testUser(email = DEFAULT_EMAIL) {
  return {
    id: TEST_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    email_confirmed_at: new Date().toISOString(),
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: {},
    identities: [{ id: TEST_USER_ID, identity_data: { email }, provider: 'email' }],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

function testSession(email = DEFAULT_EMAIL) {
  return {
    access_token: `browser-access-${email}`,
    refresh_token: `browser-refresh-${email}`,
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: testUser(email),
  }
}

async function fulfillJson(route: Route, body: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    },
    body: JSON.stringify(body),
  })
}

async function seedAuthenticatedSession(
  target: Page | BrowserContext,
  email = DEFAULT_EMAIL,
): Promise<void> {
  await target.addInitScript(
    ({ storageKey, session }) => localStorage.setItem(storageKey, JSON.stringify(session)),
    { storageKey: AUTH_STORAGE_KEY, session: testSession(email) },
  )
}

async function seedPendingClaim(
  target: Page | BrowserContext,
  token: string,
): Promise<void> {
  await target.addInitScript(
    ({ claimToken }) => sessionStorage.setItem('pendingParticipationClaim', claimToken),
    { claimToken: token },
  )
}

async function installBrowserBoundary(
  page: Page,
  scenario: ClaimScenario = {},
  counts: RequestCounts = { inspect: 0, consume: 0, confirmedConsume: 0 },
): Promise<RequestCounts> {
  let currentEmail = DEFAULT_EMAIL

  await page.route(`${TEST_SUPABASE_ORIGIN}/auth/v1/**`, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } })
      return
    }

    const pathname = new URL(route.request().url()).pathname
    if (pathname.endsWith('/logout')) {
      await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } })
      return
    }

    if (pathname.endsWith('/token') || pathname.endsWith('/signup')) {
      const body = route.request().postDataJSON() as { email?: string } | null
      currentEmail = body?.email ?? DEFAULT_EMAIL
      await fulfillJson(route, testSession(currentEmail))
      return
    }

    await fulfillJson(route, testUser(currentEmail))
  })

  await page.route(`${TEST_SUPABASE_ORIGIN}/functions/v1/participation-claim`, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } })
      return
    }

    const body = route.request().postDataJSON() as {
      mode?: string
      confirmEmailAttachment?: boolean
    }
    if (body.mode === 'inspect') {
      counts.inspect += 1
      if ((scenario.inspectFailuresRemaining ?? 0) > 0) {
        scenario.inspectFailuresRemaining = (scenario.inspectFailuresRemaining ?? 0) - 1
        await fulfillJson(route, { message: 'temporary transport failure' }, 503)
        return
      }
      if (scenario.terminal || scenario.consumed) {
        await fulfillJson(route, { status: 'unavailable' })
        return
      }
      const confirmationRequired = scenario.confirmationSequence?.shift()
        ?? scenario.confirmationRequired
        ?? false
      await fulfillJson(route, {
        maskedInvitedEmail: 'c***@callvault.test',
        confirmationRequired,
      })
      return
    }

    counts.consume += 1
    if (body.confirmEmailAttachment === true) counts.confirmedConsume += 1
    if (scenario.terminal || scenario.consumed) {
      await fulfillJson(route, { status: 'unavailable' })
      return
    }
    scenario.consumed = true
    await fulfillJson(route, {
      status: 'claimed',
      discoveredEventCount: scenario.discoveredEventCount ?? 1,
    })
  })

  await page.route(`${TEST_SUPABASE_ORIGIN}/rest/v1/**`, async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } })
      return
    }
    const pathname = new URL(route.request().url()).pathname
    if (pathname.endsWith('/rpc/sync_my_discovered_event_notifications')) {
      await fulfillJson(route, 0)
      return
    }
    if (pathname.endsWith('/rpc/list_my_discovered_events')) {
      await fulfillJson(route, [])
      return
    }
    if (pathname.endsWith('/rpc/get_user_role')) {
      await fulfillJson(route, 'FREE')
      return
    }
    if (pathname.endsWith('/user_profiles')) {
      await fulfillJson(route, { onboarding_completed: true })
      return
    }
    await fulfillJson(route, [])
  })

  return counts
}

async function expectTokenAbsent(page: Page, token: string): Promise<void> {
  const snapshot = await page.evaluate(() => ({
    href: window.location.href,
    historyState: window.history.state,
    localStorage: { ...window.localStorage },
    sessionStorage: { ...window.sessionStorage },
    body: document.body.textContent,
  }))
  expect(JSON.stringify(snapshot)).not.toContain(token)
}

async function completePasswordLogin(page: Page, email = DEFAULT_EMAIL): Promise<void> {
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill('runtime-password-from-test-environment')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}

test.describe('Phase 39 discovery claim journeys', () => {
  test('keeps Events protected while public claim entry stays generic and preview-free', async ({ page }) => {
    await installBrowserBoundary(page)
    await page.goto('/events')
    await expect(page).toHaveURL(/\/login$/)

    const token = runtimeClaimToken()
    await page.goto(`/claim-participation?token=${encodeURIComponent(token)}`)
    await expect(page).toHaveURL(/\/claim-participation$/)
    await expect(page.getByRole('heading', { name: 'Claim your participation' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue to CallVault' })).toBeVisible()
    await expect(page.locator('body')).not.toContainText(PRIVATE_PREVIEW)
    expect(await page.evaluate(() => Object.keys(localStorage))).not.toContain('pendingParticipationClaim')
    expect(JSON.stringify(await page.evaluate(() => history.state))).not.toContain(token)
  })

  test('password authentication restores, consumes once, scrubs history, and focuses Events', async ({ page }) => {
    const consoleLines: string[] = []
    page.on('console', (message) => consoleLines.push(message.text()))
    const counts = await installBrowserBoundary(page)
    const token = runtimeClaimToken()

    await page.goto(`/claim-participation?token=${encodeURIComponent(token)}`)
    await page.getByRole('button', { name: 'Continue to CallVault' }).click()
    await completePasswordLogin(page)

    await expect(page).toHaveURL(/\/events$/)
    await expect(page.getByRole('heading', { name: 'EVENTS', exact: true })).toBeFocused()
    expect(counts).toMatchObject({ inspect: 1, consume: 1, confirmedConsume: 0 })
    await expectTokenAbsent(page, token)
    expect(consoleLines.join('\n')).not.toContain(token)

    await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => null)
    expect(page.url()).not.toContain(token)
  })

  test('signup completion restores the clean claim and opens focused Events', async ({ page }) => {
    const counts = await installBrowserBoundary(page)
    const token = runtimeClaimToken()
    await page.goto(`/claim-participation?token=${encodeURIComponent(token)}`)
    await page.getByRole('button', { name: 'Continue to CallVault' }).click()
    await page.getByRole('button', { name: 'Sign up', exact: true }).click()
    await page.getByLabel('Email').fill('new-claim-user@callvault.test')
    await page.getByLabel('Password').fill('runtime-signup-password')
    await page.getByRole('button', { name: 'Create account', exact: true }).click()

    await expect(page).toHaveURL(/\/events$/)
    await expect(page.getByRole('heading', { name: 'EVENTS', exact: true })).toBeFocused()
    expect(counts.consume).toBe(1)
    await expectTokenAbsent(page, token)
  })

  test('OAuth/root return restores a session-only claim without exposing it', async ({ page }) => {
    const token = runtimeClaimToken()
    await seedAuthenticatedSession(page)
    await seedPendingClaim(page, token)
    const counts = await installBrowserBoundary(page)

    await page.goto('/')
    await expect(page).toHaveURL(/\/events$/)
    await expect(page.getByRole('heading', { name: 'EVENTS', exact: true })).toBeFocused()
    expect(counts).toMatchObject({ inspect: 1, consume: 1 })
    await expectTokenAbsent(page, token)
  })

  test('different-primary inspection is non-consuming until Add email and continue', async ({ page }) => {
    await seedAuthenticatedSession(page, 'different-primary@callvault.test')
    const counts = await installBrowserBoundary(page, { confirmationRequired: true })
    await page.goto(`/claim-participation?token=${encodeURIComponent(runtimeClaimToken())}`)

    await expect(page.getByRole('button', { name: 'Add email and continue' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Use another account' })).toBeVisible()
    await expect(page.locator('body')).not.toContainText(PRIVATE_PREVIEW)
    expect(counts.consume).toBe(0)

    await page.getByRole('button', { name: 'Add email and continue' }).click()
    await expect(page).toHaveURL(/\/events$/)
    expect(counts).toMatchObject({ inspect: 1, consume: 1, confirmedConsume: 1 })
  })

  test('Use another account preserves the unconsumed claim through replacement login', async ({ page }) => {
    const token = runtimeClaimToken()
    await seedAuthenticatedSession(page, 'different-primary@callvault.test')
    const counts = await installBrowserBoundary(page, {
      confirmationSequence: [true, false],
    })
    await page.goto(`/claim-participation?token=${encodeURIComponent(token)}`)
    await expect(page.getByRole('button', { name: 'Use another account' })).toBeVisible()

    await page.getByRole('button', { name: 'Use another account' }).click()
    await expect(page).toHaveURL(/\/login$/)
    expect(counts.consume).toBe(0)
    expect(await page.evaluate(() => sessionStorage.getItem('pendingParticipationClaim'))).toBe(token)

    await completePasswordLogin(page, 'intended-account@callvault.test')
    await expect(page).toHaveURL(/\/events$/)
    expect(counts.consume).toBe(1)
    await expectTokenAbsent(page, token)
  })

  test('retry keeps the session claim and succeeds without duplicate consume', async ({ page }) => {
    const token = runtimeClaimToken()
    await seedAuthenticatedSession(page)
    const counts = await installBrowserBoundary(page, { inspectFailuresRemaining: 1 })
    await page.goto(`/claim-participation?token=${encodeURIComponent(token)}`)

    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible()
    expect(await page.evaluate(() => sessionStorage.getItem('pendingParticipationClaim'))).toBe(token)
    await page.getByRole('button', { name: 'Try again' }).click()

    await expect(page).toHaveURL(/\/events$/)
    expect(counts).toMatchObject({ inspect: 2, consume: 1 })
    await expectTokenAbsent(page, token)
  })

  test('terminal, parallel, and replay attempts reveal only generic unavailable state', async ({ browser }) => {
    const context = await browser.newContext()
    const token = runtimeClaimToken()
    await seedAuthenticatedSession(context)
    const sharedScenario: ClaimScenario = {}
    const sharedCounts: RequestCounts = { inspect: 0, consume: 0, confirmedConsume: 0 }
    const first = await context.newPage()
    const second = await context.newPage()
    await installBrowserBoundary(first, sharedScenario, sharedCounts)
    await installBrowserBoundary(second, sharedScenario, sharedCounts)

    await Promise.all([
      first.goto(`/claim-participation?token=${encodeURIComponent(token)}`),
      second.goto(`/claim-participation?token=${encodeURIComponent(token)}`),
    ])

    await expect.poll(() => [new URL(first.url()).pathname, new URL(second.url()).pathname].sort())
      .toEqual(['/claim-participation', '/events'])
    const losingPage = first.url().endsWith('/claim-participation') ? first : second
    await expect(losingPage.getByRole('heading', { name: /This claim link is no longer available/i })).toBeVisible()
    await expect(losingPage.locator('body')).not.toContainText(PRIVATE_PREVIEW)
    expect(sharedCounts.consume).toBe(2)

    const replay = await context.newPage()
    await installBrowserBoundary(replay, sharedScenario, sharedCounts)
    await replay.goto(`/claim-participation?token=${encodeURIComponent(token)}`)
    await expect(replay.getByRole('heading', { name: /This claim link is no longer available/i })).toBeVisible()
    await expectTokenAbsent(replay, token)

    const terminal = await context.newPage()
    await installBrowserBoundary(terminal, { terminal: true })
    await terminal.goto(`/claim-participation?token=${encodeURIComponent(runtimeClaimToken())}`)
    await expect(terminal.getByRole('heading', { name: /This claim link is no longer available/i })).toBeVisible()
    await context.close()
  })

  test('desktop navigation places active Events immediately after Calls', async ({ page }) => {
    await seedAuthenticatedSession(page)
    await installBrowserBoundary(page)
    await page.goto('/events')

    const navigation = page.getByRole('navigation', { name: 'App navigation' })
    const labels = await navigation.getByRole('listitem').allTextContents()
    expect(labels.slice(0, 3).map((label) => label.replace(/\s+/gu, ' ').trim())).toEqual([
      'CONTROL CENTER Your workspace at a glance',
      'CALLS Your call library',
      'EVENTS Meetings connected to you',
    ])
    await expect(navigation.getByRole('button', { name: /EVENTS Meetings connected to you/ }))
      .toHaveAttribute('aria-current', 'page')
    await page.screenshot({ path: 'test-results/phase39-14-events-desktop.png', fullPage: true })
  })

  test('mobile Events navigation stays ordered, active, and at least 44px tall', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await seedAuthenticatedSession(page)
    await installBrowserBoundary(page)
    await page.goto('/events')

    const navigation = page.getByRole('navigation', { name: 'Mobile primary navigation' })
    const buttons = navigation.getByRole('button')
    await expect(buttons).toHaveCount(6)
    await expect(buttons.nth(0)).toHaveAccessibleName('Go to Calls')
    await expect(buttons.nth(1)).toHaveAccessibleName('Go to Events')
    await expect(buttons.nth(1)).toHaveAttribute('aria-current', 'page')
    expect((await buttons.nth(1).boundingBox())?.height).toBeGreaterThanOrEqual(44)
    await page.screenshot({ path: 'test-results/phase39-14-events-mobile.png', fullPage: true })
  })
})
