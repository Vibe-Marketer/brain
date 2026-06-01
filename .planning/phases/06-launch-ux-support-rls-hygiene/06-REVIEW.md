---
phase: 06-launch-ux-support-rls-hygiene
reviewed: 2026-06-01T06:47:06Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - src/components/billing/LockedFeatureButton.tsx
  - src/components/billing/PaywallDialog.tsx
  - src/components/billing/__tests__/paywall-gate.test.tsx
  - src/components/connectors/ConnectorImportWizard.tsx
  - src/components/connectors/__tests__/ConnectorImportWizard.test.tsx
  - src/components/connectors/registry/adapters/fathom.ts
  - src/components/connectors/registry/types.ts
  - src/components/contacts/ContactsTable.tsx
  - src/components/import/ImportHistoryPanel.tsx
  - src/components/onboarding/OnboardingVideoModal.tsx
  - src/components/panes/__tests__/ImportSourcePane.registry.test.ts
  - src/components/settings/BillingTab.tsx
  - src/components/settings/MCPTab.tsx
  - src/components/support/SupportPopover.tsx
  - src/components/support/SupportTicketDialog.tsx
  - src/components/transcript-library/EmptyStates.tsx
  - src/components/transcript-library/TranscriptTableRow.tsx
  - src/components/transcripts/SyncTab.tsx
  - src/components/transcripts/UnsyncedMeetingsSection.tsx
  - src/components/ui/__tests__/sidebar-nav.test.tsx
  - src/components/ui/sidebar-nav.tsx
  - src/hooks/useMeetingsSync.ts
  - src/hooks/useRequirePaidPlan.ts
  - src/hooks/useSyncTabOrchestration.ts
  - src/pages/ImportPage.tsx
  - src/pages/SetupTrialUpsell.tsx
  - src/pages/__tests__/ImportPage.connector-routing.test.ts
  - src/services/support-ticket.service.ts
  - src/services/sync-tab.service.ts
  - src/test/rls-regression.test.ts
  - src/types/meetings.ts
  - supabase/functions/fetch-meetings/index.ts
  - supabase/functions/send-support-ticket/index.ts
findings:
  critical: 2
  warning: 3
  info: 0
  total: 5
status: issues_found
---
# Phase 06: Code Review Report

**Reviewed:** 2026-06-01T06:47:06Z  
**Depth:** standard  
**Files Reviewed:** 33  
**Status:** issues_found

## Summary

Review found two blockers and three warnings, with highest risk in test-environment isolation and credential-handling paths.

## Critical Issues

### CR-01: Integration test can target production Supabase by env fallback

**File:** `src/test/rls-regression.test.ts:24`  
**Issue:** The test falls back from `VITE_SUPABASE_TEST_*` to production-like `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY`, which can run destructive fixture setup against non-test environments.  
**Fix:**
```ts
const TEST_URL = process.env.VITE_SUPABASE_TEST_URL || "";
const TEST_ANON_KEY = process.env.VITE_SUPABASE_TEST_ANON_KEY || "";

if (!TEST_URL || !TEST_ANON_KEY) {
  throw new Error(`${SUITE_TAG} requires VITE_SUPABASE_TEST_URL + VITE_SUPABASE_TEST_ANON_KEY`);
}
```

### CR-02: OAuth refresh writes access/refresh tokens in plaintext

**File:** `supabase/functions/fetch-meetings/index.ts:316`  
**Issue:** Refreshed tokens are written directly into `import_sources`/`user_settings` fields (`oauth_access_token`, `oauth_refresh_token`) instead of encrypted write path. This risks secret disclosure at rest and breaks encryption-at-rest expectations.  
**Fix:**
```ts
// Replace direct .update({ oauth_access_token, oauth_refresh_token, ...})
// with shared encrypted token persistence helper used by oauth callback paths.
await persistEncryptedOAuthTokens({
  supabase,
  sourceId: credSourceId,
  userId,
  accessToken: tokens.access_token,
  refreshToken: tokens.refresh_token,
  tokenExpires: expiresAt,
});
```

## Warnings

### WR-01: Support ticket metadata trusts client-supplied IDs

**File:** `supabase/functions/send-support-ticket/index.ts:16`  
**Issue:** `userId`, `organizationId`, and `workspaceId` are accepted from request body and forwarded to support email. A caller can spoof these values, producing misleading operational/debugging data.  
**Fix:** Derive `userId` from `authenticateRequest`, and either omit org/workspace IDs from client input or server-verify them against DB membership before including in outbound email.

### WR-02: Legacy sync path converts IDs with unchecked `parseInt`

**File:** `src/hooks/useSyncTabOrchestration.ts:331`  
**Issue:** `externalIds.map((id) => parseInt(id, 10))` can produce `NaN` values and still call sync API. This can fail unpredictably or sync an unintended subset.  
**Fix:**
```ts
const recordingIds = externalIds.map((id) => Number(id));
if (recordingIds.some((n) => !Number.isSafeInteger(n) || n <= 0)) {
  throw new Error("Invalid Fathom recording id in selection");
}
```

### WR-03: `any` leaks into core meeting type

**File:** `src/types/meetings.ts:75`  
**Issue:** `source_metadata?: Record<string, any> | null` weakens type safety in a core data model and allows unsafe assumptions downstream.  
**Fix:** Replace with `Record<string, unknown>` and add narrow type guards at read sites.

---

_Reviewed: 2026-06-01T06:47:06Z_  
_Reviewer: the agent (gsd-code-reviewer)_  
_Depth: standard_
