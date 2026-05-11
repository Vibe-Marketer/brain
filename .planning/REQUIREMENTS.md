# v2.2 Requirements — Security Hardening & UI Polish

**Milestone:** v2.2
**Started:** 2026-05-11
**Goal:** Close every known production bug, complete remaining security audit items, and ship 3 backlog features so v2.2 is a clean, secure foundation before the next feature push.

---

## Active Requirements

### Foundation (must run first)

- [ ] **QA-01** — Dev-browser walkthrough of every page/flow on production produces a regression catalog appended to this file (any new bugs found get appended as `QA-NN` items and mapped into existing phases or a new catch-all phase)

### Auth, Signup & Payment Gate (front-door — highest priority)

- [ ] **AUTH-01** — Email signup completes successfully and creates a usable account (currently fails with "An unexpected error occurred")
- [ ] **AUTH-02** — Pricing / plan-selection page is shown before account creation (no silent free-tier bypass)
- [ ] **AUTH-03** — Payment gate enforced before onboarding — `soren@vibeos.com` and any other non-grandfathered account must hit pricing, not the onboarding wizard
- [ ] **AUTH-04** — Signup failure surfaces a useful message ("This email is already registered", "Password too short", etc.) instead of generic "unexpected error"
- [ ] **AUTH-05** — Google sign-in error path explains the actual issue (not "call not found" when the user is authenticated but the call wasn't shared with them)

### Shared-Call Public Surface

- [ ] **SHARE-01** — `/s/:token` route shows a public landing page (Loom/Zoom style) that names the inviter, names the call, and offers "sign up to view" + "view in your existing account" — replaces the bare signin redirect
- [ ] **SHARE-02** — Wrong-account error shows "This call was shared with na***@gmail.com — sign out and sign in with that email" with explicit logout button (currently shows "Call Not Found / invalid or expired")
- [ ] **SHARE-03** — Share Call modal visual cleanup: remove the spurious orange/red field-borders, fix the broken-looking red dots icon next to the email field, fix overflow against the parent dialog
- [ ] **SHARE-04** — Single-call share still works end-to-end (sender creates link → receiver clicks → receiver sees call)

### Critical Root-Cause Bugs

- [ ] **BUG-01** — Fix `invalid input syntax for type uuid: "143800259"` error on assignment loading — code path is passing the numeric Fathom `source_call_id` where a recording UUID is required. **This fix unblocks two visible symptoms: (a) auto-AI-tags failing on "Tag with AI", (b) Folders column blank for most calls.**
- [ ] **BUG-02** — Fix `HTTP 406 PGRST116` on `PATCH /workspaces` — root cause of the "Failed to update workspace" toast. Triggered by toggling default-workspace in the Workspace Detail panel
- [ ] **BUG-03** — Call list refreshes immediately after mutations (move, delete, tag) — no manual page reload required. Toast success and table state must agree
- [ ] **BUG-04** — Date sort is strictly chronological. No more Apr → Nov → Mar jumps in the same column direction
- [ ] **BUG-05** — Manual paste/upload transcript flow is exposed in the UI. Currently the route exists (the "Q3 Sales Sync" test call proves it) but there's no entry point on Import or anywhere else
- [ ] **BUG-06** — "Import History" button in the Import Source Manager actually shows import history
- [ ] **BUG-07** — "+" button at the top of Import Source Manager actually adds a new source
- [ ] **BUG-08** — Auto-creation of "Hall of Fame" and "Manager Reviews" folders is removed (verify it isn't running)
- [ ] **BUG-09** — `DialogContent` accessibility warnings resolved — every modal has a `DialogDescription` (use `<VisuallyHidden>` when description is implicit)

### Selection State System (one canonical pattern, applied everywhere)

**Canonical pattern:** vertical orange pill on left edge, gray rounded highlight, BOLD (not bold-italic) title, icon in rounded square with orange ring around the icon and white bg (light mode) / black bg (dark mode).

- [ ] **VIS-01** — Sidebar selection state matches canonical pattern (currently icons show gray bg, missing orange ring)
- [ ] **VIS-02** — 2nd pane workspace selector matches canonical pattern
- [ ] **VIS-03** — Settings tab list (Account / Billing / Organizations / AI Integrations / Admin) matches canonical pattern (currently uses orange-underline-pill)
- [ ] **VIS-04** — Call Detail modal tabs (Overview / Transcript / Invitees / Participants) match canonical pattern (currently uses orange-underline-pill)
- [ ] **VIS-05** — Settings > Organizations org-tab strip ("AI SIMPLE | BUSINESS | GOVIBEY") replaced with a 2nd-pane dropdown selector that matches the rest of the app

### Sidebar Order & Caps

- [ ] **BRAND-01** — Sidebar order: **CALLS → IMPORT → RULES → PEOPLE → ORGANIZATION**
- [ ] **BRAND-02** — All primary sidebar / 2nd-pane titles are UPPERCASE (CALLS, PEOPLE, ORGANIZATION, IMPORT, RULES, NAVIGATION, MY CALLS, etc.)
- [ ] **BRAND-03** — Workspace title in 2nd pane is **bold only** (currently bold + italic)

### Layout & Brand Polish

- [ ] **BRAND-04** — Organization box at top of 2nd pane fills the full width with equal padding (left / right / bottom). Currently flex-sized
- [ ] **BRAND-05** — Top-bar org selector width matches the 2nd-pane org box width
- [ ] **BRAND-06** — "ALL" link in Home 2nd pane is dark enough to read (currently too light)
- [ ] **BRAND-07** — Doubled X close button in (per Image #7) — one instance remains
- [ ] **BRAND-08** — Global search modal: rounded corners on the search input, brand-consistent styling (matches Cmd+K dialog elsewhere)
- [ ] **BRAND-09** — "MEMBERSHIPS" and "WORKSPACE MEMBERS | TESTING" headings in Workspace Detail panel don't have stray box-creating borders
- [ ] **BRAND-10** — Settings > Organizations page header shows the selected org's name + description (e.g. "AI Simple — Your personal organization for private recordings") instead of generic "Workspaces / Manage your organizational structure and collaboration workspaces"

### Table & Column Cleanup (3rd pane)

- [ ] **TABLE-01** — "Shared" column removed from the 3rd pane recording table
- [ ] **TABLE-02** — "Folders" column reflects current folder assignment for every call (depends on BUG-01)
- [ ] **TABLE-03** — Column alignment standardized — recommend left-aligned for text columns, or whatever looks best, but consistent

### Filters (3rd pane)

- [ ] **FILTER-01** — Folder filter removed (redundant — folder selection is the 2nd pane)
- [ ] **FILTER-02** — Duration filter removed (low-value)
- [ ] **FILTER-03** — Contacts filter queries the full contacts DB, not just invitees/attendees. Searching "Phill" should return Phill Tomlinson
- [ ] **FILTER-04** — Source filter: Apply/Clear buttons fit within the popover (currently overflow), and the second row of source pills is visible without hover

### DND

- [ ] **DND-01** — Drag target is position-stable — it does NOT shift when the underlying item is selected
- [ ] **DND-02** — Drag target enlarged to occupy the left ⅓–½ of the card (centered around the icon next to the title) — much easier to grab

### Card Click Targets

- [ ] **CARD-01** — Whole workspace card is clickable to open Pane 4 (currently must hit the chevron exactly)
- [ ] **CARD-02** — Same rule applied to any other cards that only had chevron-precision click targets

### Security Hardening

- [ ] **SEC-01** — 5 remaining Medium/Low findings from the 2026-05-07 audit closed: polar-webhook DRY refactor, in-band MCP provisioning moved to async, CORS cleanup on server-to-server endpoints, generic error responses on polar-webhook, brittle `authHeader.replace('Bearer ', '')` replaced with `_shared/auth.ts`
- [ ] **SEC-02** — Fresh comprehensive edge-function audit (all Edge Functions in `supabase/functions/`) — produces a new findings list and fixes everything Critical / High
- [ ] **SEC-03** — Frontend security review — XSS, exposed secrets, OAuth token handling, dependency vulnerabilities (`npm audit`), React Query cache leaks
- [ ] **SEC-04** — RLS / database policy audit — every user-facing table has RLS enabled, service-role usage limited to server-to-server, explicit `.eq('org_id')` filters present even with RLS coverage (defense-in-depth)
- [ ] **SEC-05** — Edge Function orphan cleanup — delete 39 confirmed-dead Edge Functions from production (per BACKLOG.md catalog), keep only the 35 in source + `global-search` + `teams`

### Backlog Features (mixed in)

- [ ] **FEAT-01** — Fathom Mirror: `fetch-meetings` reads from `fathom_raw_calls` mirror table instead of hitting Fathom API. Includes new-user backfill + reconciliation cron + multi-account-per-user routing + bringing `create-fathom-webhook` back into source control
- [ ] **FEAT-02** — Fathom re-import / overwrite: add force-reimport flag to sync pipeline so a renamed/updated Fathom call updates the existing recording (title, transcript, summary, duration) while preserving UUID + workspace + tags + folder assignments

### Tech Debt (carried forward from v2.0 / v2.1)

- [ ] **DEBT-01** — PAY-05 — the 2 remaining AI features are gated through `useAiGate` + `track-ai-usage`
- [ ] **DEBT-02** — MCP-04 — operational config complete (env vars, monitoring, runbook)
- [ ] **DEBT-03** — Close the 13 deferred human-verification items from v2.0 (audit, verify each, fix or document)

---

## Future Requirements (captured to BACKLOG, not v2.2)

- Public share-link option (no account required to view)
- "View without account" mode on shared-call landing page (coming-soon CTA in v2.2; live in v2.3+)
- Markdown rendering throughout app surfaces

---

## Out of Scope

- Real-time collaboration features
- Mobile native app
- Cross-org admin view
- Import from other users as a source
- Ownership transfer
- MCP marketplace / third-party tool integrations
- MCP rate limiting / usage analytics dashboard

---

## Traceability

| Req ID | Description | Phase | Status |
|--------|-------------|-------|--------|
| QA-01 | Dev-browser QA sweep + regression catalog | Phase 29 | Active |
| AUTH-01 | Email signup completes successfully | Phase 31 | Active |
| AUTH-02 | Pricing page shown before account creation | Phase 31 | Active |
| AUTH-03 | Payment gate enforced before onboarding | Phase 31 | Active |
| AUTH-04 | Signup failure surfaces useful error message | Phase 31 | Active |
| AUTH-05 | Google sign-in error path explains actual issue | Phase 31 | Active |
| SHARE-01 | Public landing page replaces bare signin redirect | Phase 32 | Active |
| SHARE-02 | Wrong-account error shows which email was authorized | Phase 32 | Active |
| SHARE-03 | Share Call modal visual cleanup | Phase 32 | Active |
| SHARE-04 | Single-call share works end-to-end | Phase 32 | Active |
| BUG-01 | UUID/legacy-ID root cause (unblocks tags + folders) | Phase 30 | Active |
| BUG-02 | Workspace update 406 PGRST116 | Phase 36 | Active |
| BUG-03 | Cache invalidation on mutations | Phase 36 | Active |
| BUG-04 | Date sort chronological | Phase 36 | Active |
| BUG-05 | Manual paste/upload UI exposed | Phase 36 | Active |
| BUG-06 | Import History button | Phase 36 | Active |
| BUG-07 | Import "+" button | Phase 36 | Active |
| BUG-08 | Hall of Fame / Manager Reviews auto-create removed | Phase 36 | Active |
| BUG-09 | Dialog accessibility | Phase 36 | Active |
| VIS-01 | Sidebar canonical selection pattern | Phase 33 | Active |
| VIS-02 | 2nd-pane workspace selector canonical pattern | Phase 33 | Active |
| VIS-03 | Settings tab list canonical pattern | Phase 33 | Active |
| VIS-04 | Call Detail modal tabs canonical pattern | Phase 33 | Active |
| VIS-05 | Settings > Organizations replaced with dropdown | Phase 33 | Active |
| BRAND-01 | Sidebar order: CALLS → IMPORT → RULES → PEOPLE → ORGANIZATION | Phase 34 | Active |
| BRAND-02 | All sidebar titles UPPERCASE | Phase 34 | Active |
| BRAND-03 | Workspace title bold-only (remove italic) | Phase 34 | Active |
| BRAND-04 | Org box full width with equal padding | Phase 34 | Active |
| BRAND-05 | Top-bar org selector width matches 2nd pane | Phase 34 | Active |
| BRAND-06 | "ALL" link darkened for visibility | Phase 34 | Active |
| BRAND-07 | Doubled X close button fixed | Phase 34 | Active |
| BRAND-08 | Global search rounded corners + brand polish | Phase 34 | Active |
| BRAND-09 | Memberships card spurious borders removed | Phase 34 | Active |
| BRAND-10 | Settings > Organizations header shows org name + info | Phase 34 | Active |
| TABLE-01 | Shared column removed from 3rd pane | Phase 35 | Active |
| TABLE-02 | Folders column reflects assignment (depends on BUG-01) | Phase 35 | Active |
| TABLE-03 | Standardized column alignment | Phase 35 | Active |
| FILTER-01 | Folder filter removed | Phase 35 | Active |
| FILTER-02 | Duration filter removed | Phase 35 | Active |
| FILTER-03 | Contacts filter queries full contacts DB | Phase 35 | Active |
| FILTER-04 | Source filter overflow + second row fix | Phase 35 | Active |
| DND-01 | Drag target position-stable | Phase 35 | Active |
| DND-02 | Drag target enlarged to left ⅓–½ of card | Phase 35 | Active |
| CARD-01 | Whole workspace card clickable | Phase 35 | Active |
| CARD-02 | Same applied to org cards and similar patterns | Phase 35 | Active |
| SEC-01 | 5 remaining Medium/Low audit items closed | Phase 37 | Active |
| SEC-02 | Fresh comprehensive edge-function audit | Phase 37 | Active |
| SEC-03 | Frontend security review (XSS, secrets, npm audit) | Phase 38 | Active |
| SEC-04 | RLS / database policy audit | Phase 38 | Active |
| SEC-05 | Edge Function orphan cleanup (39 dead functions) | Phase 37 | Active |
| FEAT-01 | Fathom Mirror (read from fathom_raw_calls) | Phase 39 | Active |
| FEAT-02 | Fathom re-import / overwrite existing calls | Phase 40 | Active |
| DEBT-01 | PAY-05 — gate 2 remaining ungated AI features | Phase 41 | Active |
| DEBT-02 | MCP-04 — operational config completed | Phase 41 | Active |
| DEBT-03 | Close 13 deferred v2.0 human-verification items | Phase 41 | Active |

---

*Last updated: 2026-05-11 — v2.2 traceability filled (55 requirements → 13 phases, 100% coverage)*
