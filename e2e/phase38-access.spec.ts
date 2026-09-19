import { expect, test, type Page, type Response } from '@playwright/test'

const fixture = {
  recordingId: process.env.PHASE38_RECORDING_ID ?? '',
  requestId: process.env.PHASE38_ACCESS_REQUEST_ID ?? '',
  publicRecordingId: process.env.PHASE38_PUBLIC_RECORDING_ID ?? '',
  privateRecordingId: process.env.PHASE38_PRIVATE_RECORDING_ID ?? '',
  eligibleUnknownEventRecordingId: process.env.PHASE38_ELIGIBLE_UNKNOWN_RECORDING_ID ?? '',
  eligibleNonWebinar49RecordingId: process.env.PHASE38_NON_WEBINAR_49_RECORDING_ID ?? '',
  cappedNonWebinar50RecordingId: process.env.PHASE38_NON_WEBINAR_50_RECORDING_ID ?? '',
  webinarWinsRecordingId: process.env.PHASE38_WEBINAR_WINS_RECORDING_ID ?? '',
}

const REQUIRED_NOTICE = 'This controls your recording only. Other attendees control their own copies.'
const FORBIDDEN_DISCOVERY_KEYS = [
  'owner_user_id', 'owner_email', 'provider', 'source_app', 'source_call_id',
  'title', 'summary', 'full_transcript', 'transcript', 'thumbnail_url', 'share_url',
  'duration', 'organization_id', 'workspace_id', 'event_id', 'recording_id',
] as const

function requireFixtures(...values: string[]) {
  test.skip(values.some((value) => !value), 'Phase 38 seeded browser fixture IDs are required')
}

async function openAccessPanel(page: Page, recordingId = fixture.recordingId) {
  await page.goto(`/call/${recordingId}`)
  await page.getByRole('button', { name: 'ACCESS' }).click()
  await expect(page.getByRole('heading', { name: 'Recording access' })).toBeVisible()
  await expect(page.getByText(REQUIRED_NOTICE)).toBeVisible()
}

function collectDiscoveryResponses(page: Page): Promise<Record<string, unknown>[]> {
  const payloads: Record<string, unknown>[] = []
  page.on('response', async (response: Response) => {
    if (!/discover|event[_-]?copies|recording-access/i.test(response.url())) return
    const contentType = response.headers()['content-type'] ?? ''
    if (!contentType.includes('application/json')) return
    try {
      const body = await response.json()
      if (body && typeof body === 'object') payloads.push(body as Record<string, unknown>)
    } catch {
      // Non-JSON failures are asserted through the UI state.
    }
  })
  return payloads
}

function flattenKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(flattenKeys)
  if (!value || typeof value !== 'object') return []
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, nested]) => [key, ...flattenKeys(nested)])
}

async function assertNoAnonymousDisclosure(
  page: Page,
  payloads: Record<string, unknown>[],
  consoleMessages: string[],
) {
  const responseKeys = payloads.flatMap(flattenKeys).map((key) => key.toLowerCase())
  for (const forbidden of FORBIDDEN_DISCOVERY_KEYS) {
    expect(responseKeys, `network response leaked ${forbidden}`).not.toContain(forbidden)
  }

  const discovery = page.getByRole('region', { name: 'Other recordings from this meeting' })
  const serializedDom = (await discovery.evaluate((node) => node.outerHTML)).toLowerCase()
  for (const forbidden of FORBIDDEN_DISCOVERY_KEYS) {
    expect(serializedDom, `rendered DOM leaked ${forbidden}`).not.toContain(forbidden)
  }
  expect(serializedDom).not.toContain(fixture.recordingId.toLowerCase())
  expect(consoleMessages.join('\n')).not.toMatch(/owner_user_id|source_call_id|full_transcript|recording_id/i)
}

test.describe('Phase 38 desktop project state', () => {
  test.use({ viewport: { width: 1440, height: 1000 } })

  test('Settings default uses one keyboard radio group and confirms Public', async ({ page }) => {
    await page.goto('/settings/privacy-access')
    await expect(page.getByRole('heading', { name: 'Privacy & Access' })).toBeVisible()
    await expect(page.getByText('Defaults for new recordings')).toBeVisible()
    await expect(page.getByText('Default access for new recordings')).toBeVisible()
    await expect(page.getByText("New recordings use this access level. Changing it won't update recordings you already have.")).toBeVisible()

    const group = page.getByRole('radiogroup', { name: 'Default access for new recordings' })
    const privateOption = group.getByRole('radio', { name: /^Private/ })
    await privateOption.focus()
    await page.keyboard.press('ArrowDown')
    await expect(group.getByRole('radio', { name: /^Attendees/ })).toBeChecked()

    const publicOption = group.getByRole('radio', { name: /^Public/ })
    await publicOption.click()
    const confirmation = page.getByRole('alertdialog')
    await expect(confirmation.getByText('Make new recordings public by default?')).toBeVisible()
    await expect(confirmation.getByRole('button', { name: 'Use Public by default' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(confirmation).toBeHidden()
    await expect(publicOption).toBeFocused()
  })

  test('owner access opens as a 400px anchored popover and keeps notice in loading/error states', async ({ page }) => {
    requireFixtures(fixture.recordingId)
    await page.route(/get_recording_access_(policy|management)/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 250))
      await route.abort('failed')
    })
    await page.goto(`/call/${fixture.recordingId}`)
    const accessButton = page.getByRole('button', { name: 'ACCESS' })
    await accessButton.click()
    const panel = page.getByRole('dialog', { name: 'Recording access' })
    await expect(panel).toBeVisible()
    await expect(panel.getByText(REQUIRED_NOTICE)).toBeVisible()
    await expect(panel.getByText("Couldn't load access settings. Close this panel and try again.")).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Retry' })).toBeVisible()
    const box = await panel.boundingBox()
    expect(box?.width).toBeGreaterThanOrEqual(390)
    expect(box?.width).toBeLessThanOrEqual(410)
    await page.keyboard.press('Escape')
    await expect(accessButton).toBeFocused()
  })

  test('inherited, Custom, Reset, and Public confirmation remain recording-scoped', async ({ page }) => {
    requireFixtures(fixture.recordingId)
    await openAccessPanel(page)
    await expect(page.getByText(/^Using default: /)).toBeVisible()
    await page.getByRole('radio', { name: /^Attendees/ }).click()
    await expect(page.getByText('Custom')).toBeVisible()
    await page.getByRole('button', { name: 'Reset to default' }).click()
    await expect(page.getByText(/^Using default: /)).toBeVisible()

    await page.getByRole('radio', { name: /^Public/ }).click()
    const confirmation = page.getByRole('alertdialog')
    await expect(confirmation.getByText('Make this recording public?')).toBeVisible()
    await expect(confirmation.getByText(/This affects this recording only\./)).toBeVisible()
    await expect(confirmation.getByRole('button', { name: 'Make public' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('radio', { name: /^Public/ })).toBeFocused()
  })

  test('owner reviews, approves, denies, observes cooldown, and revokes request-based access', async ({ page }) => {
    requireFixtures(fixture.recordingId, fixture.requestId)
    await openAccessPanel(page)
    const requests = page.getByRole('region', { name: /Access requests \(\d+\)/ })
    const grants = page.getByRole('region', { name: /People with access \(\d+\)/ })
    await expect(requests).toBeVisible()
    await expect(grants).toBeVisible()
    expect(await requests.evaluate((node) => Boolean(node.compareDocumentPosition(document.querySelector('[aria-label^="People with access"]')) & Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true)

    await requests.getByRole('button', { name: 'Review request' }).first().click()
    await expect(page.getByText('Verified participant evidence')).toBeVisible()
    await page.getByRole('button', { name: 'Approve access' }).click()
    await expect(page.getByText(/Access approved for /)).toBeVisible()

    await grants.getByRole('button', { name: 'Revoke access' }).first().click()
    const revoke = page.getByRole('alertdialog')
    await expect(revoke.getByText(/Revoke access for .+\?/)).toBeVisible()
    await expect(revoke.getByRole('button', { name: 'Revoke access' })).toHaveAttribute('data-variant', 'destructive')
    await revoke.getByRole('button', { name: 'Keep access' }).click()

    await requests.getByRole('button', { name: 'Review request' }).first().click()
    await page.getByRole('button', { name: 'Deny request' }).click()
    const deny = page.getByRole('alertdialog')
    await expect(deny.getByText('Deny this access request?')).toBeVisible()
    await expect(deny.getByRole('button', { name: 'Deny request' })).toHaveAttribute('data-variant', 'destructive')
    await deny.getByRole('button', { name: 'Deny request' }).click()
    await expect(page.getByText('Access request denied.')).toBeVisible()
    await expect(page.getByRole('button', { name: /Available / })).toBeDisabled()
  })

  test('notification/email deep link opens the call, panel, and focused request after auth return', async ({ page }) => {
    requireFixtures(fixture.recordingId, fixture.requestId)
    await page.goto(`/call/${fixture.recordingId}?accessRequest=${fixture.requestId}`)
    await expect(page).toHaveURL(new RegExp(`/call/${fixture.recordingId}\\?accessRequest=${fixture.requestId}`))
    await expect(page.getByRole('heading', { name: 'Recording access' })).toBeVisible()
    await expect(page.getByRole('heading', { name: /Review access request/i })).toBeFocused()
  })

  test('anonymous discovery response, DOM, and console contain no protected copy fields', async ({ page }) => {
    requireFixtures(fixture.eligibleUnknownEventRecordingId)
    const consoleMessages: string[] = []
    page.on('console', (message) => consoleMessages.push(message.text()))
    const payloads = collectDiscoveryResponses(page)
    await page.goto(`/call/${fixture.eligibleUnknownEventRecordingId}`)
    await expect(page.getByRole('heading', { name: 'Other recordings from this meeting' })).toBeVisible()
    await expect(page.getByText('Recording 1')).toBeVisible()
    await expect(page.getByText('Another recording from this meeting.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Request access to recording 1' })).toBeVisible()
    await assertNoAnonymousDisclosure(page, payloads, consoleMessages)
  })

  test('provider evidence and 49/50 boundaries are server-authoritative', async ({ page }) => {
    requireFixtures(
      fixture.eligibleUnknownEventRecordingId,
      fixture.eligibleNonWebinar49RecordingId,
      fixture.cappedNonWebinar50RecordingId,
      fixture.webinarWinsRecordingId,
    )
    for (const recordingId of [fixture.eligibleUnknownEventRecordingId, fixture.eligibleNonWebinar49RecordingId]) {
      await page.goto(`/call/${recordingId}`)
      await expect(page.getByRole('heading', { name: 'Other recordings from this meeting' })).toBeVisible()
    }
    for (const recordingId of [fixture.cappedNonWebinar50RecordingId, fixture.webinarWinsRecordingId]) {
      await page.goto(`/call/${recordingId}`)
      await expect(page.getByRole('heading', { name: 'Other recordings from this meeting' })).toHaveCount(0)
    }
  })

  test('public read succeeds only for Public and all default-deny outcomes use generic copy', async ({ page }) => {
    requireFixtures(fixture.publicRecordingId, fixture.privateRecordingId)
    await page.goto(`/public/${fixture.publicRecordingId}`)
    await expect(page.getByRole('main')).toContainText(/Transcript|Recording/)
    await expect(page.getByRole('main')).not.toContainText(/Owner|Provider|Source/)

    await page.goto(`/public/${fixture.privateRecordingId}`)
    await expect(page.getByText('This recording is not available.')).toBeVisible()
    await page.goto('/public/not-a-uuid')
    await expect(page.getByText('This recording is not available.')).toBeVisible()
  })
})

test.describe('Phase 38 mobile project state', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
  })

  test('uses one mobile Dialog tree, 44px actions, reduced motion, and no horizontal overflow', async ({ page }) => {
    requireFixtures(fixture.recordingId)
    await openAccessPanel(page)
    const dialog = page.getByRole('dialog', { name: 'Recording access' })
    await expect(dialog).toHaveCount(1)
    await expect(dialog.getByText(REQUIRED_NOTICE)).toBeVisible()
    for (const action of ['Reset to default', 'Approve access', 'Deny request', 'Revoke access']) {
      const control = dialog.getByRole('button', { name: action }).first()
      if (await control.count()) expect((await control.boundingBox())?.height).toBeGreaterThanOrEqual(44)
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
  })

  test('anonymous mobile rows stack a full-width 44px request action without leaking IDs', async ({ page }) => {
    requireFixtures(fixture.eligibleUnknownEventRecordingId)
    await page.goto(`/call/${fixture.eligibleUnknownEventRecordingId}`)
    const request = page.getByRole('button', { name: 'Request access to recording 1' })
    await expect(request).toBeVisible()
    const requestBox = await request.boundingBox()
    const viewport = page.viewportSize()
    expect(requestBox?.height).toBeGreaterThanOrEqual(44)
    expect(requestBox?.width).toBeGreaterThan((viewport?.width ?? 390) * 0.8)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
})
