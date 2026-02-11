---
status: verifying
trigger: "YouTube import: no vault auto-created, videos invisible, oversized thumbnail"
created: 2026-02-11T00:00:00Z
updated: 2026-02-11T00:03:00Z
---

## Current Focus

hypothesis: All three issues fixed - vault creation query simplified, bank reuse in Step 6, compact thumbnail UI
test: TypeScript compilation passes. Verify runtime behavior with import test.
expecting: Videos land in auto-created YouTube vault and are visible there; CallDetailPage shows compact thumbnail
next_action: Verify all changes compile and review code for correctness

## Symptoms

expected: |
  1. YouTube import auto-creates a YouTube hub for the user
  2. YouTube videos visible in their YouTube hub
  3. CallDetailPage shows small thumbnail with metadata alongside

actual: |
  1. No hub created on import
  2. Videos filtered from main list, no hub to find them in - they disappear
  3. Massive full-width thumbnail, no metadata displayed

errors: No explicit errors - logic gaps and UI issues
reproduction: Import YouTube video, try to find it, navigate to detail page
started: Continuation of youtube-post-import-issues debug session

## Eliminated

- hypothesis: TranscriptsTab filter is wrong and should be removed
  evidence: The filter on line 274 correctly excludes YouTube videos from the main list. YouTube videos belong in their YouTube hub. The issue is that the hub isn't being created, not that the filter is wrong.
  timestamp: 2026-02-11T00:00:30Z

## Evidence

- timestamp: 2026-02-11T00:00:30Z
  checked: Edge function youtube-import/index.ts Step 0 vault creation logic
  found: The bank lookup used a joined query `bank_memberships.select('bank_id, banks!inner(id, type)').eq('banks.type', 'personal')` which is fragile PostgREST join syntax. Also the personalBankId was scoped inside the if block and not reused in Step 6.
  implication: Root cause of vault not being created - the join query fails silently.

- timestamp: 2026-02-11T00:00:35Z
  checked: Edge function Step 6 bank lookup (line ~777)
  found: Used `.limit(1).maybeSingle()` without filtering by bank type. Could pick a business bank instead of personal.
  implication: Recording might be created in wrong bank, orphaned from the YouTube vault.

- timestamp: 2026-02-11T00:00:40Z
  checked: CallDetailPage.tsx YouTube layout
  found: Thumbnail rendered as `<div className="w-full aspect-video bg-muted">` - full width, 16:9 aspect ratio. This creates a massive hero image. Metadata (views, likes, duration, date) shown below the thumbnail instead of alongside.
  implication: Need to restructure to compact horizontal layout with 168x94px thumbnail.

- timestamp: 2026-02-11T00:02:00Z
  checked: TypeScript compilation after all fixes
  found: `npx tsc --noEmit` passes with no errors
  implication: All changes are syntactically and type-safe correct.

## Resolution

root_cause: |
  1. VAULT CREATION: Edge function Step 0 used a fragile PostgREST joined-table query (`bank_memberships` join to `banks!inner`) that silently failed, causing personalBankId to be null. No vault was created, no vault entry linked.
  2. VISIBILITY: TranscriptsTab correctly filters YouTube videos (line 274), but since vault creation failed, videos had no YouTube hub to live in. They existed in fathom_calls but were invisible in all views.
  3. UI: CallDetailPage used `w-full aspect-video` for the thumbnail, creating a massive full-width hero image. Metadata was below instead of alongside.

fix: |
  1. Replaced the fragile join query with two simple sequential queries: first fetch bank_memberships, then query banks table separately to find the personal bank. Hoisted personalBankId to `resolvedPersonalBankId` for reuse in Step 6.
  2. Step 6 now reuses `resolvedPersonalBankId` from Step 0 instead of an independent query that could pick the wrong bank. Falls back to first membership if personal bank wasn't found.
  3. Redesigned CallDetailPage YouTube section: compact 168x94px thumbnail on the left, metadata (title, channel, views, likes, duration, date) on the right in a horizontal layout. Thumbnail is clickable (links to YouTube).
  4. Added `vaultId` to the import success response so the frontend could navigate to the vault.

verification: TypeScript compilation passes. Runtime verification requires actual YouTube import test.
files_changed:
  - supabase/functions/youtube-import/index.ts
  - src/pages/CallDetailPage.tsx
