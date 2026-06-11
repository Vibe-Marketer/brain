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
