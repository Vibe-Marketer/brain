---
status: investigating
trigger: "Share Call dialog CREATE button shows no feedback — list still says 'No share links yet' after clicking CREATE. Also unknown: what does the recipient experience at /s/ URLs look like?"
created: 2026-04-14
updated: 2026-04-14
---

# Debug: Share Link No Feedback

## Symptoms

- **Expected:** Clicking CREATE in Share Call dialog should create a share link and show it in the list below
- **Actual:** List still shows "No share links yet. Create one above to share this call." after clicking CREATE
- **Error messages:** None visible in UI
- **Timeline:** Unknown if this ever worked
- **Reproduction:** Open call detail → click SHARE → optionally enter email → click CREATE
- **Additional context:** User also wants to understand the recipient experience at share URLs like https://app.callvaultai.com/s/ZEIH0nARH8xj6l6Ux32OZeswGW2RaJ4Q

## Current Focus

hypothesis: Multiple root causes confirmed — query key type mismatch (string vs number) causes invalidation miss; fathom_calls vs fathom_raw_calls table name mismatch breaks recipient view; FK to a view may silently break inserts.
test: Full code path traced from dialog → hook → Supabase insert and from /s/:token → SharedCallView → useSharedCall
expecting: n/a — investigation complete
next_action: Report findings

## Evidence

- timestamp: 2026-04-14
  checked: ShareCallDialog.tsx handleCreateLink
  found: Error is caught and calls toast.error("Failed to create share link") on failure. If insert succeeds, createShareLink resolves and clipboard copy + toast.success fires. On success, no re-throw occurs.
  implication: If no toast appears at all, the insert is likely succeeding silently but the list isn't refreshing.

- timestamp: 2026-04-14
  checked: useSharing.ts createMutation mutationFn
  found: Insert goes DIRECTLY to Supabase client (bypasses the share-call edge function entirely). Uses anon key with RLS. RLS INSERT policy: auth.uid() = user_id AND auth.uid() = created_by_user_id.
  implication: This should work for an authenticated user. The insert path is viable.

- timestamp: 2026-04-14
  checked: createMutation.onSuccess invalidation
  found: queryClient.invalidateQueries({ queryKey: queryKeys.sharing.links(data.call_recording_id) }) — uses data.call_recording_id which is a NUMBER returned from the DB.
  implication: The list query uses callId passed to the hook, which comes from the callId prop in the dialog. callId is typed as number | string | null. If callId is passed as a string (e.g., "123") from CallDetailPage but data.call_recording_id is number 123, the query keys ['sharing','links','123'] vs ['sharing','links',123] do NOT match. TanStack Query uses referential equality for key matching. This is the PRIMARY list bug.

- timestamp: 2026-04-14
  checked: call_share_links migration (20260108000001_create_single_call_share_tables.sql)
  found: FOREIGN KEY (call_recording_id, user_id) REFERENCES fathom_calls(recording_id, user_id) ON DELETE CASCADE
  implication: The FK references fathom_calls. Migration 20260310000002 confirms fathom_calls IS a view, not a base table. PostgreSQL cannot create FK constraints to views. This FK was likely silently ignored at migration time or caused a migration failure. The actual insert likely succeeds because the FK constraint doesn't exist.

- timestamp: 2026-04-14
  checked: useSharedCall hook line 261
  found: .from("fathom_calls") — queries the fathom_calls view directly from the client
  implication: The fathom_calls view was never given RLS policies for cross-user access. A recipient visiting /s/TOKEN who is a different user than the call owner will get an empty/error result because RLS filters out the other user's rows. The edge function correctly uses fathom_raw_calls with service role key (bypasses RLS) — but useSharedCall bypasses the edge function entirely and queries the DB directly with anon key.

- timestamp: 2026-04-14
  checked: useSharedCall vs edge function approach
  found: useSharedCall does a client-side direct DB query to fathom_calls. The share-call edge function (GET ?token=xxx) queries fathom_raw_calls with the service role key. These are two completely different code paths for the same job.
  implication: The edge function approach is correct and secure. The hook's approach bypasses security and uses the wrong table. SharedCallView uses the hook's approach, so the recipient experience is broken.

- timestamp: 2026-04-14
  checked: App.tsx routing
  found: Route /s/:token → SharedCallView is registered correctly.
  implication: Routing is fine. The page component exists and loads.

- timestamp: 2026-04-14
  checked: SharedCallView.tsx
  found: Redirects unauthenticated users to /login with pendingShareToken in sessionStorage. Does NOT handle the post-login redirect from sessionStorage.
  implication: Recipients who aren't logged in get sent to login but after login they land on the home page, not the shared call. The pendingShareToken in sessionStorage is never consumed.

- timestamp: 2026-04-14
  checked: callId type flow
  found: callId prop is typed as number | string | null. queryKeys.sharing.links signature is (callId: string | number). The onSuccess uses data.call_recording_id (number). If callId was ever string "123", the cache key mismatch means refetch doesn't trigger.
  implication: Confirmed query key mismatch as primary cause of list not updating.

## Eliminated

- hypothesis: Missing queryClient.invalidateQueries call
  evidence: onSuccess correctly calls invalidateQueries — the call IS there. Problem is key mismatch, not missing call.
  timestamp: 2026-04-14

- hypothesis: Dialog doesn't pass callId or it's null
  evidence: handleCreateLink guards on !callId before proceeding. If callId were null, nothing would happen and no toast would fire.
  timestamp: 2026-04-14

- hypothesis: userId timing race prevents insert
  evidence: If userId were undefined, createMutation throws "User ID is required" and toast.error fires. If no toast fires, userId was present.
  timestamp: 2026-04-14

## Resolution

root_cause: |
  THREE distinct bugs across the share link feature:

  BUG 1 — LIST DOESN'T UPDATE (primary symptom)
  In useSharing.ts onSuccess handler, queryClient.invalidateQueries uses
  data.call_recording_id (number) as the cache key. But the active list query
  was registered with the callId prop (potentially a string). TanStack Query
  uses strict equality for key arrays — ['sharing','links',123] !== ['sharing','links','123'].
  The invalidation misses the active query, so the list never refetches.

  BUG 2 — RECIPIENT EXPERIENCE BROKEN
  useSharedCall in useSharing.ts queries .from("fathom_calls") directly with
  the client's anon key. fathom_calls is a view with user-scoped RLS. A recipient
  who is a different user from the call owner cannot see the call data — the query
  returns empty. The share-call edge function (which correctly uses service role key
  + fathom_raw_calls) is never called by SharedCallView.

  BUG 3 — POST-LOGIN REDIRECT MISSING
  SharedCallView redirects unauthenticated visitors to /login and saves the token
  in sessionStorage as 'pendingShareToken'. But the login flow never reads
  sessionStorage to redirect back to the shared call. Recipients who aren't
  logged in are permanently lost after authenticating.

fix: See recommended fixes
verification: not yet applied
files_changed: []
