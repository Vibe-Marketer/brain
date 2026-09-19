import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Locator, type Page, type Response } from '@playwright/test'

import {
  PHASE38_EVIDENCE_DIR,
  clearPhase38AccessLifecycle,
  configurePhase38DiscoveryScenario,
  readPhase38BrowserFixtures,
  refreshPhase38RequestId,
  resetPhase38PendingRequest,
  setPhase38AccountDefault,
  setPhase38RecordingPolicy,
} from './helpers/phase38-test-fixtures'

const fixture = await readPhase38BrowserFixtures()
const EMPTY_STATE = { cookies: [], origins: [] }
const REQUIRED_NOTICE = 'This controls your recording only. Other attendees control their own copies.'
const FORBIDDEN_DISCOVERY_KEYS = [
  'owner_user_id', 'owner_email', 'provider', 'source_app', 'source_call_id',
  'title', 'summary', 'full_transcript', 'transcript', 'thumbnail_url', 'share_url',
  'duration', 'organization_id', 'workspace_id',
] as const
const ALLOWED_DISCOVERY_KEYS = new Set([
  'event_id', 'has_other_copies', 'copy_ordinal', 'recording_id', 'request_status', 'cooldown_until',
])
const ACCESS_CHOICES = [
  { value: 'private', label: 'Private' },
  { value: 'attendees', label: 'Attendees' },
  { value: 'invitees', label: 'Invitees' },
  { value: 'organization', label: 'Organization' },
  { value: 'link', label: 'Anyone with link' },
  { value: 'public', label: 'Public' },
] as const

test.describe.configure({ mode: 'serial' })
async function assertAccessible(page: Page, label: string, selector: string): Promise<void> {
  const result = await new AxeBuilder({ page })
    .include(selector)
    .disableRules(['color-contrast'])
    .analyze()
  expect(result.violations, `${label} has serious accessibility violations`).toEqual([])
}

async function openAccessPanel(page: Page): Promise<void> {
  await page.goto(`/call/${fixture.ownerRecordingId}`)
  await page.getByRole('button', { name: 'ACCESS', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Recording access' })).toBeVisible()
  await expect(page.getByText(REQUIRED_NOTICE)).toBeVisible()
}

function getAccessDialog(page: Page): Locator {
  return page.getByRole('dialog').filter({
    has: page.getByRole('heading', { name: 'Recording access' }),
  })
}

function collectDiscoveryResponses(page: Page): Record<string, unknown>[] {
  const payloads: Record<string, unknown>[] = []
  page.on('response', async (response: Response) => {
    if (!/rest\/v1\/rpc\/(get_event_existence|list_discoverable)/i.test(response.url())) return
    if (!(response.headers()['content-type'] ?? '').includes('application/json')) return
    try {
      const body: unknown = await response.json()
      if (body && typeof body === 'object') payloads.push(body as Record<string, unknown>)
    } catch {
      // The visible state below remains the authoritative failure signal.
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

async function assertNoProtectedDiscoveryData(
  page: Page,
  payloads: Record<string, unknown>[],
): Promise<void> {
  const responseKeys = payloads.flatMap(flattenKeys).map((key) => key.toLowerCase())
  for (const key of responseKeys) {
    expect(ALLOWED_DISCOVERY_KEYS, `network response returned non-allowlisted key ${key}`).toContain(key)
  }
  for (const forbidden of FORBIDDEN_DISCOVERY_KEYS) {
    expect(responseKeys, `network response leaked ${forbidden}`).not.toContain(forbidden)
  }
  const region = page.getByRole('region', { name: 'Other recordings from this meeting' })
  const dom = (await region.evaluate((node) => node.outerHTML)).toLowerCase()
  for (const forbidden of FORBIDDEN_DISCOVERY_KEYS) {
    expect(dom, `rendered DOM leaked ${forbidden}`).not.toContain(forbidden)
  }
  expect(dom).not.toContain(fixture.ownerRecordingId.toLowerCase())
}

test.describe('Phase 38 owner settings and access management', () => {
  test.use({ storageState: fixture.auth.owner, viewport: { width: 1440, height: 1000 } })

  for (const choice of ACCESS_CHOICES) {
    test(`account default accepts ${choice.label}${choice.value === 'public' ? ' with confirmation' : ''}`, async ({ page }) => {
      await setPhase38AccountDefault(choice.value === 'private' ? 'public' : 'private')
      await page.goto('/settings/privacy-access')
      const group = page.getByRole('radiogroup', { name: 'Default access for new recordings' })
      const option = group.getByRole('radio', { name: new RegExp(`^${choice.label}`) })
      await option.click({ timeout: 10_000 })
      if (choice.value === 'public') {
        const confirmation = page.getByRole('alertdialog')
        await expect(confirmation.getByText('Make new recordings public by default?')).toBeVisible()
        await confirmation.getByRole('button', { name: 'Use Public by default' }).click()
      }
      await expect(option).toBeChecked({ timeout: 10_000 })
      if (choice.value === 'public') {
        await assertAccessible(page, 'Privacy & Access settings', '[role="radiogroup"]')
        await page.screenshot({ path: `${PHASE38_EVIDENCE_DIR}/settings-defaults.png`, fullPage: true })
      }
    })
  }

  for (const choice of ACCESS_CHOICES) {
    test(`recording access accepts ${choice.label}${choice.value === 'public' ? ' with confirmation' : ''}`, async ({ page }) => {
      await setPhase38RecordingPolicy(choice.value === 'private' ? 'public' : 'private')
      await openAccessPanel(page)
      const panel = getAccessDialog(page)
      const group = panel.getByRole('radiogroup', { name: 'Choose access level' })
      const option = group.getByRole('radio', { name: new RegExp(`^${choice.label}`) })
      await option.click({ timeout: 10_000 })
      if (choice.value === 'public') {
        const confirmation = page.getByRole('alertdialog')
        await confirmation.getByRole('button', { name: 'Make public' }).click()
        await expect(confirmation).toBeHidden({ timeout: 15_000 })
        await openAccessPanel(page)
      }
      await expect(option).toBeChecked({ timeout: 10_000 })
      if (choice.value === 'public') {
        await assertAccessible(page, 'desktop Recording access panel', '[role="dialog"]')
        await page.screenshot({ path: `${PHASE38_EVIDENCE_DIR}/access-desktop.png`, fullPage: true })
      }
    })
  }

  test('reset uses the current account default and owner review stays recording scoped', async ({ page }) => {
    await setPhase38AccountDefault('attendees')
    await setPhase38RecordingPolicy('public')
    await resetPhase38PendingRequest()
    await openAccessPanel(page)
    const panel = getAccessDialog(page)
    const reset = panel.getByRole('button', { name: 'Reset to default' })
    await reset.click()
    await expect(panel.getByText('Using default: Attendees')).toBeVisible()
    await panel.getByRole('button', { name: 'Review request' }).first().click()
    await expect(panel.getByText('Verified participant evidence')).toBeVisible()
    await page.screenshot({ path: `${PHASE38_EVIDENCE_DIR}/owner-review.png`, fullPage: true })
  })

  test('validated notification deep link focuses only the authorized request', async ({ page }) => {
    await resetPhase38PendingRequest()
    const current = await readPhase38BrowserFixtures()
    await page.goto(`/call/${current.ownerRecordingId}?accessRequest=${current.requestId}`)
    await expect(page).toHaveURL(new RegExp(`/transcripts\\?callId=${current.ownerRecordingId}&accessRequest=${current.requestId}`))
    await expect(page.getByRole('heading', { name: /Review access request/i })).toBeFocused()
  })
})

test.describe('Phase 38 confirmed participant discovery boundary', () => {
  test.use({
    storageState: fixture.auth.confirmedParticipant,
    viewport: { width: 1440, height: 1000 },
  })

  test('unknown and non-webinar 49 pass; 50 and explicit webinar suppress discovery', async ({ page }) => {
    await clearPhase38AccessLifecycle()
    await setPhase38RecordingPolicy('private')
    await configurePhase38DiscoveryScenario('unknown', 49)
    const payloads = collectDiscoveryResponses(page)
    await page.goto(`/call/${fixture.publicRecordingId}`)
    const region = page.getByRole('region', { name: 'Other recordings from this meeting' })
    await expect(region).toBeVisible()
    await expect(region.getByText('Recording 1')).toBeVisible()
    await assertNoProtectedDiscoveryData(page, payloads)
    await region.getByRole('button', { name: 'Request access to recording 1' }).click()
    await expect(region.getByText('Request sent')).toBeVisible()
    await refreshPhase38RequestId()
    await page.screenshot({ path: `${PHASE38_EVIDENCE_DIR}/anonymous-copies.png`, fullPage: true })

    await configurePhase38DiscoveryScenario('unknown', 50)
    await page.reload()
    await expect(region).toHaveCount(0)

    await configurePhase38DiscoveryScenario('webinar', 49)
    await page.reload()
    await expect(region).toHaveCount(0)

    await configurePhase38DiscoveryScenario('non_webinar', 49)
    await page.reload()
    await expect(region).toBeVisible()
  })
})

test.describe('Phase 38 mobile access dialog', () => {
  test.use({
    storageState: fixture.auth.owner,
    viewport: { width: 390, height: 844 },
  })

  test('uses one dialog tree, touch sized actions, reduced motion, and no overflow', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await openAccessPanel(page)
    const dialog = getAccessDialog(page)
    await expect(dialog).toHaveCount(1)
    await expect(dialog.getByText(REQUIRED_NOTICE)).toBeVisible()
    const reset = dialog.getByRole('button', { name: 'Reset to default' })
    expect((await reset.boundingBox())?.height).toBeGreaterThanOrEqual(44)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true)
    await assertAccessible(page, 'mobile Recording access dialog', '[role="dialog"]')
    await page.screenshot({ path: `${PHASE38_EVIDENCE_DIR}/access-mobile.png`, fullPage: true })
  })
})

test.describe('Phase 38 logged-out public boundary', () => {
  test.use({ storageState: EMPTY_STATE, viewport: { width: 1440, height: 1000 } })

  test('Public returns the allowlist while Private and invalid IDs share generic copy', async ({ page }) => {
    await page.goto(`/public/${fixture.publicRecordingId}`)
    const main = page.getByRole('main')
    await expect(main).toContainText(/Transcript|Recording/)
    await expect(main).not.toContainText(/Owner|Provider|Source/)
    await assertAccessible(page, 'public recording page', 'main')
    await page.screenshot({ path: `${PHASE38_EVIDENCE_DIR}/public-page.png`, fullPage: true })

    await page.goto(`/public/${fixture.ownerRecordingId}`)
    await expect(page.getByText('This recording is not available.')).toBeVisible()
    await page.goto('/public/not-a-uuid')
    await expect(page.getByText('This recording is not available.')).toBeVisible()
  })
})
