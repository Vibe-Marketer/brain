# Phase 27: Close v2.1 Audit Gaps + 3 Critical Security Fixes - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning
**Source:** Generated inline from `.planning/v2.1-MILESTONE-AUDIT.md` AND the 2026-05-07 Edge Function security audit (3 Critical findings absorbed into Phase 27; 6 High findings split out to Phase 28).

<domain>
## Phase Boundary

This phase closes every blocker, warning, and orphan surfaced by the v2.1 milestone audit AND the 3 production-exploitable Critical findings from the 2026-05-07 Edge Function security audit, so v2.1 can ship at `passed` status with no known critical security holes. Scope is strictly limited to gap remediation + Critical security fixes — NO new features, NO refactoring beyond what each fix requires.

**In scope (10 success criteria from ROADMAP.md Phase 27):**
1. Re-enable PROV-02 plan-gating in `mcp-server/index.ts:807-826`
2. Regenerate `src/types/supabase.ts` (4 missing schema additions)
3. Update `regenerate_mcp_token` RPC to return `enabled_categories`
4. Update `auto_create_default_workspace_entry()` trigger to use `is_default` not `is_home`
5. Backfill VERIFICATION.md for phases 20, 21, 22, 23, 24
6. Add WS-01..05 to REQUIREMENTS.md traceability table
7. **🔴 CRITICAL — `mcp-oauth-register` open-proxy** — fail-closed if `SUPABASE_ANON_KEY` unset (remove service-role fallback)
8. **🔴 CRITICAL — `zoom-webhook` OAuth token in URL** — move to `Authorization` header
9. **🔴 CRITICAL — `share-call` audit log poisoning** — never trust client-supplied `accessor_user_id`/`ip_address` query params
10. (Optional, deferred to backlog) Nyquist VALIDATION.md for phases 19-25

**Out of scope (Phase 28 or v2.2 BACKLOG):**
- 6 High-severity security findings → **Phase 28 (Security Hardening):** timing-safe compare, replay window, magic-byte validation, OAuth token encryption at rest, email-XSS escape, share-call mandatory org check, webhook idempotency, auth helper consistency
- Medium/Low security findings → **v2.2 BACKLOG:** polar-webhook DRY refactor, in-band MCP provisioning perf, unnecessary CORS, leaked error details
- New MCP tools, new requirements, new features
- Cross-device concurrent reorder conflict resolution (Phase 25 deferred)
- Server-side RLS DELETE policy for is_default workspaces (Phase 25 deferred)
- Capability-gating for the 5 destructive bonus tools (delete_call, etc.) — flag for v2.2
- Pre-existing test failures unrelated to v2.1 (sidebar-nav, tags.service, useSharing, useBulkApplyRules)
- Pre-existing TS errors in test files (Layout.test, WebhookDeliveryViewerV2, etc.)
- 84 pre-existing TS errors revealed when supabase.ts CLI banner removed in Phase 25

</domain>

<decisions>
## Implementation Decisions (locked from audit)

### D-01 — PROV-02 plan-gating: re-enable enforcement
- **Locked:** Add `return mcpError(id, -32001, 'MCP access requires a Pro or Team plan. Upgrade at https://app.callvaultai.com/settings', corsHeaders);` inside the existing `if (!paid)` branch at `supabase/functions/mcp-server/index.ts:823-825`.
- **Why:** Trial-provisioning migration `20260430123000_trial_provisioning_and_dead_code_cleanup.sql` already grants every signup a 7-day pro-trial that satisfies `is_paid_tier` — the original blocker that justified disabling the gate is gone.
- **Rationale source:** Integration checker confirmed in v2.1-MILESTONE-AUDIT.md BLOCKER #1 (file:line evidence + remediation).
- **Edge case:** `initialize` and `tools/list` MUST remain ungated (MCP handshake must succeed for any client regardless of tier — preserves Phase 19-02 D-06).

### D-02 — Verification approach for PROV-02
- **Locked:** Verify with curl against a token whose user has `product_id=null`. Expected response: `{"jsonrpc":"2.0","id":1,"error":{"code":-32001,"message":"MCP access requires a Pro or Team plan..."}}`.
- **Test fixture approach:** Manually clear a test user's `product_id` in `user_profiles` (do NOT pollute production data — use a dedicated test account or the soren@vibeos.com account temporarily).

### D-03 — supabase.ts type regeneration
- **Locked:** Run `supabase gen types typescript --linked > src/types/supabase.ts`. The Supabase CLI will produce the canonical types matching production schema.
- **Cleanup required:** Strip any trailing CLI banner text (Phase 25 Plan 02 hit this — banner appended after `} as const` breaks the TS parser).
- **Cast removal:** After regenerate, remove `as McpToken` casts at:
  - `src/services/mcp-token-capabilities.service.ts:50` (or wherever the cast lives in current file)
  - `src/services/mcp-tokens.service.ts:147`
- **Expected newly-typed members after regen:**
  - `mcp_tokens.enabled_categories: Json | null` (or `string[] | null` depending on supabase generator)
  - `recordings.action_items_cache: Json | null`
  - `recordings.coaching_cache: Json | null`
  - `call_notes` table with `Row`, `Insert`, `Update` shapes
- **Tradeoff:** Regenerate may reveal additional pre-existing TS errors. **Decision:** fix any error in plan-touched files; defer the rest to v2.2 cleanup phase (per Phase 25 precedent for the 84 pre-existing errors).

### D-04 — regenerate_mcp_token RPC: add enabled_categories to RETURNS TABLE
- **Locked:** Create a new migration (do NOT modify the original `20260410153126_mcp_auto_provision.sql` — migrations are immutable). Migration name format: `YYYYMMDDHHMMSS_regenerate_mcp_token_with_categories.sql` per supabase/CLAUDE.md naming convention.
- **Migration body:** `CREATE OR REPLACE FUNCTION regenerate_mcp_token(p_token_id UUID) RETURNS TABLE (..., enabled_categories JSONB) ...` — replicate the original function body, add the column to both `RETURNS TABLE` and the SELECT/UPDATE RETURNING list.
- **Preserve invariants:** SECURITY DEFINER, `SET search_path = extensions, public`, `WHERE user_id = auth.uid()` IDOR guard.
- **Tradeoff:** Optimistic patch in `useRegenerateMcpToken.onSuccess` continues to self-heal on cache invalidate even before the migration. This is a low-priority correctness fix (cosmetic UX glitch users likely don't notice) — keep migration small and surgical.

### D-05 — auto_create_default_workspace_entry trigger: use is_default
- **Locked:** Create a new migration that does `CREATE OR REPLACE FUNCTION auto_create_default_workspace_entry()` with the trigger body changed to query `WHERE is_default = TRUE` instead of `WHERE is_home = TRUE`.
- **Why:** Phase 25 introduced `is_default` (with partial unique index ensuring one-per-org). The trigger currently routes new recordings via `is_home` — if a user manually flips `is_default` to a non-Home workspace via the Phase 25 UI, new recordings continue routing to OLD `is_home` workspace. The two-flag system is brittle.
- **Source:** `supabase/migrations/20260308100000_cross_org_copy_and_auto_entry.sql:223`.
- **Verification:** Read trigger function body via `pg_get_functiondef`; confirm it now references `is_default` instead of `is_home`. Spot-check by inserting a test recording with the user's chosen non-Home workspace as `is_default` and confirming the workspace_entry lands in the right workspace.
- **Backwards compat:** Phase 25's `ensure_home_workspace()` always sets BOTH `is_home=TRUE` and `is_default=TRUE` for new orgs (line 109) — existing data continues to work either way.

### D-06 — VERIFICATION.md backfill scope
- **Locked:** Backfill VERIFICATION.md for phases 20, 21, 22, 23, 24 only. Phase 19 and Phase 25 already have VERIFICATION.md.
- **Strategy:** Promote embedded SUMMARY/UAT/smoke evidence into structured frontmatter — do NOT re-run verification. The evidence already exists in:
  - Phase 20: `20-SUMMARY.md` (code-level only — flag explicitly as "Code verified, runtime not formally verified")
  - Phase 21: `21-UAT.md` (11/11 PASS for TOOL-05); plus inventory for TOOL-06/07 from `21-SHIPPED-INVENTORY.md`
  - Phase 22: `22-UAT.md` (6/8 PASS smoke + 2 manual pending) + 22-01..04 SUMMARYs
  - Phase 23: `23-01-SUMMARY.md` + `23-02-SUMMARY.md` (live curl tests 1-7 + dev-browser session)
  - Phase 24: `24-01-SUMMARY.md` (full prod e2e + 2 bug-fixes during verification)
- **Frontmatter shape:** Match existing 19-VERIFICATION.md and 25-VERIFICATION.md structure (status, score, human_verification list, requirements coverage table).

### D-07 — REQUIREMENTS.md orphan-add for WS-01..05
- **Locked:** Add WS-01..05 to the traceability table in REQUIREMENTS.md, marked `✅ Shipped (Phase 25)` with file:line evidence pointing to `25-VERIFICATION.md`.
- **Categorization:** New section heading `### Workspace Type Retirement` after the existing `### Share-Link Save (Phase 24)` section.
- **Wording:** Use the success criteria text from ROADMAP.md Phase 25 verbatim (do not paraphrase).

### D-08 — Nyquist VALIDATION.md backfill: deferred
- **Locked:** Defer to v2.2 backlog. Out of scope for Phase 27.
- **Why:** Backfilling VALIDATION.md for 7 phases would more than double the phase scope. The audit explicitly notes Nyquist is "Optional" and not a launch requirement.
- **Tradeoff:** Future audits will continue to flag phases 19-25 as Nyquist-incomplete. Acceptable trade for Phase 27 closure speed.

### D-09 — Plan structure
- **Locked:** Single plan covering all 9 in-scope items (D-01 through D-07 + D-11 through D-13). Estimated ~1 dev-day end-to-end. Two natural waves emerge:
  - **Wave 1 (Backend changes — can parallelize):** D-01 (mcp-server PROV-02), D-04 (regenerate_mcp_token RPC migration), D-05 (auto_create_default_workspace_entry trigger migration), D-11 (mcp-oauth-register fail-closed), D-12 (zoom-webhook OAuth header), D-13 (share-call audit log fix). All edit different files; deploy together via single `supabase functions deploy --use-api` + `supabase db push`.
  - **Wave 2 (Frontend / planning — depends on Wave 1):** D-03 (regenerate supabase.ts after migrations land — types must reflect new RPC return shape), D-06 (REQUIREMENTS.md update), D-07 (VERIFICATION.md backfills).
- **Sequential ordering matters within waves:**
  - D-03 must run AFTER D-04 (regenerate types AFTER the new RPC migration so generated types pick up the new `enabled_categories` column).
  - D-06 / D-07 are independent of code changes — can run anytime, but landing them last makes the closure commit cleaner.

### D-10 — Verification gates
- **Locked:** Phase 27 verification MUST include:
  1. curl test against PROV-02 (D-02)
  2. `tsc --noEmit` clean for mcp-token-capabilities.service.ts and mcp-tokens.service.ts after cast removal
  3. SQL spot-check that new `regenerate_mcp_token` RPC returns `enabled_categories` column
  4. Migration `pg_get_functiondef` confirms `auto_create_default_workspace_entry` references `is_default` not `is_home`
  5. REQUIREMENTS.md traceability table has 5 new WS-* rows with `[x]`
  6. 5 new VERIFICATION.md files exist in phase directories with valid frontmatter
  7. **CRITICAL D-11 verification:** Unit test or curl simulation: with `SUPABASE_ANON_KEY` deliberately unset, `mcp-oauth-register` returns 500 (NOT a 200 with admin-context proxy). Code grep confirms `??` fallback removed.
  8. **CRITICAL D-12 verification:** `zoom-webhook` request to test transcript URL via header succeeds (or token-in-URL pattern preserved with token-stripped logging). Code grep: `?access_token=` MUST be absent OR only inside a no-log code path.
  9. **CRITICAL D-13 verification:** curl `share-call?token=<valid>&log_access=true&accessor_user_id=fake-uuid` MUST NOT write `accessed_by_user_id=fake-uuid` to `call_share_access_log`. Either rejected OR audit-write skipped silently. SQL spot-check: 0 new rows from forged calls.

### D-11 — 🔴 CRITICAL: mcp-oauth-register fail-closed (security audit Critical #1)
- **Locked:** `supabase/functions/mcp-oauth-register/index.ts:29` change FROM:
  ```typescript
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  ```
  TO:
  ```typescript
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!anonKey) {
    console.error('mcp-oauth-register: SUPABASE_ANON_KEY is not configured');
    return new Response(
      JSON.stringify({ error: 'Service misconfigured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
  ```
- **Why critical:** This is an unauthenticated endpoint (designed for MCP clients to discover OAuth without prior credentials). If `SUPABASE_ANON_KEY` env var is ever unset (deploy misconfig, env reset, new project setup), the fallback silently uses `SUPABASE_SERVICE_ROLE_KEY` which bypasses ALL Row-Level Security. The key is then forwarded to Supabase Auth's OAuth Dynamic Client Registration endpoint, giving any anonymous caller the ability to register arbitrary OAuth clients with admin privileges.
- **Production impact:** Currently low-likelihood (anon key is set in production), but the fail-open design is a foot-gun waiting to discharge. The fix is mechanical and ~6 LOC.
- **Source:** Security audit Critical #1, file:line confirmed via `sed -n '20,40p'` spot-check during planning.
- **No new test framework needed.** Deno typecheck + a manual curl with `SUPABASE_ANON_KEY` deliberately unset (in a test deployment, NOT production) is sufficient verification.

### D-12 — 🔴 CRITICAL: zoom-webhook OAuth token in Authorization header (security audit Critical #2)
- **Locked:** `supabase/functions/zoom-webhook/index.ts:153` change FROM:
  ```typescript
  const urlWithToken = `${downloadUrl}?access_token=${accessToken}`;
  const response = await ZoomClient.fetchWithRetry(urlWithToken, { maxRetries: 3 });
  ```
  TO:
  ```typescript
  const response = await ZoomClient.fetchWithRetry(downloadUrl, {
    maxRetries: 3,
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  ```
- **Verify:** Zoom's Cloud Recording download endpoint accepts the `Authorization` header. Per Zoom Cloud Recording API docs, both query-param AND header-based bearer tokens are accepted. Header is strictly preferred — keeps the token out of URL/logs.
- **Fallback if Zoom requires query-param pattern only:** If empirical testing shows Zoom rejects header-based auth on this endpoint, keep the URL pattern but ensure NO `console.log` or error-handler ever logs the full URL with token. Add an explicit URL-stripping helper that masks `?access_token=…` before any log call.
- **Why critical:** OAuth tokens in URL query strings appear in HTTP access logs (Supabase Edge Functions log requests/responses), CDN logs, proxy logs, Zoom's own server logs, and any APM/monitoring tool that captures URLs. A leaked log = leaked OAuth token = unauthorized access to the user's Zoom recordings.
- **Source:** Security audit Critical #2, file:line confirmed via `sed -n '145,165p'` spot-check during planning.
- **Dev verification:** Read the full `fetchZoomTranscript` function during plan-phase to confirm `ZoomClient.fetchWithRetry` accepts `headers` option. If not, expand `_shared/zoom-client.ts` minimally to support it.
- **Test:** Trigger a webhook in dev (or replay a captured Zoom event) and confirm transcript downloads succeed. SQL: `SELECT count(*) FROM recordings WHERE source_app = 'zoom' AND created_at > NOW() - interval '1 hour'` increments after the test.

### D-13 — 🔴 CRITICAL: share-call audit log poisoning fix (security audit Critical #3)
- **Locked:** `supabase/functions/share-call/index.ts:218-287` (token-based GET handler) MUST stop trusting client-supplied `accessor_user_id` and `ip_address` query params for audit log writes.
- **Locked approach (decided):** **Approach (a) — derive identity from optional Authorization header**, NOT (b) drop logging. Reason: audit log retention has compliance value (knowing WHEN a share link was viewed); preserving it via JWT-derived identity gets the value without the trust hole.
- **Implementation:**
  ```typescript
  // Replace this block in share-call/index.ts (~lines 280-287):
  if (logAccess && accessorUserId) {
    await supabaseClient.from('call_share_access_log').insert({
      share_link_id: shareLink.id,
      accessed_by_user_id: accessorUserId,  // ← UNTRUSTED, REMOVE
      ip_address: ipAddress || null,         // ← UNTRUSTED, REMOVE
    });
  }

  // With:
  if (logAccess) {
    let derivedUserId: string | null = null;
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, '');
      const { data } = await supabase.auth.getUser(token);
      derivedUserId = data?.user?.id ?? null;
    }
    // IP from request headers, not query params:
    const derivedIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
    await supabaseClient.from('call_share_access_log').insert({
      share_link_id: shareLink.id,
      accessed_by_user_id: derivedUserId,  // null for anonymous viewers
      ip_address: derivedIp,
    });
    // Don't fail if logging fails — match existing comment "// Don't fail if logging fails - it's not critical"
  }
  ```
- **Why critical:** Anyone with a valid share token can craft a request like `GET /share-call?token=…&log_access=true&accessor_user_id=<victim-uuid>&ip_address=1.2.3.4`. The endpoint silently writes those values to `call_share_access_log`, polluting the audit trail with forged entries. Could be used for social engineering ("User X viewed your confidential call on date Y"), false evidence, or audit-trail destruction (mass-writing junk to drown signal).
- **Source:** Security audit Critical #3, file:line range confirmed via `sed -n '215,290p'` spot-check during planning.
- **Test:** curl `share-call?token=<valid>&log_access=true&accessor_user_id=00000000-0000-0000-0000-000000000000&ip_address=1.2.3.4` MUST NOT result in a `call_share_access_log` row with `accessed_by_user_id=00000000-...` or `ip_address=1.2.3.4`. SQL spot-check after the test.
- **Backwards compat:** The `&accessor_user_id` query param is silently ignored after this change (not parsed at all). Any frontend code that was setting it is now redundant — harmless to leave, but worth grepping for in the v2.2 cleanup.

### Claude's Discretion
- Migration timestamps (use `date +%Y%m%d%H%M%S` at execution time)
- Exact wording of -32001 plan-gating error message (D-01 has the canonical string from 19-02 SUMMARY)
- Whether to deploy migrations one at a time or batched (recommend batched via single `supabase db push`)
- Test data cleanup strategy after PROV-02 curl verification
- Whether to deploy `mcp-server` and `regenerate_mcp_token` deploy in a single `supabase functions deploy` + `db push` cycle or separate

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v2.1 Audit (the source of truth for Phase 27 scope)
- `.planning/v2.1-MILESTONE-AUDIT.md` — Full audit report. Every gap has file:line evidence + remediation. Reading this top-to-bottom is mandatory before planning.

### Affected source files (D-01 through D-05)
- `supabase/functions/mcp-server/index.ts:807-826` — Plan-gating block to re-enable (D-01)
- `src/types/supabase.ts` — Regenerate target (D-03)
- `src/services/mcp-tokens.service.ts:147` — Cast to remove (D-03)
- `src/services/mcp-token-capabilities.service.ts:50` — Cast to remove (D-03)
- `supabase/migrations/20260410153126_mcp_auto_provision.sql:152-173` — Original `regenerate_mcp_token` RPC (do NOT modify; create new migration per D-04)
- `supabase/migrations/20260308100000_cross_org_copy_and_auto_entry.sql:223` — Original `auto_create_default_workspace_entry` trigger (do NOT modify; create new migration per D-05)

### Existing VERIFICATION patterns (D-06 templates)
- `.planning/phases/19-provisioning-foundation/19-VERIFICATION.md` — Frontmatter structure for human_verification + must-haves table + requirements coverage
- `.planning/phases/25-workspace-type-retirement/25-VERIFICATION.md` — Same structure with success-criteria-status + gaps-found + recommendation

### Phase 27 source evidence files (D-06 backfill inputs)
- `.planning/phases/20-read-crud-tools/20-SUMMARY.md`
- `.planning/phases/21-write-crud-tools/21-01-SUMMARY.md` + `21-UAT.md` + `21-SHIPPED-INVENTORY.md`
- `.planning/phases/22-ai-tools/22-{01,02,03,04}-SUMMARY.md` + `22-UAT.md`
- `.planning/phases/23-management-ui/23-{01,02}-SUMMARY.md`
- `.planning/phases/24-fathom-share-link-save/24-01-SUMMARY.md`

### Project conventions
- `supabase/CLAUDE.md` — Migration naming (`YYYYMMDDHHMMSS_descriptive_name.sql`), `supabase functions deploy --use-api` (Docker NOT running on this machine — `--use-api` mandatory), RLS enable on all tables
- `CLAUDE.md` (root) — One-Click Promise, KISS-UX Principle, dev-browser for verification

### Requirements traceability target
- `.planning/REQUIREMENTS.md` — Traceability table at end of file (lines ~106-129) — D-07 inserts 5 new rows here
- `.planning/ROADMAP.md` Phase 25 (lines 165-179) — Source for WS-01..05 wording verbatim

</canonical_refs>

<specifics>
## Specific Ideas

- **PROV-02 fix is ~5 LOC.** Don't over-engineer it. Single line: `return mcpError(id, -32001, 'MCP access requires a Pro or Team plan. Upgrade at https://app.callvaultai.com/settings', corsHeaders);` inside the existing `if (!paid)` branch.

- **Type regeneration MAY reveal pre-existing errors.** Phase 25 Plan 02 documented 84 pre-existing TS errors in non-Phase-25 files. Same expectation here — only fix errors in files this phase touches (`mcp-tokens.service.ts`, `mcp-token-capabilities.service.ts`). Defer the rest to a v2.2 cleanup phase.

- **VERIFICATION.md backfill should be MECHANICAL — not creative.** Each backfill follows this template:
  ```yaml
  ---
  phase: {NN}-{slug}
  status: backfilled-from-evidence  # signals retroactive verification
  verified_at: 2026-05-07T{HH:MM}Z
  score: "Backfilled from {source} — see SUMMARY.md frontmatter for ship-date evidence"
  source_evidence:
    - "{NN}-SUMMARY.md"
    - "{NN}-UAT.md (if exists)"
    - "{NN}-SHIPPED-INVENTORY.md (if exists)"
  ---
  # Phase {NN} Verification (Backfilled 2026-05-07)
  > Promoted from embedded evidence — see source_evidence frontmatter.
  ## Goal
  [verbatim from ROADMAP]
  ## Success Criteria Status
  | # | Criterion | Status | Evidence |
  ...
  ```
  Just promote what's already in the SUMMARY.md — don't re-verify.

- **WS-01..05 wording for REQUIREMENTS.md traceability:** Take verbatim from ROADMAP.md Phase 25 success criteria #1-#7 (collapse 7 criteria into 5 reqs):
  - WS-01: No workspace_type selector in CreateWorkspaceDialog (criterion 1)
  - WS-02: No auto-creation of "Hall of Fame" / "Manager Reviews" folders (criterion 2)
  - WS-03: 2nd-pane workspace list reorderable per-user via DnD, persists across reloads + devices (criterion 3)
  - WS-04: Each org has exactly one is_default=TRUE workspace; cannot be deleted via UI or API (criteria 4 + 5)
  - WS-05: Lock vs team icon derived from member_count, no behavioral branches on workspace_type (criteria 6 + 7)

- **Migration deploy gotcha:** Phase 21-01 hit `supabase db push --include-all` requirement when migration timestamp was older than the most recently applied. Use `date +%Y%m%d%H%M%S` to ensure new migrations are strictly greater than the latest deployed.

</specifics>

<deferred>
## Deferred Ideas

- **Nyquist VALIDATION.md backfill** for phases 19-25 (D-08 — explicitly deferred to v2.2 backlog).
- **Capability-gating for 5 destructive bonus tools** (`delete_call`, `move_calls_to_workspace`, `copy_calls_to_organization`, `create_organization`, `create_workspace`) — flagged in audit tech_debt, defer to v2.2.
- **Cross-device concurrent reorder conflict resolution** (Phase 25 deferred — last-write-wins is fine for now).
- **Server-side RLS DELETE policy for is_default workspaces** (Phase 25 deferred — frontend + RPC guards sufficient).
- **Drop the `workspace_type` column entirely** (Phase 25 deferred — kept as legacy data).
- **84 pre-existing TS errors revealed by Phase 25 supabase.ts cleanup** — not caused by Phase 27, defer to v2.2 cleanup.
- **27 pre-existing failing tests** (sidebar-nav, tags.service, useSharing, useBulkApplyRules) — not caused by Phase 27, defer to v2.2 cleanup.
- **Cleanup of stale spec text in REQUIREMENTS.md** — REQUIREMENTS.md notes that TOOL-01 ships as `search_calls` not `search_transcripts`; multiple references are stale. Keep them stale per audit acknowledgment ("shipped names are canonical, spec text is stale").

</deferred>

---

*Phase: 27-close-v2-1-audit-gaps*
*Context generated 2026-05-07 from `.planning/v2.1-MILESTONE-AUDIT.md` (audit-as-PRD path; no discuss-phase ran).*
