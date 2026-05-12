---
phase: 37
phase_name: Edge Function Security Hardening
researched: 2026-05-12
status: Ready for planning
---

# Phase 37: Edge Function Security Hardening — Technical Research

## Current State (Audited 2026-05-12)

### SEC-06..12 (deferred Phase 28 High findings)

**Verified against live source — many already implemented after CONTEXT.md was written:**

| ID | Item | Source State | Action Needed |
|----|------|--------------|---------------|
| SEC-06 | zoom-webhook timing-safe HMAC | DONE — `crypto.subtle.timingSafeEqual` at `zoom-webhook/index.ts:54-58` | Add unit test, mark complete |
| SEC-07 (zoom) | zoom-webhook 5-min replay window | DONE — `MAX_AGE_MS = 5*60*1000` check at `zoom-webhook/index.ts:752-780` | Add unit test, mark complete |
| SEC-07 (polar) | polar-webhook replay window | DONE — Svix SDK enforces 5-min tolerance natively (see comment `polar-webhook/index.ts:81-84`) | Document, mark complete |
| SEC-08 | file-upload magic-byte validation | DONE — `validateMagicBytes()` covers MP3/WAV/MP4/M4A/MOV/WebM at `file-upload-transcribe/index.ts:18-61` | Add unit test for forged MIME |
| SEC-08 (streaming) | file-upload streaming | NOT DONE — still uses `req.formData()` which buffers full 25MB | Defer to v2.3 BACKLOG; magic-byte fix closes the security risk |
| SEC-09 | fathom-oauth-callback token encryption | DONE — uses `store_encrypted_oauth_tokens` RPC + pgcrypto when `OAUTH_ENCRYPTION_KEY` set; falls back to plaintext if missing | Write one-shot migration to encrypt existing plaintext rows |
| SEC-10 | send-org-invite HTML escape | DONE — uses `escapeHtml()` from `_shared/html-escape.ts` | Audit other email-sending functions |
| SEC-11 | share-call recordings-row gate | DONE — `handleCreateShareLink` returns 403 if no recording row exists (`share-call/index.ts:152-157`) | Verify Phase 32 won't regress; coordinate |
| SEC-12 | polar-webhook idempotency | DONE — `processed_webhooks` table check at `polar-webhook/index.ts:91-121` + insert at `153-164` | Add integration test |

### SEC-01A..D (polar-webhook hardening)

**Not done — all 4 items still applicable per live source:**

| ID | Item | Action Needed |
|----|------|---------------|
| SEC-01A | DRY refactor `handleSubscriptionCreated`/`Active` | Extract `upsertSubscription()` helper |
| SEC-01B | MCP provisioning async | Wrap `provisionMcpTokenForUser()` calls in `EdgeRuntime.waitUntil(...)` |
| SEC-01C | Strip CORS | Remove `getCorsHeaders` import + OPTIONS preflight + `corsHeaders` spreads |
| SEC-01D | Generic error responses | Replace `error.message` leak at `:171-178` with `"Internal error"` |

### SEC-02A (shared-auth migration)

**27 functions still use `authHeader.replace('Bearer ', '')`:**

```
apply-routing-rules, auto-tag-calls, create-fathom-webhook,
fathom-oauth-refresh, fathom-oauth-url, fetch-meetings,
generate-ai-titles, generate-content, global-search, mcp-server,
polar-cancel, polar-checkout, polar-create-customer, polar-customer-state,
save-host-email, save-pasted-transcript, split-recording, summarize-call,
sync-meetings, track-ai-usage, youtube-api, youtube-import,
zoom-fetch-meetings, zoom-oauth-callback, zoom-oauth-refresh, zoom-oauth-url,
zoom-sync-meetings
```

**Exempt from migration (legitimately no JWT):**
- `polar-webhook` — Svix signature
- `zoom-webhook` — Zoom HMAC signature
- `webhook` — legacy public webhook receiver (check)
- `mcp-oauth-metadata` — public OAuth metadata endpoint (no auth)
- `mcp-oauth-register` — OAuth DCR endpoint (no JWT yet)
- `teams` — needs investigation (currently no `authHeader.replace` either — check whether deprecated)
- `fetch-single-meeting` — no `authHeader.replace` — check whether deprecated
- `polar-customer-state` — currently has `authHeader.replace` but may be legit if Polar-signed
- All `*-oauth-callback` functions that handle code-exchange before JWT exists (only zoom-oauth-callback in current list — fathom is already migrated)

**Decision:** Migrate the 27 functions that have `authHeader.replace` (some of these like `polar-cancel`, `polar-create-customer`, `polar-customer-state` are user-JWT-authenticated). Exclude OAuth callbacks (zoom-oauth-callback uses code-exchange OR JWT — verify). Final target: 22-25 migrated.

### SEC-05A..C (deployed-vs-source orphan reconciliation)

**Source count:** 38 functions in `supabase/functions/`
**Deployed count:** 76 functions per `supabase functions list` (audited 2026-05-12)

**Confirmed orphans (deployed, no source) — all candidates for auto-delete:**

```
save-webhook-secret, get-config-status, save-fathom-key, test-fathom-connection,
resync-all-calls, test-env-vars, test-secrets, get-available-models,
sync-openrouter-models, team-memberships, team-direct-reports, team-shares,
coach-relationships, coach-shares, coach-notes, manager-notes, extract-knowledge,
google-meet-fetch-meetings, automation-webhook, automation-engine,
automation-email, automation-sentiment, google-oauth-url, google-oauth-callback,
automation-scheduler, google-meet-sync-meetings, google-oauth-refresh,
content-classifier, content-insight-miner, content-hook-generator,
content-builder, google-poll-sync, send-coach-invite, extract-action-items,
extract-profits, check-client-health, migrate-recordings,
bulk-apply-routing-rules, delete-all-calls
```

**Per CONTEXT.md decision:** Auto-delete confirmed-dead (zero callers in repo + zero recent logs). Phase 27 also documented orphan cleanup.

**Per ROADMAP Phase 17 history:** FOUND-09 removed Google Meet entirely; google-meet-* functions are dead.
**Per HARD CONSTRAINT in CLAUDE.md:** "Zero Google Meet references" — confirms google-meet-* deletable.
**Per CLAUDE.md:** Many other deployed functions belong to old features (coach, team-*, automation-*, content-*) — these are v1 artifacts.

**Verification strategy:** Confirm zero callers via `git log -p src/ supabase/functions/ --since="120 days" | grep <name>` per orphan. Anything with hits → ambiguous list.

### SEC-02B (fresh audit)

**Source count:** 38 functions. Required output: `.planning/security/2026-05-Q2-edge-audit.md` with severity-rated findings per function for the 12-item checklist.

## Validation Architecture

**Critical items must be exercised via test:**
1. SEC-06: Wrong-signature → 401 (timing-safe ensures constant-time, can't unit-test timing directly, but verify behavior)
2. SEC-07: Stale-timestamp (>5min old or >60s future) → 401
3. SEC-08: Forged MIME (jpeg bytes with `audio/mpeg` claim) → 400
4. SEC-09: Token encryption roundtrip (insert → read → decrypt → compare)
5. SEC-10: HTML injection in invite (orgName = `<script>` → escaped in output)
6. SEC-12: Duplicate webhook ID → 200 `already_processed`, no DB writes

## Locked Decisions (from CONTEXT.md)

- Auto-delete confirmed-dead orphans; list ambiguous
- Shared-auth migration: skip webhooks, OAuth callbacks, public token paths
- Token encryption: `OAUTH_ENCRYPTION_KEY` env var + pgcrypto + one-shot encrypt-existing migration
- Atomic commits per SEC-NN
- Coordinate with Phase 32 (which currently only has CONTEXT — no code yet, so we own SEC-11 cleanly)
