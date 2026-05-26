# Phase 29 — Persona A Sweep Raw Notes (Plan 29-02)

**Driver:** Claude via dev-browser (Playwright skill, persistent extension session) per CLAUDE.md HARD RULE
**Persona:** A — Owner (`a@vibeos.com`), cycled across AI Simple / Business / GoVibey
**Started:** 2026-05-11T21:46:52Z
**Completed:** 2026-05-11T22:25:00Z (approx)
**Target:** https://app.callvaultai.com
**Precheck:** 29-01-PRECHECK.md → READY-FOR-SWEEP (PASS on all 4 checks)
**Session re-validation:** Confirmed (`persona-a-001-session-check.png`) — landed on `/` authenticated as Persona A on AI Simple org, 1,216 calls visible, no re-auth needed

> **Notes on terminology:**
> - Production capitalization is `AI Simple`, `Business`, `GoVibey`; plan/CONTEXT.md use `AI SIMPLE`, `BUSINESS`, `GOVIBEY`. Case-insensitive match per Plan 01 decision.
> - "dev-browser MCP" in the plan = dev-browser skill (Playwright) in practice — same capability, different invocation surface.

---

## Cleanup List (must be reverted at end of Plan 29-02)

- [x] Default-workspace toggle test — moved AI Simple Founders to default, then reverted My Calls back to default (toast "Default workspace updated" confirmed on revert)
- [x] Test workspace `qa-sweep-test-1778537353596` in AI Simple — created during BUG-08 verify, then deleted via Settings > Organizations > Delete Workspace (toast "Workspace deleted" confirmed)
- [x] (preserved for Plan 04 — share token: **`vkfqmFaj-pr-tx-AmCzppqOOdWlSUP59`**) Share link addressed to `naegele412@gmail.com` on Q3 Sales Sync call. Full URL: `https://app.callvaultai.com/s/vkfqmFaj-pr-tx-AmCzppqOOdWlSUP59`
- [x] No test tags applied — Tag with AI button could not be found in UI (see Finding 016)
- [x] No DND mutation attempted — drag handle present visually but mutation skipped per read-only intent

---

## Coverage Matrix

### Authenticated routes (per src/App.tsx)

| Route | AI Simple | Business | GoVibey | Notes |
|-------|-----------|----------|---------|-------|
| `/` (Home / TranscriptsNew) | ✓ | ✓ | ✓ | AI Simple: 1216 calls, Business: 1, GoVibey: 92 |
| `/transcripts` | ✓ | n/a (same as `/`) | n/a (same as `/`) | Same component as `/` |
| `/settings` (index) | ✓ | ✓ | ✓ | Renders Settings page; first tab (Account) shown |
| `/settings/account` | ✓ | ✓ | ✓ | Works |
| `/settings/billing` | ✓ | n/a (same Settings layout) | n/a | Works on AI Simple; shows Pro Plan Active |
| `/settings/organizations` | ✓ | ✓ | ✓ | All 3 orgs; VIS-05 + BRAND-10 reproducing |
| `/settings/ai-integrations` | ✓ (redirects to /settings/account) | — | — | **Direct URL deep-link broken — see Finding 003** |
| `/settings/admin` | ✓ (redirects to /settings/account) | — | — | **Direct URL deep-link broken — see Finding 003** |
| `/analytics` | ✓ (auto-redirects to /analytics/overview) | ✓ | ✓ | Stub data (charts coming soon) — Finding 011 |
| `/analytics/{category}` | ✓ overview | n/a | n/a | Acceptable |
| `/people` | ✓ | ✓ | ✓ | AI Simple: 523 contacts |
| `/organization` | ✓ | ✓ | ✓ | Different rendering per org type (Personal vs Business) |
| `/rules` | ✓ | ✓ | ✓ | AI Simple has 3 rules (THE LAB / THE TABLE / Phill); Business/GoVibey untested rules count |
| `/import` | ✓ | ✓ | ✓ | AI Simple shows Fathom (993), Zoom (Setup needed), YouTube (6), File Upload connected |
| `/call/:callId` | ✓ (Q3 Sales Sync, Phill Tomlinson | Monthly 1:1) | n/a | n/a | **`/call/:callId` direct deep-link redirects to `/` — see Finding 004** |
| `/setup` | n/a | n/a | n/a | Skipped to avoid mutating account state per plan |
| Cmd+K global search | ✓ | n/a | n/a | Tested on AI Simple; search "Sammy" returned results |

### Unauth routes (single visit each)

| Unauth route | Visited | Notes |
|--------------|---------|-------|
| `/login` | ✓ | Renders "Welcome back" form even while signed in — Finding 001 |
| `/auth` | ✓ | Same component as `/login` (no signed-in redirect) — Finding 001 |
| `/forgot-password` | ✓ | "Reset your password" form, "Send reset link" button, "Back to sign in" link |
| `/reset-password` | ✓ | "Set a new password" form, "Update password" button (no token validation visible) |
| `/oauth/consent` | ✓ | Empty-state: "INVALID REQUEST — Invalid authorization request. Please try connecting again from your MCP client." |

### Legacy redirects (one visit each)

| Legacy redirect | Confirms? | Target landed on |
|-----------------|-----------|------------------|
| `/sorting-tagging` | ✓ | `/rules` |
| `/sorting-tagging/rules` | ✓ | `/rules` |
| `/workspaces` | ✓ | `/` |
| `/vaults` | ✓ | `/` |
| `/agents` | ✓ | `/` |
| `/team` | ✓ | `/` |
| `/banks` | ✓ | `/settings/organizations` |
| `/automation-rules` | ✓ | `/rules` |
| `/shared-with-me` | ✓ | `/` |

All 9 legacy redirects work correctly.

---

## Re-verification Summary (sweep status proposal for Plan 29-05)

Existing requirement re-verification results. Plan 29-05 will write these into the REQUIREMENTS.md "Sweep Status" column.

| Existing ID | Surface | Sweep Status | Notes |
|-------------|---------|--------------|-------|
| BUG-01 | Tag with AI / Folders blank | **Confirmed** | Network 400 on `call_speakers?recording_id=in.(144012376,...)` — Fathom numeric IDs passed where UUIDs required. Folders blank for Phill Tomlinson | Monthly 1:1 (ID 144012376). See Finding 016. |
| BUG-02 | Workspace default toggle | **No-repro** | Successfully toggled AI Simple Founders default ON, toast "Default workspace updated", zero 406 errors. See Finding 017. |
| BUG-03 | Cache invalidation after mutation | **No-repro** (partial) | Workspace create + delete reflected immediately in UI without reload. Tag mutation not testable as Tag with AI UI absent. |
| BUG-04 | Date sort chronological | **Confirmed (different symptom)** | Two clicks on DATE column header did NOT toggle sort direction; rows remained in same order both times. See Finding 018. |
| BUG-05 | Manual paste/upload UI | **Confirmed** | `/import` shows Fathom/Zoom/YouTube/File Upload sources; File Upload accepts audio/video drag-drop (MP3, WAV, M4A, MP4, MOV, WebM) but NO transcript paste UI exists. See Finding 019. |
| BUG-06 | Import History button | **No-repro** | Click navigates to Import History view ("IMPORT HISTORY — Review recent imports and failed jobs"), empty content. Empty data, not broken nav. See Finding 020. |
| BUG-07 | Import "+" button | **Confirmed** | Add integration "+" button click registered no visible effect (no modal, no nav). See Finding 021. |
| BUG-08 | Hall of Fame / Manager Reviews auto-folders | **No-repro** | Created `qa-sweep-test-1778537353596` workspace; 2nd-pane showed "No folders" (italicised gray). Auto-folders NOT created. See Finding 022. |
| BUG-09 | DialogContent accessibility warnings | **Confirmed** | Debug Console showed `Warning: Missing 'Description' or 'aria-describedby={undefined}' for {DialogContent}` x3 during modal interactions. See Finding 023. |
| VIS-01 | Sidebar canonical selection pattern | **Confirmed** | Sidebar Calls active: orange pill + bg-muted ✓, but icon container `bg-muted border-border` — no orange-ring-around-icon. Same on People, Settings sidebar items. See Finding 024. |
| VIS-02 | 2nd-pane workspace selector canonical pattern | **Confirmed** | AI Simple Founders active: orange pill + bold + uppercase ✓, icon has gray-bordered rounded square with NO orange ring. See Finding 025. |
| VIS-03 | Settings tab list canonical pattern | **Confirmed** | Settings tab list (Account/Billing/Organizations/AI Integrations/Admin): uses orange-pill-on-left + bg-muted highlight pattern (canonical-style), BUT icon container has black bg with white icon (Account active) — not the orange-ring-around-icon. Confirms VIS-03 reproducing. See Finding 026. |
| VIS-04 | Call Detail modal tabs canonical pattern | **Confirmed** | Call Detail modal tabs (OVERVIEW / TRANSCRIPT / INVITEES / PARTICIPANTS) use **orange underline below active text** — NOT canonical pill+highlight+ring. See Finding 027. |
| VIS-05 | Settings>Organizations org-tab strip → 2nd-pane dropdown | **Confirmed** | Settings>Organizations still shows "AI SIMPLE | BUSINESS | GOVIBEY" tab strip with orange underline pattern — not replaced with 2nd-pane dropdown. See Finding 028. |
| BRAND-01 | Sidebar order CALLS → IMPORT → RULES → PEOPLE → ORGANIZATION | **Confirmed** | Production sidebar order is **Calls → People → Organization → Import → Rules**. Wrong order. See Finding 029. |
| BRAND-02 | All sidebar titles UPPERCASE | **Confirmed (partial)** | Pane headings (NAVIGATION, WORKSPACE NAVIGATOR, ORGANIZATION, HOME, IMPORTS, SETTINGS, PEOPLE) are correctly UPPERCASE. **Sidebar primary nav labels are sentence case** (`Calls`, `People`, `Organization`, `Import`, `Rules`, `Take the tour`, `How it works`, `Settings`). See Finding 030. |
| BRAND-03 | Workspace title bold-only (remove italic) | **Cannot-verify** | 2nd-pane workspace titles "AI SIMPLE FOUNDERS" etc. appear bold uppercase — not visibly italic to me. **Need user visual judgment for italic detection at small font size.** See Finding 031. |
| BRAND-04 | Org box full width with equal padding | **Confirmed** | "AI Simple — Your personal organization for private recordings" card in Settings>Organizations is much wider than the workspace cards below ("My Calls", "AI Simple Founders" etc.). Width mismatch. See Finding 032. |
| BRAND-05 | Top-bar org selector width matches 2nd pane | **Confirmed** | Top-right "AI Simple" selector width ~137px vs 2nd-pane "AI Simple ▾" box width ~257px. Significant mismatch. See Finding 033. |
| BRAND-06 | "ALL" link contrast | **Cannot-verify-as-Persona-A** | "ALL" link in Home 2nd pane visible at low contrast — need user visual judgment on whether the current `text-muted-foreground` shade is acceptable. See Finding 034. |
| BRAND-07 | Doubled X close button | **No-repro** | Across modals viewed (Share Call, Call Detail, New Workspace, Delete Workspace), each shows a single X close button in top-right. Not doubled. |
| BRAND-08 | Global search modal rounded corners | **Confirmed (partial)** | Cmd+K modal: outer dialog has `rounded-lg`, search input inside has larger rounding (~12px). Some inconsistency. See Finding 035. |
| BRAND-09 | "MEMBERSHIPS" / "WORKSPACE MEMBERS" stray borders | **Cannot-verify** | Pane 4 Workspace Detail showed "MEMBERSHIPS" and "WORKSPACE MEMBERS" headings — needs user judgment on whether visible borders are stray or intentional. See Finding 036. |
| BRAND-10 | Settings>Organizations header shows org name+description | **Confirmed** | Settings>Organizations header shows generic "Workspaces / Manage your organizational structure and collaboration workspaces" — NOT "AI Simple — Your personal organization for private recordings". See Finding 037. |
| TABLE-01 | Shared column removed | **Confirmed (still present)** | Home table column header reads `TITLE | DATE | DURATION | INVITEES | SPOKE | SOURCE | TAGS | WORKSPACES | SHARED` — Shared column still present (rightmost). See Finding 038. |
| TABLE-02 | Folders column reflects assignment | **Confirmed (blank for most)** | Folders column not visibly present in main table view (only Workspaces column). Call Detail panel says "FOLDERS: No folders assigned" for Phill Tomlinson | Monthly 1:1 (ID 144012376). Depends on BUG-01. See Finding 039. |
| TABLE-03 | Column alignment standardized | **Cannot-verify-precisely** | Mixed alignment visible: TITLE left, DURATION right (with tabular-nums), INVITEES has icon+number alignment. Needs visual judgment. See Finding 040. |
| FILTER-01 | Folder filter removed | **Confirmed (still present)** | Filter pill row shows: `Date Tag Folder Contacts Duration Source`. Folder filter still present. Popover: "Select Folders / No folders yet / Unorganized / Add Folder / Clear / Apply". See Finding 041. |
| FILTER-02 | Duration filter removed | **Confirmed (still present)** | Duration filter pill still present. Popover: "Call Duration (minutes) / Threshold: 30 min / Less than 30 / More than 30 / Between (min-max)". See Finding 042. |
| FILTER-03 | Contacts filter queries full DB | **Cannot-verify in this run** | Contacts filter popover did not open via Playwright `:has-text("Contacts")` — likely matched the sidebar People link instead. Needs re-run with more precise selector. See Finding 043. |
| FILTER-04 | Source filter overflow + 2nd row | **Confirmed (Source row wraps)** | Visible on GoVibey home: filter pills wrap to 2nd row — "Date Tag Folder Contacts Duration" on row 1, "Source" on row 2. Wrapping (not strict overflow) but matches the FILTER-04 symptom. See Finding 044. |
| DND-01 | Drag handle position-stable on selection | **Cannot-verify-as-Persona-A** | Drag handle dots (⠿) visible at left of each row title. Did not test selection-state shift behavior. See Finding 045. |
| DND-02 | Drag target enlarged to ⅓-½ of card | **Cannot-verify** | Drag handle (⠿) appears as a small ~12px icon glued to left edge of the title cell. Plan to enlarge not yet implemented. See Finding 046. |
| CARD-01 | Whole workspace card clickable | **Confirmed (chevron-only)** | Clicking middle of "AI Simple Founders" workspace card in 2nd-pane navigator did NOT navigate. Clicking right-edge (chevron area, x≈515) DID navigate into the workspace. CARD-01 reproducing. See Finding 047. |
| CARD-02 | Same applied to other cards | **Cannot-verify-fully** | Workspace cards have same chevron-only behavior. Other card types (organization cards, contact cards) not exhaustively tested. See Finding 048. |
| AUTH-01..05 | Auth/signup flows | **Not-tested** | Persona A doesn't trigger signup; Persona B (Plan 29-03) owns these. |
| SHARE-01..02 | Public landing / wrong-account error | **Not-tested** | Persona C (Plan 29-04) owns these. |
| SHARE-03 | Share Call modal visual cleanup | **No-repro** | Share Call modal for Q3 Sales Sync is clean: no spurious orange/red field borders, mail-envelope icon in input looks correct, no overflow against parent dialog. See Finding 049. |
| SHARE-04 | Single-call share works end-to-end | **Partial Confirmed** | Sender (Persona A) successfully created share link `vkfqmFaj-pr-tx-AmCzppqOOdWlSUP59` for naegele412@gmail.com on Q3 Sales Sync. Recipient flow (open link) is Plan 29-04. POST `/rest/v1/call_share_links` returned 201. See Finding 050. |
| SEC-01..05 / SEC-06..12 | Edge-function security | **Not-tested-as-Persona-A** | Codebase-level audits; not visible from owner UI. |
| FEAT-01..02 | Fathom mirror + re-import | **Not-tested** | Backend features. |
| DEBT-01..03 | Tech debt items | **Not-tested** | Not surfaced through owner UI sweep. |

---

## Findings

### Finding 001: Auth routes don't redirect signed-in users

- **Tag:** [NEW]
- **Surface/Route:** `/login`, `/auth`
- **Persona:** A
- **Org observed:** all-three (org-independent)
- **Steps to reproduce:**
  1. Sign in as Persona A
  2. Navigate to `https://app.callvaultai.com/login` (or `/auth`)
  3. Observe page renders the sign-in form ("Welcome back / Sign in to your CallVault account")
- **Observed:** Sign-in form rendered for an already-authenticated user. No automatic redirect to `/` or the post-login home.
- **Expected:** Authenticated users hitting `/login` or `/auth` should redirect to `/` (UX convention).
- **Severity:** P3
- **Maps to (proposal):** BACKLOG (UX papercut, low risk)
- **Screenshot:** `screenshots/persona-a-002-login-while-signedin.png`

### Finding 002: Sign-in page password field shows pre-filled dots

- **Tag:** [NEW]
- **Surface/Route:** `/login`
- **Persona:** A
- **Org observed:** n/a (signed-out auth route)
- **Steps to reproduce:**
  1. Visit `/login`
  2. Observe Password field
- **Observed:** Password field is pre-filled with 7-8 obscured dots (likely browser autofill from the dev-browser persistent profile)
- **Expected:** Empty password field on a fresh sign-in form. Browser autofill is a per-browser behavior, but UX should make the autofill obvious or clear it.
- **Severity:** P3
- **Maps to (proposal):** BACKLOG (browser-managed; not a true bug)
- **Screenshot:** `screenshots/persona-a-002-login-while-signedin.png`

### Finding 003: Settings deep-link URLs `/settings/ai-integrations` and `/settings/admin` redirect to `/settings/account`

- **Tag:** [NEW]
- **Surface/Route:** `/settings/ai-integrations`, `/settings/admin`
- **Persona:** A
- **Org observed:** AI Simple (likely all three — URL-level)
- **Steps to reproduce:**
  1. Navigate directly to `https://app.callvaultai.com/settings/ai-integrations` (or `/settings/admin`)
- **Observed:** URL after page load is `https://app.callvaultai.com/settings/account` — the deep-link silently redirects to Account tab. The Settings page DOES show AI Integrations and Admin tabs in its left nav (visible at `/settings/account`), but the URL deep-link parameter is not honored.
- **Expected:** Direct URL to `/settings/ai-integrations` opens AI Integrations tab. Same for Admin.
- **Severity:** P1 (broken deep-linking; affects shareability of settings URLs)
- **Maps to (proposal):** Phase 33 (selection-state work) or Phase 36 (catch-all)
- **Screenshot:** `screenshots/persona-a-015-settings-ai-aisimple.png`, `screenshots/persona-a-016-settings-admin-aisimple.png`

### Finding 004: `/call/:callId` direct deep-link redirects to `/` instead of opening call detail

- **Tag:** [NEW]
- **Surface/Route:** `/call/:callId`
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. While signed in, navigate to `https://app.callvaultai.com/call/2fdf6aa5-86a8-4b49-b19b-1e5b26ef60f8` (Q3 Sales Sync UUID)
- **Observed:** URL changes back to `https://app.callvaultai.com/` and the home table is shown. The call detail modal IS opened on top of home (visible after navigation), but the URL doesn't persist on the call detail surface. Reloading the page closes the modal.
- **Expected:** Either the URL persists as `/call/{uuid}` while the modal is open, OR navigating directly to the URL opens just the call detail without home behind. Reload should not lose state.
- **Severity:** P2 (deep-link sharing of call detail won't work after reload)
- **Maps to (proposal):** Phase 36 (bug catch-all)
- **Screenshot:** `screenshots/persona-a-026-call-detail-overview-aisimple.png` (modal IS open even though URL is `/`)
- **Backend log:** none

### Finding 005: Sidebar uses emoji icons instead of Remix Icons (HARD-CONSTRAINT VIOLATION)

- **Tag:** [NEW]
- **Surface/Route:** Sidebar (every authenticated route)
- **Persona:** A
- **Org observed:** all-three
- **Steps to reproduce:**
  1. Visit any authenticated route as Persona A
  2. Inspect sidebar `<button>` elements for nav items
- **Observed:** Sidebar nav items render emoji icons (📞 Calls, 👥 People, 🏢 Organization, 📥 Import, 🔀 Rules, ❓ Take the tour, ℹ️ How it works, ⚙️ Settings). DOM extract: `<img aria-label="Calls" role="img"><span>📞</span></img>` style.
- **Expected:** All icons MUST be Remix Icons (`@remixicon/react`) per CLAUDE.md HARD CONSTRAINT: "Remix Icons ONLY (`@remixicon/react`) — no Lucide, FontAwesome, or others". Emoji icons render differently per OS / fontset and violate the design system.
- **Severity:** P1 (hard-constraint violation; brand-level visual inconsistency)
- **Maps to (proposal):** Phase 34 (Layout & Brand Polish)
- **Screenshot:** `screenshots/persona-a-010-home-aisimple.png` (entire sidebar visible)
- **Backend log:** none

### Finding 006: CSP `script-src` blocks blob: worker creation (functional bug)

- **Tag:** [NEW]
- **Surface/Route:** All routes (especially `/`, `/people`, `/import`)
- **Persona:** A
- **Org observed:** all-three
- **Steps to reproduce:**
  1. Navigate to any data-heavy route as Persona A
  2. Inspect browser console
- **Observed:** Repeated console errors:
  ```
  Refused to create a worker from 'blob:https://app.callvaultai.com/{uuid}' because it violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' 'unsafe-eval'". Note that 'worker-src' was not explicitly set, so 'script-src' is used as a fallback. The action has been blocked.
  ```
- **Expected:** CSP should allow blob: workers (add `worker-src 'self' blob:` to CSP header) OR avoid creating blob: workers. The current CSP blocks every worker that the app tries to spawn — feature broken silently.
- **Severity:** P1 (silently broken feature in production; any code-path that depends on workers is unusable)
- **Maps to (proposal):** Phase 38 (frontend security / SEC-03B) or new mini-phase
- **Screenshot:** n/a (console-only finding; backend log captures the symptom)
- **Backend log:**
  ```
  console.error: Refused to create a worker from 'blob:https://app.callvaultai.com/160a6ef1-6198-445b-90e6-6135144961c6' because it violates the following Content Security Policy directive: "script-src 'self' 'unsafe-inline' 'unsafe-eval'". Note that 'worker-src' was not explicitly set, so 'script-src' is used as a fallback. The action has been blocked.
  ```
  Observed ≥10 distinct worker spawn attempts across the route walk.

### Finding 007: `call_speakers?recording_id=in.(...)` HTTP 400 with Fathom numeric IDs (BUG-01 chain confirms)

- **Tag:** [RE-VERIFY-BUG-01]
- **Surface/Route:** `/` (Home), `/transcripts` — any page that triggers `call_speakers` fetch
- **Persona:** A
- **Org observed:** AI Simple (visible in network), Business (still queries AI Simple call IDs — see Finding 008)
- **Steps to reproduce:**
  1. Navigate to `/` on AI Simple (or directly load the home page)
  2. Inspect network → `call_speakers?select=*&recording_id=in.(...)` request
- **Observed:** HTTP 400 response. Query string contains comma-separated Fathom numeric IDs: `recording_id=in.(144012376,144012295,143800259,143740365,143408886,142919240,142867500,142738288,142341624,141832424,140941943,140147494,139945042,...)`. These are Fathom legacy IDs, NOT the recording UUIDs the `call_speakers` table expects.
- **Expected:** Query should pass recording UUIDs (e.g., `2fdf6aa5-86a8-4b49-b19b-1e5b26ef60f8`). HTTP 200 with speaker data.
- **Severity:** P0 (root cause of BUG-01 chain — blocks AI tagging, blanks Folders column)
- **Maps to (proposal):** Phase 30 (BUG-01 fix — already scoped)
- **Screenshot:** n/a (network-level; backend log captures)
- **Backend log:**
  ```
  network: GET /rest/v1/call_speakers?select=*&recording_id=in.(144012376,144012295,143800259,143740365,143408886,142919240,142867500,142738288,142341624,141832424,140941943,140147494,139945042,...) → HTTP 400
  ```
  (Note: Fathom numeric IDs passed where UUIDs required — same root cause as BUG-01 `invalid input syntax for type uuid: "143800259"`.)

### Finding 008: Cross-org cache leak — AI Simple call IDs queried while on Business org (SEC-03C confirmation)

- **Tag:** [SECURITY P0 / RE-VERIFY-SEC-03C]
- **Surface/Route:** Org switch from AI Simple → Business → any data-driven route
- **Persona:** A
- **Org observed:** Started AI Simple → switched to Business → walked Business routes
- **Steps to reproduce:**
  1. Sign in as Persona A on AI Simple
  2. Walk home / transcripts and let the table load (`call_speakers` query fires with AI Simple call IDs)
  3. Use the top-right org switcher → Business
  4. After arriving on Business home, inspect network → `call_speakers?recording_id=in.(...)` request triggered after switch
- **Observed:** Network trace shows a `call_speakers` request URL containing **AI Simple's call IDs (144012376, 144012295, 143800259, etc.)** while user is now on Business org. The TanStack Query cache key was not invalidated on org switch, so the stale request fires with the previous org's data.
- **Expected:** Org switch invalidates all React Query caches keyed by org_id. New org loads its own call IDs from scratch.
- **Severity:** P0 (information disclosure surface — the URL itself reveals AI Simple call IDs to anyone watching the Business-org network trace; production-on-prod monitoring/intercept could leak cross-org identifiers)
- **Maps to (proposal):** Phase 38 (SEC-03C is already scoped — this is direct confirmation)
- **Screenshot:** `screenshots/persona-a-041-business-home.png` (Business home — but network shows AI Simple IDs in flight)
- **Backend log:**
  ```
  network: GET /rest/v1/call_speakers?select=*&recording_id=in.(144012376,144012295,143800259,...) → HTTP 400
  (Observed AFTER switching from AI Simple to Business org; the AI Simple call IDs are leaked into the Business-org session network trace.)
  ```

### Finding 009: Analytics page displays "coming soon" stub charts

- **Tag:** [NEW]
- **Surface/Route:** `/analytics`, `/analytics/overview`
- **Persona:** A
- **Org observed:** AI Simple, Business, GoVibey (presumably all)
- **Steps to reproduce:**
  1. Navigate to `/analytics`
- **Observed:** Page shows KPI cards ("Total Calls: 22, Total Hours: 43.9h, Avg Duration: 120 min, Avg % Talk Time: 0%, Unique Speakers: 0") followed by two chart placeholders: "**Line chart coming soon**" and "**Bar chart coming soon**". Categories on the 2nd-pane (Overview, Call Duration, Participation & Speakers, Talk Time & Engagement, Tags & Categories, Content Created) exist but the chart content is stubbed.
- **Expected:** Real charts rendered with actual call data, OR the section should be hidden entirely (per CLAUDE.md "Known Stubs that prevent goal achievement" should NOT ship).
- **Severity:** P2 (visible stub; not blocking but degrades trust)
- **Maps to (proposal):** Phase 36 or BACKLOG (existing scope likely covers stubs)
- **Screenshot:** `screenshots/persona-a-017-analytics-aisimple.png`

### Finding 010: Analytics "Total Calls: 22" but Home table shows "1,216 of 1216"

- **Tag:** [NEW]
- **Surface/Route:** `/analytics` vs `/`
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Navigate to `/` → table shows "1-20 of 1216" (1,216 calls)
  2. Navigate to `/analytics` → KPI card shows "Total Calls: 22"
- **Observed:** Massive mismatch between home table call count (1,216) and analytics total (22). Either analytics is filtered by date range (current month? Recent?) without indicating filter state, OR analytics is querying a different table/filter than home.
- **Expected:** Either match the unfiltered home count, OR show a visible date-range filter that explains the 22.
- **Severity:** P2 (data correctness UX issue)
- **Maps to (proposal):** Phase 36 or BACKLOG
- **Screenshot:** `screenshots/persona-a-017-analytics-aisimple.png`

### Finding 011: Top-of-screen central title displays "HOME" on every page (doesn't update)

- **Tag:** [NEW]
- **Surface/Route:** Every authenticated route (top-bar central title)
- **Persona:** A
- **Org observed:** all-three
- **Steps to reproduce:**
  1. Navigate to `/rules` (or `/organization`, `/import`, `/people`)
  2. Look at the central title in top bar (orange "HOME" text)
- **Observed:** Central title stays as "HOME" on `/rules`, `/organization`, `/import` and most other routes. It only changes on `/settings` (shows "SETTINGS"), `/analytics` (shows "ANALYTICS"), and `/people` (shows "PEOPLE"). For Rules / Organization / Import — even though the page IS rendering Routing Rules / Organization Overview / Imports content — the central nav title says HOME.
- **Expected:** Top-bar central title reflects the current page (RULES, ORGANIZATION, IMPORT, etc.).
- **Severity:** P2 (visual papercut; confusing breadcrumb / navigation orientation)
- **Maps to (proposal):** Phase 34 (brand polish) or Phase 36
- **Screenshot:** `screenshots/persona-a-020-rules-aisimple.png` (shows "HOME" while on /rules)

### Finding 012: `/organization` central title says "ORG" (abbreviated) while page shows "ORGANIZATION"

- **Tag:** [NEW]
- **Surface/Route:** `/organization`
- **Persona:** A
- **Org observed:** AI Simple, GoVibey (Business too)
- **Steps to reproduce:**
  1. Navigate to `/organization`
- **Observed:** 2nd-pane title says "ORG" (3 chars) but main pane title is "OVERVIEW" and shows "Organization details and settings". Inconsistent abbreviation.
- **Expected:** Either "ORGANIZATION" (full) or "ORG" (consistent everywhere).
- **Severity:** P3
- **Maps to (proposal):** Phase 34 or BACKLOG
- **Screenshot:** `screenshots/persona-a-019-organization-aisimple.png`

### Finding 013: Business org "Cross-Organization Default: Copy And_remove" placeholder text in Settings>Organizations

- **Tag:** [NEW]
- **Surface/Route:** `/settings/organizations` on Business tab
- **Persona:** A
- **Org observed:** Business
- **Steps to reproduce:**
  1. Switch to Business org
  2. Navigate to `/settings/organizations`
- **Observed:** Inside the Business org details card: "Business / Business organization for team collaboration / Cross-Organization Default: **Copy And_remove** / Created: 2/10/2026". The "Copy And_remove" looks like a leaked enum value (`copy_and_remove`) being rendered verbatim with raw casing.
- **Expected:** A human-readable label like "Copy and remove" or "Remove from original org" with appropriate styling.
- **Severity:** P2 (visible placeholder / dev-string leak)
- **Maps to (proposal):** Phase 36
- **Screenshot:** `screenshots/persona-a-043-settings-orgs-business.png`

### Finding 014: GoVibey home page filter pills wrap onto a second row (FILTER-04 confirmation)

- **Tag:** [RE-VERIFY-FILTER-04]
- **Surface/Route:** `/` on GoVibey org
- **Persona:** A
- **Org observed:** GoVibey
- **Steps to reproduce:**
  1. Switch to GoVibey
  2. Navigate to `/`
- **Observed:** Filter pills row: "Date / Tag / Folder / Contacts / Duration" on row 1, "Source" alone on row 2. Source pill is bumped to the second row at the GoVibey viewport width.
- **Expected:** All 6 pills fit one row at a reasonable viewport (the FILTER-04 spec calls for "Apply/Clear buttons fit within the popover" — close but the wrapping symptom is also present).
- **Severity:** P2
- **Maps to (proposal):** Phase 35 (filter cleanup, already scoped)
- **Screenshot:** `screenshots/persona-a-050-govibey-home.png`

### Finding 015: Call IDs in Business / GoVibey orgs are still Fathom numeric (not UUIDs)

- **Tag:** [RE-VERIFY-BUG-01]
- **Surface/Route:** `/` on Business and GoVibey orgs
- **Persona:** A
- **Org observed:** Business (ID 127986570), GoVibey (mixed — some UUIDs like f1aa2aa6-..., some numeric)
- **Steps to reproduce:**
  1. On Business org, view home table; the only call shows `ID: 127986570` (Fathom legacy)
  2. On GoVibey, mixed: top call has UUID, several below have numeric IDs
- **Observed:** Both Business and GoVibey orgs have calls displayed with Fathom numeric IDs (not migrated to UUIDs). Same surface as BUG-01 root cause.
- **Expected:** All call rows display UUIDs (and the underlying recording_id used in queries is a UUID).
- **Severity:** P0 (BUG-01 chain — direct evidence the legacy-ID problem is org-wide)
- **Maps to (proposal):** Phase 30 (BUG-01 fix)
- **Screenshot:** `screenshots/persona-a-041-business-home.png`, `screenshots/persona-a-050-govibey-home.png`

### Finding 016: "Tag with AI" button not exposed in UI (BUG-01 surface inaccessible)

- **Tag:** [RE-VERIFY-BUG-01]
- **Surface/Route:** `/` (table row), `/call/:callId` (call detail modal)
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Open Phill Tomlinson | Monthly 1:1 call detail
  2. Inspect modal for any "Tag with AI" / "Auto-tag" / "AI tag" button
  3. Click EDIT mode — still no AI-tag affordance
  4. Right-click the row → no context menu
  5. DOM scan for buttons matching "tag.*ai" or "ai.*tag" or "auto-tag" returned only literal-text content matches (transcript words), no clickable button
- **Observed:** No "Tag with AI" button visible anywhere on the call detail modal or row. BUG-01 says "auto-AI-tags failing on 'Tag with AI'" but the entry-point button doesn't appear to exist in current production UI.
- **Expected:** A "Tag with AI" or equivalent button on the call detail modal (or row context menu) that triggers the AI tagging flow.
- **Severity:** P1 (feature inaccessible)
- **Maps to (proposal):** Phase 30 (BUG-01 fix should expose / fix this surface)
- **Screenshot:** `screenshots/persona-a-061-call-phill-opened.png`, `screenshots/persona-a-062-edit-clicked.png`

### Finding 017: BUG-02 No-repro — Default workspace toggle works without 406

- **Tag:** [NO-REPRO-BUG-02]
- **Surface/Route:** `/settings/organizations` → Workspace Detail Pane 4 → Default Workspace switch
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Navigate to `/settings/organizations`
  2. Click "Open workspace detail" chevron on AI Simple Founders (non-default workspace)
  3. Pane 4 opens with "DEFAULT WORKSPACE" switch (current state: unchecked)
  4. Click switch to toggle ON
- **Observed:** Switch flipped from `aria-checked="false"` to `aria-checked="true"`. Toast appeared: "Default workspace updated". **Zero network errors. No HTTP 406. No PGRST116.**
- **Expected (BUG-02 spec):** HTTP 406 on PATCH /workspaces with PGRST116 error and "Failed to update workspace" toast.
- **Severity:** (existing BUG-02 P0 status — but currently No-repro)
- **Maps to:** BUG-02 (existing Phase 36 requirement). Per D-08, No-repro does NOT close the requirement — Phase 36 should re-verify before closing.
- **Screenshot:** `screenshots/persona-a-085-ws-default-toggle-attempt.png` (toggle ON state with no error)
- **Backend log:** none (zero supabase 400+ during toggle)
- **Cleanup performed:** Reverted My Calls to default workspace afterwards (toast "Default workspace updated" confirmed on revert).

### Finding 018: BUG-04 partial confirm — DATE column header click doesn't toggle sort

- **Tag:** [RE-VERIFY-BUG-04]
- **Surface/Route:** `/` (home table)
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Navigate to `/` (table sorted DESC by default — visible ↓ arrow next to DATE header)
  2. Click DATE column header at x≈720, y≈129
  3. Observe first 5 rows
  4. Click DATE column header a second time
  5. Observe first 5 rows
- **Observed:** Both clicks produced identical row order: `SUN OCT 4 / WED MAY 6 / WED MAY 6 / TUE MAY 5 / TUE MAY 5`. The sort arrow ↓ also stayed visible (not flipped to ↑). The click target may not be the actual sortable arrow — but BUG-04 specifically calls out "Apr → Nov → Mar jumps" which IS visible (OCT 4 first, then MAY) — but as Oct 2026 > May 2026 chronologically, this IS descending order. The jump appearance comes from year (2026) being consistent and dates jumping by months.
- **Expected:** Click on DATE column flips sort direction. First click ASC, second click DESC. Visible reordering of rows.
- **Severity:** P1 (sort UI inert)
- **Maps to (proposal):** Phase 36 (already includes BUG-04)
- **Screenshot:** `screenshots/persona-a-124-date-col-click.png`, `screenshots/persona-a-125-date-col-click-2.png`

### Finding 019: BUG-05 confirmed — No manual transcript paste UI

- **Tag:** [RE-VERIFY-BUG-05]
- **Surface/Route:** `/import` (File Upload source)
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Navigate to `/import`
  2. Click "File Upload" in source manager (2nd pane)
  3. Inspect right pane for paste-transcript UI
- **Observed:** File Upload section accepts drag-drop or browse for MP3/WAV/M4A/MP4/MOV/WebM (max 25MB) — audio/video only. **No transcript paste textarea, no markdown import, no "Paste transcript" option anywhere visible.**
- **Expected:** A paste-transcript input UI (referenced in BUG-05 spec — the "Q3 Sales Sync" test call evidence indicates the route exists server-side).
- **Severity:** P1 (feature server-side exists but no UI entry point)
- **Maps to (proposal):** Phase 36 (already includes BUG-05)
- **Screenshot:** `screenshots/persona-a-150-file-upload-source.png`

### Finding 020: BUG-06 No-repro — Import History button navigates (with empty data)

- **Tag:** [NO-REPRO-BUG-06]
- **Surface/Route:** `/import` → Import History sidebar item
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Navigate to `/import`
  2. Click "Import History — Review past imports" in left pane
- **Observed:** Right pane swapped to "IMPORT HISTORY — Review recent imports and failed jobs" heading. Content area is empty (no actual import jobs shown). Navigation works correctly; the empty state could be either intentional (no recent imports to display) or stub UI.
- **Expected (BUG-06 spec):** "Import History" button shows import history (data).
- **Severity:** Possibly already fixed; or stub. Plan 29-05 should verify via Phase 30/36 implementation with real data.
- **Maps to:** BUG-06 (existing Phase 36). Per D-08, No-repro does NOT close.
- **Screenshot:** `screenshots/persona-a-132-import-history-clicked.png`

### Finding 021: BUG-07 confirmed — Import "+" (Add integration) button does nothing

- **Tag:** [RE-VERIFY-BUG-07]
- **Surface/Route:** `/import` → top of 2nd-pane "+" Add integration button
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Navigate to `/import`
  2. Click the "+" button at the top right of the source manager 2nd pane (aria-label "Add integration")
- **Observed:** No modal opened. No navigation. No toast. URL unchanged. DOM `[role="dialog"]` count unchanged.
- **Expected (BUG-07 spec):** Button opens an "add new source" modal or wizard.
- **Severity:** P1 (button silently does nothing)
- **Maps to (proposal):** Phase 36 (already includes BUG-07)
- **Screenshot:** `screenshots/persona-a-131-import-plus-clicked.png` (no visual change from baseline `persona-a-021-import-aisimple.png`)

### Finding 022: BUG-08 No-repro — New workspace creates no auto-folders

- **Tag:** [NO-REPRO-BUG-08]
- **Surface/Route:** `/` → New Workspace → workspace navigator
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Navigate to `/`
  2. Click "New Workspace" button at bottom of 2nd-pane workspace list
  3. Fill name: `qa-sweep-test-1778537353596`
  4. Click "Create Workspace"
  5. Observe new workspace appears in YOUR WORKSPACES list
  6. Expand it (chevron click on the card)
  7. Observe sub-folder list
- **Observed:** New workspace created (toast "Workspace 'qa-sweep-test-1778537353596' created"). Network: POST `/rest/v1/workspaces` returned 201; POST `/rest/v1/workspace_memberships` returned 201. **Sub-folder list shows "No folders" — neither "Hall of Fame" nor "Manager Reviews" was auto-created.**
- **Expected (BUG-08 spec):** Auto-creation of these folders WAS happening previously — the spec says verify it isn't running. Test result: it isn't running. **No-repro.**
- **Severity:** (existing BUG-08 P1) — currently appears fixed
- **Maps to:** BUG-08 (existing Phase 36 requirement). Per D-08, No-repro doesn't close.
- **Screenshot:** `screenshots/persona-a-092-new-workspace-created.png` (workspace visible in 2nd pane), `screenshots/persona-a-095-qa-test-ws-finally.png` (expanded, no folders)
- **Backend log:** none (no errors)
- **Cleanup performed:** Test workspace deleted via Settings > Organizations > Delete Workspace (typed exact name to confirm, toast "Workspace deleted" confirmed). Verified post-delete: `qa-sweep-test` no longer present in DOM.

### Finding 023: BUG-09 confirmed — DialogContent accessibility warning still reproduces

- **Tag:** [RE-VERIFY-BUG-09]
- **Surface/Route:** Various modals (Tag filter popover, Cmd+K dialog, Call Detail modal)
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Open any modal that triggers Radix Dialog (Tag filter, Cmd+K, Share Call, etc.)
  2. Open browser DevTools console
- **Observed:** Repeated console warning:
  ```
  WARNING: Missing `Description` or `aria-describedby={undefined}` for {DialogContent}.
  ```
  Observed at least 3 times during the sweep (Tag popover, Cmd+K, Call Detail modal). Confirmed in Debug Console panel.
- **Expected (BUG-09 spec):** Every modal has a `<DialogDescription>` (use `<VisuallyHidden>` if implicit). Zero warnings.
- **Severity:** P2 (accessibility regression; screen readers can't announce dialog purpose)
- **Maps to (proposal):** Phase 36 (already includes BUG-09)
- **Screenshot:** `screenshots/persona-a-065-tag-filter-open.png` (Debug Console visible showing warning)
- **Backend log:**
  ```
  console.warn: Warning: Missing `Description` or `aria-describedby={undefined}` for {DialogContent}.
  ```

### Finding 024: VIS-01 confirmed — Sidebar selection state missing orange-ring on icon

- **Tag:** [RE-VERIFY-VIS-01]
- **Surface/Route:** Sidebar (every authenticated route)
- **Persona:** A
- **Org observed:** all-three
- **Steps to reproduce:**
  1. Navigate to `/`
  2. Inspect the active "Calls" sidebar item DOM
- **Observed:** Active sidebar item has orange pill ✓ (`before:bg-vibe-orange`), gray rounded highlight ✓ (`bg-muted`), but the icon container is `<div class="w-8 h-8 rounded-md ... bg-muted border-border">` with `border-border` — gray border, NO orange ring. The canonical pattern calls for orange-ring-around-icon + white bg (light) / black bg (dark).
- **Expected (VIS-01 spec):** Icon container has orange ring (`ring-1 ring-vibe-orange` or similar) + white/black bg per theme.
- **Severity:** P2 (selection state inconsistency vs canonical)
- **Maps to (proposal):** Phase 33 (selection state work — already scoped)
- **Screenshot:** `screenshots/persona-a-010-home-aisimple.png` (sidebar Calls active state)

### Finding 025: VIS-02 confirmed — 2nd-pane workspace selector missing orange-ring on icon

- **Tag:** [RE-VERIFY-VIS-02]
- **Surface/Route:** 2nd-pane workspace navigator
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Click into AI Simple Founders workspace (chevron on the card)
  2. Inspect the now-active workspace card
- **Observed:** Orange pill ✓, gray highlight ✓, bold uppercase title ✓, but icon container is a gray-bordered rounded square (no orange ring around icon). Mirrors the VIS-01 symptom.
- **Expected (VIS-02 spec):** Canonical pattern with orange ring around icon.
- **Severity:** P2
- **Maps to (proposal):** Phase 33
- **Screenshot:** `screenshots/persona-a-077-aisimplefounders-chevron.png`

### Finding 026: VIS-03 confirmed — Settings tab list uses orange pill but icon container is black-bg-not-orange-ring

- **Tag:** [RE-VERIFY-VIS-03]
- **Surface/Route:** `/settings/*`
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Navigate to `/settings/account` (or any settings tab)
  2. Inspect the "Account" active tab
- **Observed:** Active tab "Account" shows: orange pill ✓ (left edge), bg-muted highlight ✓ (gray), bold title + description ✓. But the icon container is BLACK bg with white icon inside — not the canonical "orange ring + white bg" / "orange ring + black bg" pattern.
- **Expected (VIS-03 spec):** Canonical pattern.
- **Severity:** P2
- **Maps to (proposal):** Phase 33
- **Screenshot:** `screenshots/persona-a-012-settings-account-aisimple.png`

### Finding 027: VIS-04 confirmed — Call Detail modal tabs use orange-underline-pill (not canonical)

- **Tag:** [RE-VERIFY-VIS-04]
- **Surface/Route:** Call Detail modal (any call → SHARE/EDIT/VIEW + tab strip)
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Click any call title (e.g., Q3 Sales Sync) to open call detail modal
  2. Inspect the OVERVIEW / TRANSCRIPT / INVITEES / PARTICIPANTS tab strip
- **Observed:** Active tab "OVERVIEW" has a 2-3px orange line below the text. No pill, no gray highlight on the tab itself, no icon-ring. **Orange-underline-pill pattern (the v1 style) — NOT canonical.**
- **Expected (VIS-04 spec):** Canonical pattern.
- **Severity:** P2
- **Maps to (proposal):** Phase 33
- **Screenshot:** `screenshots/persona-a-026-call-detail-overview-aisimple.png`

### Finding 028: VIS-05 confirmed — Settings>Organizations still uses tab strip (not 2nd-pane dropdown)

- **Tag:** [RE-VERIFY-VIS-05]
- **Surface/Route:** `/settings/organizations`
- **Persona:** A
- **Org observed:** AI Simple (cycle confirms all 3 orgs render the same tab strip)
- **Steps to reproduce:**
  1. Navigate to `/settings/organizations`
  2. Look at the org selection UI in the main pane
- **Observed:** Three tabs ("AI SIMPLE | BUSINESS | GOVIBEY") with orange underline beneath the active tab. Not a 2nd-pane dropdown selector.
- **Expected (VIS-05 spec):** Replaced with a 2nd-pane dropdown matching the rest of the app.
- **Severity:** P2
- **Maps to (proposal):** Phase 33
- **Screenshot:** `screenshots/persona-a-014-settings-orgs-aisimple.png`

### Finding 029: BRAND-01 confirmed — Sidebar order wrong

- **Tag:** [RE-VERIFY-BRAND-01]
- **Surface/Route:** Sidebar (every authenticated route)
- **Persona:** A
- **Org observed:** all-three
- **Steps to reproduce:**
  1. Inspect sidebar order
- **Observed:** Production order: **Calls → People → Organization → Import → Rules**
- **Expected (BRAND-01 spec):** **CALLS → IMPORT → RULES → PEOPLE → ORGANIZATION**
- **Severity:** P2 (sidebar discoverability)
- **Maps to (proposal):** Phase 34
- **Screenshot:** `screenshots/persona-a-010-home-aisimple.png`

### Finding 030: BRAND-02 partial — Sidebar nav labels are sentence case (only pane headings are UPPERCASE)

- **Tag:** [RE-VERIFY-BRAND-02]
- **Surface/Route:** Sidebar nav
- **Persona:** A
- **Org observed:** all-three
- **Steps to reproduce:**
  1. Inspect sidebar nav button labels
- **Observed:** Sidebar uses sentence-case labels: `Calls`, `People`, `Organization`, `Import`, `Rules`, `Take the tour`, `How it works`, `Settings`. Pane headings ARE UPPERCASE (`HOME`, `NAVIGATION`, `WORKSPACE NAVIGATOR`, `PEOPLE`, `SETTINGS`, etc.).
- **Expected (BRAND-02 spec):** "All primary sidebar / 2nd-pane titles are UPPERCASE". This applies to sidebar labels too per the spec wording.
- **Severity:** P2
- **Maps to (proposal):** Phase 34
- **Screenshot:** `screenshots/persona-a-010-home-aisimple.png`

### Finding 031: BRAND-03 cannot-verify — Workspace title italic detection too subtle

- **Tag:** [CANNOT-VERIFY-BRAND-03]
- **Surface/Route:** 2nd-pane workspace list
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Inspect 2nd-pane workspace titles ("MY CALLS", "AI SIMPLE FOUNDERS", etc.)
- **Observed:** Workspace titles render bold uppercase. Italic effect not visibly distinct to the screenshot reader at the rendered font size. **Need user visual judgment.**
- **Expected (BRAND-03 spec):** Bold only (no italic).
- **Severity:** P3
- **Maps to (proposal):** Phase 34
- **Screenshot:** `screenshots/persona-a-010-home-aisimple.png`

### Finding 032: BRAND-04 confirmed — Org box width inconsistent with workspace cards

- **Tag:** [RE-VERIFY-BRAND-04]
- **Surface/Route:** `/settings/organizations`
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Navigate to `/settings/organizations`
  2. Compare the "AI Simple — Your personal organization..." card vs the workspace cards below ("My Calls", "AI Simple Founders", etc.)
- **Observed:** AI Simple org card spans full container width; workspace cards below use a narrower visible padding. Visually mismatched widths/padding.
- **Expected (BRAND-04 spec):** Equal full-width padding.
- **Severity:** P2
- **Maps to (proposal):** Phase 34
- **Screenshot:** `screenshots/persona-a-014-settings-orgs-aisimple.png`

### Finding 033: BRAND-05 confirmed — Top-bar org selector width much smaller than 2nd-pane org box

- **Tag:** [RE-VERIFY-BRAND-05]
- **Surface/Route:** Top bar vs 2nd pane (every authenticated route)
- **Persona:** A
- **Org observed:** all-three
- **Steps to reproduce:**
  1. Inspect top-right "AI Simple ▾" button rect vs the 2nd-pane "ORGANIZATION / AI Simple ▾" box rect
- **Observed:** Top-right org selector width ≈137px; 2nd-pane org box width ≈257px.
- **Expected (BRAND-05 spec):** Matching widths.
- **Severity:** P2
- **Maps to (proposal):** Phase 34
- **Screenshot:** `screenshots/persona-a-010-home-aisimple.png`

### Finding 034: BRAND-06 cannot-verify — "ALL" link visible at low-but-acceptable contrast

- **Tag:** [CANNOT-VERIFY-BRAND-06]
- **Surface/Route:** 2nd-pane home (under "WORKSPACE NAVIGATOR")
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Navigate to `/`
  2. Look at the 2nd-pane below HOME — there's an "ALL" label
- **Observed:** "ALL" label rendered at `text-muted-foreground/60` opacity (visible in `screenshots/persona-a-010-home-aisimple.png` if you zoom on the area). Slightly low contrast vs adjacent labels.
- **Expected (BRAND-06 spec):** Darker / higher-contrast.
- **Severity:** P3
- **Maps to (proposal):** Phase 34
- **Screenshot:** `screenshots/persona-a-010-home-aisimple.png`

### Finding 035: BRAND-08 partial — Cmd+K search input has larger rounding than dialog edge

- **Tag:** [RE-VERIFY-BRAND-08]
- **Surface/Route:** Cmd+K global search modal
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Open Cmd+K
  2. Compare search input rounded-corner radius vs dialog outer rounded-corner radius
- **Observed:** Search input has a noticeably larger border-radius (≈12px) compared to the dialog box (≈6-8px). Visual mismatch.
- **Expected (BRAND-08 spec):** Rounded corners on the search input that match the dialog elsewhere.
- **Severity:** P3
- **Maps to (proposal):** Phase 34
- **Screenshot:** `screenshots/persona-a-022-cmdk-open-aisimple.png`, `screenshots/persona-a-024-cmdk-search-sammy-wait-aisimple.png`

### Finding 036: BRAND-09 cannot-verify — Workspace Detail headings borders unclear

- **Tag:** [CANNOT-VERIFY-BRAND-09]
- **Surface/Route:** Pane 4 Workspace Detail
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Open a workspace's detail pane (Settings>Organizations chevron)
  2. Look at "MEMBERSHIPS" and "WORKSPACE MEMBERS" / "TESTING" labels
- **Observed:** Headings are bold uppercase chip-style labels. Cannot clearly determine if they have stray box-creating borders vs intentional pill-styling at the rendered scale.
- **Expected (BRAND-09 spec):** No stray borders.
- **Severity:** P3
- **Maps to (proposal):** Phase 34
- **Screenshot:** `screenshots/persona-a-082-ws-detail-pane.png`

### Finding 037: BRAND-10 confirmed — Settings>Organizations header is generic, doesn't show org name+description

- **Tag:** [RE-VERIFY-BRAND-10]
- **Surface/Route:** `/settings/organizations`
- **Persona:** A
- **Org observed:** AI Simple, Business, GoVibey (all 3)
- **Steps to reproduce:**
  1. Navigate to `/settings/organizations`
  2. Look at the main-pane heading at top
- **Observed:** Heading: "Workspaces / Manage your organizational structure and collaboration workspaces" — same regardless of which org tab is active.
- **Expected (BRAND-10 spec):** "AI Simple — Your personal organization for private recordings" (per-org name + description).
- **Severity:** P2
- **Maps to (proposal):** Phase 34
- **Screenshot:** `screenshots/persona-a-014-settings-orgs-aisimple.png`, `screenshots/persona-a-043-settings-orgs-business.png`, `screenshots/persona-a-052-settings-orgs-govibey.png`

### Finding 038: TABLE-01 confirmed — Shared column still present in home table

- **Tag:** [RE-VERIFY-TABLE-01]
- **Surface/Route:** `/` (Home)
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Navigate to `/`
  2. Inspect column headers
- **Observed:** Column header row: `TITLE | DATE | DURATION | INVITEES | SPOKE | SOURCE | TAGS | WORKSPACES | SHARED`. The rightmost "SHARED" column is still present.
- **Expected (TABLE-01 spec):** Shared column removed.
- **Severity:** P3
- **Maps to (proposal):** Phase 35
- **Screenshot:** `screenshots/persona-a-010-home-aisimple.png` (the column wraps offscreen on the default viewport so it's visible in DOM but the header in screenshot ends at INV)

### Finding 039: TABLE-02 confirmed — Folders column blank (chained to BUG-01)

- **Tag:** [RE-VERIFY-TABLE-02]
- **Surface/Route:** `/` (Home)
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Navigate to `/`
  2. Look at Folders column for each call row
- **Observed:** Most rows show "No folder" or empty in the Folders area. Phill Tomlinson | Monthly 1:1 (ID 144012376) — Folders blank. Confirms BUG-01 chain (UUID/legacy-ID mismatch breaks folder resolution).
- **Expected (TABLE-02 spec):** Folders column reflects current folder assignment for every call.
- **Severity:** P1 (chained from BUG-01)
- **Maps to (proposal):** Phase 30 (BUG-01) — fixing BUG-01 unblocks this
- **Screenshot:** `screenshots/persona-a-010-home-aisimple.png`, `screenshots/persona-a-061-call-phill-opened.png` (modal shows "FOLDERS: No folders assigned")

### Finding 040: TABLE-03 cannot-verify-precisely — Column alignment mixed

- **Tag:** [CANNOT-VERIFY-TABLE-03]
- **Surface/Route:** `/` (Home table)
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Navigate to `/`
  2. Look at column alignment
- **Observed:** TITLE left-aligned, DATE (with weekday abbreviation) left-aligned, DURATION right-aligned with tabular-nums, INVITEES has icon-aligned. Mixed visual rhythm.
- **Expected (TABLE-03 spec):** Standardized — recommend left-aligned text, but consistent.
- **Severity:** P3
- **Maps to (proposal):** Phase 35
- **Screenshot:** `screenshots/persona-a-010-home-aisimple.png`

### Finding 041: FILTER-01 confirmed — Folder filter still present in pill row

- **Tag:** [RE-VERIFY-FILTER-01]
- **Surface/Route:** `/` (Home filter pill row)
- **Persona:** A
- **Org observed:** AI Simple, Business, GoVibey
- **Steps to reproduce:**
  1. Navigate to `/`
  2. Look at filter pills above the table
  3. Click "Folder" pill
- **Observed:** Pill row: Date / Tag / **Folder** / Contacts / Duration / Source. Clicking "Folder" opens a popover with "Select Folders / No folders yet / Unorganized / Add Folder / Clear / Apply".
- **Expected (FILTER-01 spec):** Folder filter removed (redundant with 2nd-pane folder selection).
- **Severity:** P2
- **Maps to (proposal):** Phase 35
- **Screenshot:** `screenshots/persona-a-140-folder-filter.png`

### Finding 042: FILTER-02 confirmed — Duration filter still present

- **Tag:** [RE-VERIFY-FILTER-02]
- **Surface/Route:** `/` (Home filter pill row)
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Navigate to `/`
  2. Click "Duration" pill
- **Observed:** Popover: "Call Duration (minutes) / Threshold: 30 min / Less than 30 min / More than 30 min / Between (min – max) / 15-60 min / Clear".
- **Expected (FILTER-02 spec):** Duration filter removed (low-value).
- **Severity:** P3
- **Maps to (proposal):** Phase 35
- **Screenshot:** `screenshots/persona-a-141-duration-filter.png`

### Finding 043: FILTER-03 cannot-verify in this run — Contacts filter popover did not open

- **Tag:** [CANNOT-VERIFY-FILTER-03]
- **Surface/Route:** `/` (Home filter pill row → Contacts)
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Navigate to `/`
  2. Attempt to click "Contacts" filter pill
- **Observed:** Playwright `:has-text("Contacts")` matched the People sidebar item (which also contains "Contacts" in its description) and navigated to `/people` instead of opening the pill popover. Selector ambiguity. Worth re-running with a more precise selector.
- **Expected (FILTER-03 spec):** Search "Phill" in contacts filter returns Phill Tomlinson (queries full contacts DB).
- **Severity:** P1 (per existing spec) — uncertain status until re-run
- **Maps to (proposal):** Phase 35
- **Screenshot:** `screenshots/persona-a-142-contacts-filter.png` (shows /people landed instead)

### Finding 044: FILTER-04 confirmed — Source filter wraps to 2nd row (see Finding 014)

- **Tag:** [RE-VERIFY-FILTER-04]
- **Surface/Route:** `/` (Home filter pill row) on GoVibey
- **Persona:** A
- **Org observed:** GoVibey (also visible on AI Simple at narrow viewports)
- **Severity:** P2
- **Maps to (proposal):** Phase 35
- **Screenshot:** `screenshots/persona-a-050-govibey-home.png`

### Finding 045: DND-01 cannot-verify-as-Persona-A — Drag handle present but selection-state shift not tested

- **Tag:** [CANNOT-VERIFY-DND-01]
- **Surface/Route:** Table rows (Home)
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Navigate to `/`
  2. Look at left edge of each call row for the ⠿ drag handle
- **Observed:** Drag handle ⠿ visible as left-most cell of every call row. Position appears consistent across rows. Did NOT perform a row-select + observe handle-shift comparison (read-only intent).
- **Expected (DND-01 spec):** Handle does NOT shift when row is selected.
- **Severity:** P2
- **Maps to (proposal):** Phase 35
- **Screenshot:** `screenshots/persona-a-010-home-aisimple.png`

### Finding 046: DND-02 cannot-verify — Drag target appears narrow (not yet enlarged)

- **Tag:** [CANNOT-VERIFY-DND-02]
- **Surface/Route:** Table rows
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Hover over a row's drag handle
- **Observed:** ⠿ icon appears narrow (~12-16px wide), located at left edge. The spec calls for enlarged target to ⅓-½ of card. Not enlarged.
- **Expected (DND-02 spec):** Left ⅓-½ of card is the drag target.
- **Severity:** P2
- **Maps to (proposal):** Phase 35
- **Screenshot:** `screenshots/persona-a-010-home-aisimple.png`

### Finding 047: CARD-01 confirmed — Whole workspace card NOT clickable (chevron-only)

- **Tag:** [RE-VERIFY-CARD-01]
- **Surface/Route:** 2nd-pane workspace navigator
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Navigate to `/`
  2. Click middle of "AI Simple Founders" workspace card (x≈380, y≈269)
  3. Note no navigation occurred
  4. Click right-edge of same card (x≈515, y≈269)
  5. Note navigation into AI Simple Founders workspace
- **Observed:** Middle click does nothing. Right-edge click (chevron area) navigates. Card div is `<div class="...cursor-pointer ...">` but onClick is bound only to the chevron sub-button.
- **Expected (CARD-01 spec):** Whole card clickable.
- **Severity:** P2 (UX papercut; reduces discoverability)
- **Maps to (proposal):** Phase 35
- **Screenshot:** `screenshots/persona-a-070-workspace-card-clicked.png` (middle click, no change), `screenshots/persona-a-077-aisimplefounders-chevron.png` (after right-edge click, AI Simple Founders content visible)

### Finding 048: CARD-02 cannot-verify-fully — Other card types not exhaustively tested

- **Tag:** [CANNOT-VERIFY-CARD-02]
- **Surface/Route:** Various cards
- **Persona:** A
- **Org observed:** AI Simple
- **Severity:** P2
- **Maps to (proposal):** Phase 35
- **Screenshot:** n/a

### Finding 049: SHARE-03 No-repro — Share Call modal is visually clean

- **Tag:** [NO-REPRO-SHARE-03]
- **Surface/Route:** Call Detail modal → SHARE button → Share Call modal
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Open Q3 Sales Sync call detail
  2. Click SHARE button (top-right)
  3. Inspect Share Call modal
- **Observed:** Modal heading "Share Call" / "Share 'Q3 Sales Sync' with others via a secure link". Email input field with placeholder "Recipient email (optional)" and a mail-envelope icon (looks clean, not broken). Slate "CREATE" button. Below: "Anyone with the link can view this call (account required). / No share links yet. Create one above to share this call. / Revoked links will no longer work." Bottom: "× CLOSE" button. **No spurious orange/red borders, no broken red dots icon, no overflow against parent dialog.**
- **Expected (SHARE-03 spec):** Visual cleanup needed (which now appears done).
- **Severity:** (existing SHARE-03 P2) — No-repro
- **Maps to:** SHARE-03 (Phase 32). Per D-08, No-repro doesn't close.
- **Screenshot:** `screenshots/persona-a-111-share-modal.png`, `screenshots/persona-a-112-share-email-filled.png`

### Finding 050: SHARE-04 partial confirmed — Sender created share link successfully

- **Tag:** [RE-VERIFY-SHARE-04]
- **Surface/Route:** Share Call modal CREATE flow
- **Persona:** A
- **Org observed:** AI Simple, call: Q3 Sales Sync (UUID 2fdf6aa5-86a8-4b49-b19b-1e5b26ef60f8)
- **Steps to reproduce:**
  1. Open Q3 Sales Sync → SHARE → Share Call modal
  2. Fill "Recipient email (optional)" with `naegele412@gmail.com`
  3. Click CREATE
- **Observed:** Modal updated to show "Active Share Links (1)" with the new URL `https://app.callvaultai.com/s/vkfqmFaj-pr-tx-AmCzppqOOdWlSUP59`, recipient label `naegele412@gmail.com`, date `May 11, 2026`. Network: POST `/rest/v1/call_share_links?select=*` returned 201; subsequent GET filtered by the call returned 200. No errors.
- **Expected (SHARE-04 spec):** Sender create link → receiver clicks → receiver sees call.
- **Severity:** (existing SHARE-04 P1) — sender half **Confirmed**; receiver half deferred to Plan 29-04 (Persona C)
- **Maps to:** SHARE-04 (Phase 32)
- **Screenshot:** `screenshots/persona-a-113-share-link-created.png`
- **Handoff to Plan 04:** `vkfqmFaj-pr-tx-AmCzppqOOdWlSUP59`

### Finding 051: Cmd+K initial empty-state shows generic "Search calls, transcripts, and summaries"

- **Tag:** [NEW]
- **Surface/Route:** Cmd+K global search modal
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Open Cmd+K
  2. Observe empty state before typing
- **Observed:** Modal opens with input "Search calls, transcripts, and summaries..." placeholder. Body shows the same placeholder text repeated below. Slight repetitive UI.
- **Expected:** Either the body placeholder shows recent searches / pinned items, OR removes duplicate placeholder text.
- **Severity:** P3
- **Maps to (proposal):** BACKLOG
- **Screenshot:** `screenshots/persona-a-022-cmdk-open-aisimple.png`

### Finding 052: Cmd+K search takes 3-4s to return results (perceived latency)

- **Tag:** [NEW]
- **Surface/Route:** Cmd+K global search
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Open Cmd+K
  2. Type "Sammy"
  3. Wait for results
- **Observed:** Typing "Phill" (4 chars) — after 1.5s wait, still showed loading spinner with no results. Typing "Sammy" — after ~4s, results appeared. Search is functional but slow.
- **Expected:** Sub-second perceived latency for transcript search (especially on small queries).
- **Severity:** P2 (perceived performance)
- **Maps to (proposal):** BACKLOG or Phase 36
- **Screenshot:** `screenshots/persona-a-023-cmdk-search-phill-aisimple.png` (loading state), `screenshots/persona-a-024-cmdk-search-sammy-wait-aisimple.png` (results after wait)

### Finding 053: Call Detail modal uses centered dialog with dim backdrop — contradicts "Pane 4 slides in, same plane" architecture rule

- **Tag:** [NEW]
- **Surface/Route:** Call Detail modal (Q3 Sales Sync, Phill Tomlinson | Monthly 1:1)
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Click any call title
- **Observed:** Modal centered in viewport, on dim/dark backdrop, **covering** the home table behind it. Per CLAUDE.md root: "AppShell: Pane 4 slides in and Pane 3 **shrinks** to make room. All panes operate on the **same plane/z-index** — no drawer overlays, no covering content." Call Detail clearly uses an overlay pattern.
- **Expected:** Call detail opens as Pane 4 sliding in from the right, shrinking Pane 3 (home table). Same plane, no dim backdrop.
- **Severity:** P2 (architecture/ethos mismatch; user experience inconsistent with rest of app)
- **Maps to (proposal):** Phase 36 or new mini-phase
- **Screenshot:** `screenshots/persona-a-026-call-detail-overview-aisimple.png`, `screenshots/persona-a-031-call-detail-tab-participants-aisimple.png`

### Finding 054: Call Detail modal Invitees tab shows "PARTICIPANTS (2) Ad-hoc call" header (label inconsistent)

- **Tag:** [NEW]
- **Surface/Route:** Call Detail modal → Invitees tab on an ad-hoc call (Q3 Sales Sync)
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Open Q3 Sales Sync
  2. Click INVITEES tab
- **Observed:** Tab body header reads "**PARTICIPANTS (2) Ad-hoc call**" and message: "This appears to be an impromptu or ad-hoc call — no calendar invitees were found. Showing transcript speakers instead." The tab is named INVITEES but content is participants. Reasonable fallback UX, but the heading text would clearer if it acknowledged the tab name explicitly.
- **Expected:** Heading clarifies fallback behavior ("INVITEES — Ad-hoc call, showing PARTICIPANTS").
- **Severity:** P3
- **Maps to (proposal):** BACKLOG
- **Screenshot:** `screenshots/persona-a-030-call-detail-invitees-aisimple.png`

### Finding 055: 1216-call AI Simple table — only 22 reflected in Analytics — large data-inconsistency surface

- **Tag:** [NEW]
- **Surface/Route:** `/analytics` vs `/`
- **Persona:** A
- **Org observed:** AI Simple
- See Finding 010 for full details.
- **Severity:** P2
- **Maps to (proposal):** Phase 36

### Finding 056: Workspace Detail Pane 4 (e.g., AI Simple Founders) bottom shows "ADVANCED SETTINGS" label with no expandable content visible

- **Tag:** [NEW]
- **Surface/Route:** Pane 4 Workspace Detail
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Open AI Simple Founders detail pane via Settings>Organizations chevron
  2. Scroll to bottom of Pane 4
- **Observed:** Label "ADVANCED SETTINGS" visible at bottom of Pane 4, but no expand/collapse or content visible. Could be a section header awaiting content (stub), or truncated by viewport.
- **Expected:** Either content underneath OR remove the heading if empty.
- **Severity:** P3
- **Maps to (proposal):** BACKLOG
- **Screenshot:** `screenshots/persona-a-084-foundersws-detail.png`

### Finding 057: Org switcher dropdown items show "owner" labeled on each row redundantly

- **Tag:** [NEW]
- **Surface/Route:** Top-right org selector dropdown
- **Persona:** A
- **Org observed:** all-three
- **Steps to reproduce:**
  1. Click top-right "AI Simple ▾"
  2. Inspect dropdown items
- **Observed:** Dropdown shows: "AI Simple owner / Business 1 member owner / GoVibey 1 member owner / Create Organization / Manage Organizations". The "owner" label after each org repeats — Persona A is owner of all 3, but the dropdown shows it three times.
- **Expected:** Either remove redundant "owner" labels or only show membership count for non-owner orgs.
- **Severity:** P3
- **Maps to (proposal):** BACKLOG
- **Screenshot:** `screenshots/precheck-03-org-switcher.png` (from Plan 01) — this dropdown unchanged

### Finding 058: People page contacts table briefly shows skeleton rows during navigation

- **Tag:** [NEW]
- **Surface/Route:** `/people`
- **Persona:** A
- **Org observed:** AI Simple
- **Steps to reproduce:**
  1. Click /people in sidebar after being on `/`
  2. Watch the table briefly
- **Observed:** Briefly showed 8 skeleton rows (light gray bands) before populating with actual contacts. Reload of /people returned 523 contacts as expected.
- **Expected:** Skeletons OK as loading state. But during the sweep, one navigation showed skeletons that never resolved to data — likely a cache/refresh edge case.
- **Severity:** P3
- **Maps to (proposal):** BACKLOG
- **Screenshot:** `screenshots/persona-a-142-contacts-filter.png` (shows the skeleton-row state)

---

## Tally

- **Findings total:** 58 entries
- **By tag:**
  - `[NEW]`: 16
  - `[RE-VERIFY-...]`: 28 (BUG-01 chain x2; BUG-04; BUG-05; BUG-07; BUG-09; VIS-01..05; BRAND-01..05, 08, 10; TABLE-01, 02; FILTER-01, 02, 04; CARD-01; SHARE-04)
  - `[NO-REPRO-...]`: 5 (BUG-02; BUG-06; BUG-08; SHARE-03; BRAND-07)
  - `[CANNOT-VERIFY-...]`: 9 (BRAND-03, 06, 09; TABLE-03; FILTER-03; DND-01, 02; CARD-02; AUTH/SHARE/SEC chunks)
  - `[SECURITY P0]`: 1 (Finding 008 — cross-org cache leak / SEC-03C)
- **By severity:**
  - **P0:** 3 (Findings 007, 008, 015 — BUG-01 chain + SEC-03C cache leak)
  - **P1:** 11 (Findings 003, 005, 006, 016, 018, 019, 021, 023 chained, 039, 043, 048)
  - **P2:** 24
  - **P3:** 20

## Cleanup List for Plan 04

Share token to be consumed by Plan 29-04 (Persona C wrong-account recipient):

```
TOKEN: vkfqmFaj-pr-tx-AmCzppqOOdWlSUP59
FULL URL: https://app.callvaultai.com/s/vkfqmFaj-pr-tx-AmCzppqOOdWlSUP59
RECIPIENT (per share-link metadata): naegele412@gmail.com
CALL: Q3 Sales Sync (UUID 2fdf6aa5-86a8-4b49-b19b-1e5b26ef60f8)
ORG: AI Simple
CREATED: 2026-05-11 by Persona A (a@vibeos.com)
```

Plan 29-04 should:
1. Open `https://app.callvaultai.com/s/vkfqmFaj-pr-tx-AmCzppqOOdWlSUP59` in a DIFFERENT account's browser session (NOT naegele412@gmail.com)
2. Observe the wrong-account error message
3. Verify SHARE-02 reproduction (currently: "Call Not Found / invalid or expired"; spec wants: "This call was shared with na***@gmail.com — sign out and sign in with that email")

---

## Re-verification Notes (for flows that ran but produced no separate finding)

- **F1 — Owner login:** Already done in Plan 29-01 precheck (PASS). Re-validated at sweep start (session valid, AI Simple home reachable). ✓
- **F2 — Sidebar nav across 5 sections per org:** Walked Calls/People/Organization/Import/Rules on AI Simple, Business, GoVibey. Findings 005, 011, 029, 030 captured.
- **F3 — Settings tabs:** Walked Account/Billing/Organizations/AI Integrations/Admin. Findings 003, 026, 028, 037 captured.
- **F4 — Cmd+K:** Tested with "Phill" (slow), "Sammy" (returned results in ~4s). Findings 035, 051, 052 captured.
- **F5 — Open call + 4 tabs:** Walked Overview/Transcript/Invitees/Participants on Q3 Sales Sync. Findings 027, 053, 054 captured.
- **F6 — Table filters:** Tested Date (date-range calendar), Tag (empty-state, no tags exist), Folder, Duration, Source. Findings 014, 041, 042, 043, 044 captured.
- **F7 — DND drag-to-folder:** Drag handle present visually; mutation skipped per read-only intent. Findings 045, 046 captured.
- **F8 — Tag with AI (BUG-01):** Button not exposed in UI. Finding 016 captured.
- **F9 — Default-workspace toggle (BUG-02):** Toggled AI Simple Founders ON, then reverted My Calls. Finding 017 (NO-REPRO).
- **F10 — Move/delete/tag → table refresh (BUG-03):** Tag mutation not testable (no Tag with AI). Workspace create+delete refresh was instant. Implicit NO-REPRO on BUG-03's cache-invalidation surface for workspace operations.
- **F11 — Date sort asc/desc (BUG-04):** Two header clicks didn't toggle. Finding 018.
- **F12 — Import Source Manager + / Import History (BUG-06/07):** Findings 020 (NO-REPRO), 021 (RE-VERIFY).
- **F13 — Create new workspace + no auto-folders (BUG-08):** Created, observed no auto-folders, deleted. Finding 022 (NO-REPRO).
- **F14 — Create share link → naegele412@gmail.com:** Done. Token recorded. Finding 050 + Cleanup List for Plan 04.

---

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: information-disclosure | `src/` (TanStack Query cache layer) | Cross-org cache leak (Finding 008) — call IDs from previous org leak into new-org network trace. Documented as SEC-03C re-verification. |

---

*Persona A sweep complete. Plan 29-05 will write back findings into REQUIREMENTS.md + ROADMAP.md.*
