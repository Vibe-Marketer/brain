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
