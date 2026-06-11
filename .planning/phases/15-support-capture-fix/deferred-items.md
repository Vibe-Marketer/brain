# Phase 15 — Deferred Items

Discovered during execution; out of scope for the plan that found them. Do not fix inline.

## From 15-01 (2026-06-11)

### Legacy storage artifacts from the displaced morning-session stack (2026-06-10)

Found while verifying the new `ticket-attachments` bucket live:

- `storage.buckets` still contains a legacy **`support_attachments`** bucket (the 11-02 displacement dropped the legacy tables/functions but not this bucket)
- 4 legacy policies remain on `storage.objects`, all scoped to `bucket_id = 'support_attachments'`:
  - "Admins can upload support attachments" (INSERT, uses `is_admin()`)
  - "Admins can view all support attachments" (SELECT, uses `is_admin()`)
  - "Users can upload their own support attachments" (INSERT, `auth.uid() = owner`)
  - "Users can view their own support attachments" (SELECT, `auth.uid() = owner`)
- These reference an `is_admin()` helper that is NOT the repo's `public.has_role` idiom

**Impact:** none on Phase 15 — every policy is scoped to the legacy bucket id and cannot match `ticket-attachments` objects. But they are dead surface area inviting confusion; a cleanup migration (drop bucket if empty + drop 4 policies) belongs in a deliberate housekeeping step.

### Supabase storage service instability (platform, not repo)

During 15-01 verification (2026-06-11 ~15:20-15:40 UTC) the project's storage service reported UNHEALTHY at the platform level (`/v1/projects/{ref}/health` — db/auth/rest all healthy) and all storage REST calls returned `544 DatabaseTimeout`, including service-role bucket lists. Storage config shows `"external":{"upstreamTarget":"canary"}` — the project is on a canary storage release. If storage flakiness recurs, ask Supabase support to move the project off the canary channel.

## From 15-02 (2026-06-11)

### [DEFERRED-VERIFY] Console-log attachment live data-plane probe (storage outage continuing)

Storage REST still returning `544 DatabaseTimeout` at 15-02 execution time (~16:00 UTC): authenticated upload probe to `ticket-attachments` under the test user's own folder 544'd, retried after ~50s, 544 again. Code shipped fully unit-tested (10 console-buffer tests + 9 service tests + dialog round-trip test, full suite 1781 green); the upload path degrades by design (failed upload never blocks submission).

**Re-run when storage recovers:**
1. Trigger a console.error in the app, submit a ticket via dev-browser
2. Query `ticket_messages.attachments` — expect TWO descriptors (screenshot + console_log)
3. Signed-URL download the console JSON — confirm the error entry present, `responseBody`/`appStateSnapshot` absent

## From 15-03 (2026-06-11)

### [DEFERRED-VERIFY] Signed-URL data-plane probes + dev-browser end-to-end (storage outage continuing)

Storage REST still 544 DatabaseTimeout at 15-03 execution time (~16:20 UTC): `POST /object/sign/ticket-attachments/...` probe 544'd, retried after ~50s, 544 again. Code shipped fully unit-tested (3 signed-URL service tests + 5 TicketDetailDialog component tests, full suite 1790 green, getPublicUrl sweep 0).

**Re-run when storage recovers:**
1. Dev-browser end-to-end: user submits ticket with screenshot + console buffer → admin opens AdminTab → ticket detail → image preview renders the problem view, console JSON link downloads
2. Manual storage RLS spot-check from 15-VALIDATION.md: second non-admin account cannot createSignedUrl on the first user's path
3. Confirm a real signed URL renders in the img and the 'Attachment unavailable' state never shows for valid objects

## ✅ VERIFIED — storage recovered (2026-06-11, live data-plane probes)

Storage recovered (round-trips upload→sign→delete <1s on `ticket-attachments`; mime allowlist jpeg/png/webp/json; own-folder INSERT + owner/admin SELECT RLS). All deferred byte-upload probes executed live against the **hosted/prod project** (`vltmrnjsubfzrgrtdqey`) as the real test user (`CALLVAULTAI_LOGIN`, userId `ef054159…`) plus service-role for inspection/cleanup. **All passed. All probe artifacts cleaned up.**

### Probe 1 — Screenshot path end-to-end (15-01 + 15-03) — **PASS**
- Authenticated user uploaded a valid 70-byte PNG to own folder `ef054159…/<uuid>.png` → upload **200/ok**.
- Submitted ticket via deployed `send-support-ticket` with the screenshot attachment ref → **200**, `ticketId c4fa6591…`.
- `ticket_messages.attachments` descriptor landed: `{type:screenshot, path:ef054159…/<uuid>.png, mime:image/png, size_bytes:70}` (service-role read).
- Object confirmed present in bucket (service-role `list` under user folder → found).
- Admin `createSignedUrl` → fetched signed URL → **HTTP 200, 70 bytes** returned (byte-exact round-trip).

### Probe 2 — RLS spot-check, other user CANNOT sign another user's path (15-03) — **PASS**
- Created throwaway second authenticated non-admin user → signed in → `createSignedUrl` on the FIRST user's path → **blocked** (`Object not found`, no URL).
- Control: same second user uploaded to THEIR OWN folder and signed it → **succeeded**. Proves the block is RLS (own-folder works, foreign-folder doesn't), not an empty bucket.
- Control: first user signing their OWN path → succeeded; unauthenticated anon client signing the first user's path → blocked.

### Probe 3 — Console-log JSON attachment end-to-end (15-02) — **PASS**
- Authenticated user uploaded a 144-byte `application/json` console-log buffer to own folder `ef054159…/<uuid>.json` → upload **200/ok**.
- Submitted ticket via deployed function with the console_log ref → **200**, `ticketId 0833279a…`.
- `ticket_messages.attachments` descriptor landed: `{type:console_log, path:…/<uuid>.json, mime:application/json, size_bytes:144}`.
- Admin signed URL → **HTTP 200**, JSON round-trip intact (`entries[0].level === "error"`).

### Cleanup (service-role) — **COMPLETE**
- Both probe objects (.png, .json) + the second user's control object → removed; re-list confirms `gone`.
- Both probe tickets (`c4fa6591…`, `0833279a…`) + their `ticket_messages`/`ticket_events` → deleted; re-select confirms `gone`.
- Throwaway second user (`6c7ae252…`) → its auto-created workspace + membership (signup trigger made it sole workspace_owner; `prevent_last_workspace_owner_removal` initially blocked the cascade) removed, then user deleted via service-role; verify: 0 users / 0 workspaces / 0 memberships.
- Temporary probe scripts removed from the phase dir; no probe residue left in the repo.

**Note:** the legacy `support_attachments` bucket + 4 legacy policies (top of this file) remain — still inert, still a deliberate housekeeping item, NOT part of these probes.
