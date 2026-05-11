# Roadmap: Callvault (brain)

## Milestones

- ✅ **v1.0 Foundation** - Pre-GSD (shipped before planning init)
- ✅ **v1.1 Sort/Filter Hardening** - Phases 1-10 (absorbed into v2.0)
- ✅ **v2.0 Launch Readiness** - Phases 11-18 (shipped 2026-03-30)
- ✅ **v2.1 MCP Production Infrastructure** - Phases 19-27 (shipped 2026-05-08) — see [milestones/v2.1-ROADMAP.md](./milestones/v2.1-ROADMAP.md)
- 📋 **v2.2 Security Hardening & UI Polish** - Phases 29-41 (in progress)

## Phases

<details>
<summary>✅ v1.0 Foundation - SHIPPED (pre-GSD, no phase plans)</summary>

Transcript library, filter bar, sorting, global search, URL persistence, folder/tag management, and Playwright infrastructure all shipped. Known issues carried forward into v1.1.

</details>

<details>
<summary>✅ v1.1 Sort/Filter Hardening - ABSORBED INTO v2.0</summary>

Phases 1-10 defined for filter/sort hardening. Milestone absorbed into v2.0 Launch Readiness — all filter/sort requirements carried forward as FILTER-01 through FILTER-05 in v2.0.

Phases 7-10 were stub phases (Drag-to-Folder, YouTube Workspace UI, Global Search/Notifications, Raw Call Details) — never planned, absorbed into v2.0 scope as needed.

</details>

<details>
<summary>✅ v2.0 Launch Readiness - SHIPPED (2026-03-30)</summary>

8 phases (11-18), 21 plans, 53 requirements. Org segregation, 4-pane layout, import flows, drag-to-folder, global search, onboarding E2E, members & roles, filters & sort, payments & billing, MCPs. See `milestones/v2.0-ROADMAP.md` for full details.

**Known tech debt:** 2 partial requirements (PAY-05 AI gate incomplete, MCP-04 operational config), 13 deferred human verification items.

</details>

<details>
<summary>✅ v2.1 MCP Production Infrastructure - SHIPPED 2026-05-08</summary>

9 phases (19-27), 16 plans, 26 active requirements satisfied + 5 WS reqs traced. Production-grade MCP server with auto-provisioning, plan gating, full read/write/AI/admin tool surface (41 tools), per-token capability toggles, vanity domain at api.callvaultai.com, paste-source recording flow, workspace_type retirement. 311 automated tests across 20 test files (Nyquist coverage for phases 19, 21-25). See `milestones/v2.1-ROADMAP.md` for full details.

**Phase highlights:**
- [x] Phase 19: Provisioning Foundation (auto-provision, plan gating, token regeneration)
- [x] Phase 20: Read CRUD Tools (17 read tools, backfilled)
- [x] Phase 21: Write CRUD Tools (17 write tools incl. create_note + call_notes table)
- [x] Phase 22: AI Tools (4 LLM tools: extract_action_items, ask_call, get_sentiment, get_coaching_notes)
- [x] Phase 23: Management UI (per-token capability toggles, dynamic categorized tool list)
- [x] Phase 24: Fathom Share-Link Save (paste-source recording flow, zero outbound HTTP)
- [x] Phase 25: Workspace Type Retirement (is_default + member_count derivations, drag-and-drop reorder)
- [x] Phase 26: MCP Polish (vanity domain api.callvaultai.com via Cloudflare Worker, UI cleanup)
- [x] Phase 27: v2.1 Audit Close-out (PROV-02 re-enabled, types regen, RPC fix, REQUIREMENTS traceability)

**Deferred to v2.2 backlog:** Phase 28 Security Hardening (3 Critical / 6 High findings from 2026-05-07 audit), MCP search_calls full_transcript scope, destructive-tools UAT, free-tier user live UAT.

</details>

---

### 📋 v2.2 — Security Hardening & UI Polish — IN PROGRESS

## Phase Details

### Phase 29: QA Sweep & Regression Catalog
**Goal**: Every visible production bug is documented as a QA-NN item in REQUIREMENTS.md before any fix work begins, so nothing is missed during the v2.2 milestone.
**Depends on**: Nothing (first phase — must run before any others)
**Requirements**: QA-01
**Success Criteria** (what must be TRUE):
  1. A dev-browser walkthrough of every page and user flow on production (app.callvaultai.com) has been completed
  2. Every observed bug or visual defect is recorded as a QA-NN requirement item in REQUIREMENTS.md
  3. Each new QA-NN item is mapped to an existing phase (or a new catch-all phase if needed)
  4. The catalog is complete enough that a developer could reproduce every finding from the written description alone
**Plans**: TBD
**UI hint**: yes

### Phase 30: UUID / Legacy-ID Root-Cause Fix
**Goal**: The `invalid input syntax for type uuid` error is eliminated so auto-AI-tags and the Folders column function correctly for all calls.
**Depends on**: Phase 29 (QA sweep may surface additional symptoms of the same root cause)
**Requirements**: BUG-01
**Success Criteria** (what must be TRUE):
  1. "Tag with AI" completes successfully for any call — no `invalid input syntax for type uuid: "143800259"` error in logs
  2. The Folders column in the 3rd-pane table shows the correct folder assignment for calls imported from Fathom
  3. No regression on calls imported from Zoom or manual paste (UUID-native sources unaffected)
**Plans**: TBD

### Phase 31: Auth, Signup & Payment Gate
**Goal**: New users can sign up end-to-end (Google or email), hit the pricing page before account creation, pass through the payment gate, and receive meaningful error messages on failure — closing the customer onboarding blocker.
**Depends on**: Phase 30 (auth errors may share root causes surfaced by the UUID fix)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05
**Success Criteria** (what must be TRUE):
  1. A net-new email signup completes without "An unexpected error occurred" and creates a usable, org-scoped account
  2. The pricing/plan-selection page is shown before account creation — no free-tier bypass is possible
  3. The payment gate is enforced: any non-grandfathered account reaching /onboarding without a paid plan is redirected to pricing
  4. Signup failure surfaces the actual reason ("This email is already registered", "Password too short") rather than a generic error
  5. Google sign-in redirects to the correct error page when the authenticated user is not the authorized recipient of a shared call
**Plans**: TBD
**UI hint**: yes

### Phase 32: Shared-Call Public Landing Page
**Goal**: Recipients of a shared call link see a Loom-style landing page (not a bare signin wall) that identifies the sender and call, offers clear paths to sign up or sign in, and surfaces useful error messages when account mismatch occurs.
**Depends on**: Phase 31 (auth flows must be working before the landing page can complete its sign-up path)
**Requirements**: SHARE-01, SHARE-02, SHARE-03, SHARE-04
**Success Criteria** (what must be TRUE):
  1. `/s/:token` renders a public landing page showing the inviter's name, call title, and two CTAs — "Sign up to view" and "Open in existing account" — without requiring authentication
  2. A recipient signed in as the wrong account sees "This call was shared with na***@gmail.com — sign out and sign in with that email" with an explicit logout button
  3. The Share Call modal has no spurious orange/red field borders, no broken icon next to the email field, and fits within its parent dialog without overflow
  4. The end-to-end flow works: sender creates share link → recipient clicks → recipient (correct account) can view the call
**Plans**: TBD
**UI hint**: yes

### Phase 33: Selection State System
**Goal**: A single canonical selection-state pattern (orange pill, gray highlight, bold text, orange-ring icon) is applied consistently across sidebar, 2nd-pane workspace selector, Settings tabs, and Call Detail modal tabs, replacing the current mixed styles.
**Depends on**: Phase 29 (QA sweep confirms current state of all selection surfaces)
**Requirements**: VIS-01, VIS-02, VIS-03, VIS-04, VIS-05
**Success Criteria** (what must be TRUE):
  1. Sidebar nav items show the canonical pattern when active: vertical orange pill on left edge, gray rounded highlight, bold label, icon in rounded square with orange ring and white/black background
  2. The 2nd-pane workspace selector uses the same canonical pattern (no divergent treatment)
  3. Settings tabs (Account / Billing / Organizations / AI Integrations / Admin) use the canonical pattern instead of the orange-underline-pill
  4. Call Detail modal tabs (Overview / Transcript / Invitees / Participants) use the canonical pattern
  5. Settings > Organizations org-tab strip is replaced with a 2nd-pane dropdown selector consistent with the rest of the app
**Plans**: TBD
**UI hint**: yes

### Phase 34: Sidebar, Layout & Brand Polish
**Goal**: The sidebar order, capitalization, and layout are standardized, and miscellaneous visual defects (doubled close buttons, inconsistent padding, search modal styling, spurious borders) are resolved across the shell.
**Depends on**: Phase 33 (selection state must be canonical before further polish is applied on top)
**Requirements**: BRAND-01, BRAND-02, BRAND-03, BRAND-04, BRAND-05, BRAND-06, BRAND-07, BRAND-08, BRAND-09, BRAND-10
**Success Criteria** (what must be TRUE):
  1. Sidebar sections appear in order: CALLS → IMPORT → RULES → PEOPLE → ORGANIZATION, with all primary titles in UPPERCASE
  2. Workspace title in the 2nd pane renders bold-only (not bold-italic)
  3. The organization box at the top of the 2nd pane and the top-bar org selector share the same width and have equal left/right/bottom padding
  4. No doubled X close button appears anywhere in the shell; the global search input has rounded corners and consistent brand styling
  5. Settings > Organizations page header shows the selected org's name and description rather than the generic "Workspaces" header
**Plans**: TBD
**UI hint**: yes

### Phase 35: Table, Filters & DND Cleanup
**Goal**: The 3rd-pane recording table is cleaned up (Shared column removed, Folders column live, alignment standardized), redundant filter pills are removed, remaining filters work correctly, and drag-and-drop handles are stable and easy to grab.
**Depends on**: Phase 30 (TABLE-02 — Folders column — requires BUG-01 UUID fix to be complete)
**Requirements**: TABLE-01, TABLE-02, TABLE-03, FILTER-01, FILTER-02, FILTER-03, FILTER-04, DND-01, DND-02, CARD-01, CARD-02
**Success Criteria** (what must be TRUE):
  1. The Shared column no longer appears in the recording table; the Folders column shows the correct assignment for every call
  2. Folder and Duration filter pills are absent from the filter bar
  3. The Contacts filter returns results from the full contacts database (searching "Phill" returns Phill Tomlinson)
  4. Source filter Apply/Clear buttons are fully visible within the popover; second-row source pills are visible without requiring hover
  5. Drag handles are position-stable (do not shift on selection) and cover the left ⅓–½ of the card; whole workspace cards and org cards are clickable without requiring chevron precision
**Plans**: TBD
**UI hint**: yes

### Phase 36: Critical Bug Sweep
**Goal**: All remaining high-impact bugs across the app (workspace update failures, cache staleness, date sort order, import UI gaps, auto-folder creation, dialog accessibility) are resolved, leaving no known regressions.
**Depends on**: Phase 35 (import UI changes in BUG-05/06/07 are adjacent to table/DND work)
**Requirements**: BUG-02, BUG-03, BUG-04, BUG-05, BUG-06, BUG-07, BUG-08, BUG-09
**Success Criteria** (what must be TRUE):
  1. Toggling default-workspace in the Workspace Detail panel succeeds without a "Failed to update workspace" toast
  2. Moving, deleting, or tagging a call updates the table immediately without a manual page reload; toast success and table state agree
  3. Date sort is strictly chronological in both ascending and descending directions with no out-of-order jumps
  4. A manual paste/upload transcript entry point is visible and functional in the Import UI; Import History and "+" buttons both work
  5. "Hall of Fame" and "Manager Reviews" folders are not auto-created on workspace creation; all modals have accessible DialogDescription (no console warnings)
**Plans**: TBD
**UI hint**: yes

### Phase 37: Edge Function Security Hardening (Deferred Phase 28 + Audit Close + Orphan Cleanup)
**Goal**: The 6 High findings from the 2026-05-07 audit (originally planned as v2.1 Phase 28, deferred — never executed) are fixed, the 4 remaining Medium/Low polar-webhook items are closed, 25-30 functions are migrated to `_shared/auth.ts`, a fresh comprehensive audit produces a documented report with all new Critical/High items fixed, and the deployed vs source delta is reconciled with all confirmed-dead functions deleted from production.
**Depends on**: Phase 29 (QA sweep may surface additional edge function issues)
**Requirements**: SEC-01A, SEC-01B, SEC-01C, SEC-01D, SEC-02A, SEC-02B, SEC-05A, SEC-05B, SEC-05C, SEC-06, SEC-07, SEC-08, SEC-09, SEC-10, SEC-11, SEC-12 *(SEC-01E already validated done 2026-05-11)*
**Success Criteria** (what must be TRUE):
  1. **Deferred Phase 28 High findings closed:** `zoom-webhook` uses `crypto.subtle.timingSafeEqual` for HMAC, both `zoom-webhook` and `polar-webhook` reject signatures older than 5 minutes, `file-upload-transcribe` validates magic bytes and streams uploads, `fathom-oauth-callback` encrypts OAuth tokens at rest via `pgcrypto`, `send-org-invite` HTML-escapes all email-body interpolations, `share-call` requires a recordings row before allowing share-link creation, `polar-webhook` has an event-ID idempotency table
  2. **polar-webhook hardened:** duplicate subscription handlers refactored to single helper, MCP provisioning wrapped in `EdgeRuntime.waitUntil`, CORS apparatus stripped entirely, error responses return generic `'Internal error'` with full detail logged via `console.error`
  3. **Shared-auth migration:** 25-30 user-JWT-authenticated functions migrated to `_shared/auth.ts authenticateRequest()`; zero `authHeader.replace('Bearer ', '')` remaining outside the exempt list (webhooks + OAuth metadata)
  4. **Fresh audit report** at `.planning/security/2026-05-Q2-edge-audit.md` with severity-rated findings for all 38 functions; every new Critical and High fixed before phase closes
  5. **Deployed-vs-source reconciliation:** `supabase functions list` snapshot saved; every deployed-but-not-in-source function cross-referenced for callers; all confirmed orphans deleted; final deployed count == source count ± documented exceptions
**Plans**: TBD

### Phase 38: Frontend Security & RLS Audit
**Goal**: The frontend codebase and database policies are audited and hardened — zero high/critical npm vulnerabilities, no cross-org cache leaks, OAuth tokens never touch the client, service-role usage documented per function, and a CI-enforced RLS regression test guards against future RLS bypass.
**Depends on**: Phase 37 (edge function security baseline must be established first)
**Requirements**: SEC-03A, SEC-03B, SEC-03C, SEC-03D, SEC-04A, SEC-04B, SEC-04C
**Success Criteria** (what must be TRUE):
  1. **npm audit clean** — `npm audit --production` returns 0 critical and 0 high vulnerabilities. The current transitive lodash high is resolved via override or dependency bump. Remaining moderate findings (dompurify, esbuild, postcss, vite) are addressed where cleanly possible, deferred ones documented
  2. **No cross-org data leak** — Dev-browser switching between two orgs verifies React Query cache contains zero references to the previous org's call/folder/tag data
  3. **No OAuth tokens in client** — Audit confirms Google/Fathom/Zoom raw tokens exist only server-side; only Supabase JWT is in client memory
  4. **Service-role rationale documented** — Each of the 35 edge functions using `SUPABASE_SERVICE_ROLE_KEY` has a top-of-file comment `// service-role required: <reason>`. Any function that can't justify it is migrated to anon+RLS
  5. **Defense-in-depth filters confirmed** — Every service-role function that touches user data has explicit `.eq('org_id', ...)` or `.eq('user_id', ...)` filters present even where RLS provides coverage
  6. **RLS regression test on CI** — A smoke test creates 2 orgs, attempts cross-org queries from each, confirms 0 rows returned. Test runs on every CI build
**Plans**: TBD

### Phase 39: Fathom Mirror
**Goal**: Fathom searches return in under 200ms by reading from the local `fathom_raw_calls` mirror table instead of hitting Fathom's API, with new-user backfill and a daily reconciliation cron keeping the mirror current.
**Depends on**: Phase 30 (UUID fix must be stable before adding new Fathom data pipeline logic)
**Requirements**: FEAT-01
**Success Criteria** (what must be TRUE):
  1. A 30-day Fathom search returns in under 200ms p95 (measured via dev-browser network panel) compared to the current 1-7s range
  2. A newly connected Fathom account has its full call history populated in `fathom_raw_calls` within 2 minutes of OAuth completion
  3. The daily reconciliation cron closes any gaps between `fathom_raw_calls` and Fathom's API (the 7-row gap on the test account is closed)
  4. A user with 2+ Fathom accounts sees meetings from all accounts routed to their library
  5. `create-fathom-webhook` is restored to source control and auto-fires on Fathom OAuth callback
**Plans**: TBD

### Phase 40: Fathom Re-import / Overwrite
**Goal**: Users can force-reimport a Fathom call to pull in updated title, transcript, summary, and duration from Fathom while preserving the call's UUID, workspace, tags, and folder assignments.
**Depends on**: Phase 39 (Fathom Mirror must be in place as the data source for re-import)
**Requirements**: FEAT-02
**Success Criteria** (what must be TRUE):
  1. A "Refresh from Fathom" action is exposed in the Fathom import detail panel (or call detail view)
  2. Triggering the action updates the call's title, transcript, summary, and duration from Fathom without creating a duplicate
  3. After re-import, the call's UUID, workspace assignments, tags, and folder assignments are unchanged
  4. A call not found in Fathom (deleted upstream) surfaces a clear error rather than silently failing
**Plans**: TBD
**UI hint**: yes

### Phase 41: v2.0 / v2.1 Tech Debt Closure
**Goal**: All three carried-forward tech debt items are resolved — the 2 ungated AI features are payment-gated, MCP operational config is complete, and the 13 deferred v2.0 human-verification items are audited and either fixed or formally documented as accepted.
**Depends on**: Phase 38 (security posture must be confirmed before locking down AI gating)
**Requirements**: DEBT-01, DEBT-02, DEBT-03
**Success Criteria** (what must be TRUE):
  1. The 2 remaining AI features are gated through `useAiGate` + `track-ai-usage` — attempting to use them on a free plan returns the upgrade prompt
  2. MCP operational config is complete: env vars documented, monitoring configured, runbook written and accessible
  3. All 13 deferred v2.0 human-verification items have been visited in dev-browser; each is either fixed (with commit) or has a documented acceptance note in STATE.md explaining why it is acceptable
**Plans**: TBD
**UI hint**: yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 29. QA Sweep & Regression Catalog | 0/TBD | Not started | - |
| 30. UUID / Legacy-ID Root-Cause Fix | 0/TBD | Not started | - |
| 31. Auth, Signup & Payment Gate | 0/TBD | Not started | - |
| 32. Shared-Call Public Landing Page | 0/TBD | Not started | - |
| 33. Selection State System | 0/TBD | Not started | - |
| 34. Sidebar, Layout & Brand Polish | 0/TBD | Not started | - |
| 35. Table, Filters & DND Cleanup | 0/TBD | Not started | - |
| 36. Critical Bug Sweep | 0/TBD | Not started | - |
| 37. Edge Function Security Hardening (Deferred P28 + Audit + Orphans) | 0/TBD | Not started | - |
| 38. Frontend Security & RLS Audit | 0/TBD | Not started | - |
| 39. Fathom Mirror | 0/TBD | Not started | - |
| 40. Fathom Re-import / Overwrite | 0/TBD | Not started | - |
| 41. v2.0 / v2.1 Tech Debt Closure | 0/TBD | Not started | - |

---

*Last updated: 2026-05-11 — v2.2 Security Hardening & UI Polish roadmap created (Phases 29-41)*
