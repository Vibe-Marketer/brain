# Phase 24 — Deferred Items (out of scope)

Out-of-scope discoveries logged here per executor SCOPE BOUNDARY rule.
Phase 24's diff did NOT cause these — verified by running the same tests
against `main` with the Phase 24 commits stashed.

## Pre-existing failing tests (caused: not by Phase 24)

- `src/components/ui/__tests__/sidebar-nav.test.tsx` — 17 failures (rendering/navigation/active-state/keyboard sections). Tests are looking for elements that have moved in the actual sidebar implementation.
- `src/services/__tests__/tags.service.test.ts` — 5 failures in `getTagCounts` and `getTagRules`. Looks like supabase mock signature drift.
- `src/hooks/__tests__/useBulkApplyRules.test.ts` — 1 failure (`dry run with matches` toast assertion).
- `src/hooks/__tests__/useSharing.test.ts` — 4 failures (shared-call-by-token + logAccess).

Total: 27 failures across 4 files. All present on `main` before Phase 24's commits.

## Pre-existing TypeScript errors (Layout.test, WebhookDeliveryViewerV2, ErrorBoundary, etc.)

- `src/components/__tests__/Layout.test.tsx` — `toHaveAttribute` / `toBeInTheDocument` matchers missing from vitest types config (29 errors).
- `src/components/debug-panel/WebhookDeliveryViewerV2.tsx` — `unknown` type narrowing missing on raw payload.
- `src/components/ErrorBoundary.tsx` — `metadata` prop on debug message type drift.
- `src/components/call-detail/CallTranscriptTab.tsx` — TranscriptSegment vs Record cast mismatch.
- Various test files importing `@testing-library/jest-dom` matchers that aren't typed.

Phase 24 introduced ZERO new TS errors — verified by `npx tsc --noEmit` filtered to Phase-24 file paths.

## Lint warnings

- `src/pages/ImportPage.tsx:73` — `sourceByApp` declared but unused. Pre-existing (created in Phase 12).
