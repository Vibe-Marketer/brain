# Phase 29: QA Sweep & Regression Catalog - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 29 is the **discovery / cataloging foundation** of v2.2. Its deliverable is a regression catalog — NOT implementation. Concretely, the phase produces:

1. A dev-browser walkthrough of `app.callvaultai.com` covering every documented route + every primary user flow
2. New `QA-NN` requirement items appended to `.planning/REQUIREMENTS.md` for every genuinely-new bug or visual defect observed
3. A "Sweep Status" column added to the REQUIREMENTS.md traceability table recording whether each pre-existing requirement (BUG-01..09, VIS-01..05, BRAND-01..10, etc.) still reproduces on production
4. Each new `QA-NN` mapped to a destination — an existing v2.2 phase (most go to Phase 36 as catch-all), a new themed mini-phase if ≥3 findings cluster, or BACKLOG (for P2/P3)
5. Screenshots and (when applicable) console/network log captures stored phase-locally under `.planning/phases/29-qa-sweep-regression-catalog/screenshots/`

**In scope:**
- Dev-browser walkthrough on production (`app.callvaultai.com`) — driver is Claude per CLAUDE.md HARD RULE
- All routes in `src/App.tsx` + primary user flows checklist
- Three personas: owner cycled across 3 orgs; fresh signup as `soren@vibeos.com`; wrong-account share recipient
- Re-verification of all 55 existing v2.2 requirements (whether they still reproduce, no-repro, or cannot-verify)
- Cataloging genuinely-new findings as `QA-NN` items with mapping + severity
- Editing REQUIREMENTS.md, ROADMAP.md (for new mini-phases only, if needed), and BACKLOG.md

**Out of scope:**
- ANY bug fix code. Phase 29 documents; downstream phases fix.
- Re-cataloging existing requirements as duplicate QA-NN entries (existing reqs keep their original IDs)
- Auto-closing requirements based on a single No-repro observation
- Member-role / non-admin user sweeps (deferred unless surfaced by a P0/P1 finding)
- Anonymous / signed-out share-recipient sweep (covered by SHARE-01 planning in Phase 32)
- Google OAuth fresh signup sweep (covered by AUTH-05 in Phase 31)
- Localhost / dev / test environment sweeping — production only

</domain>

<decisions>
## Implementation Decisions

### D-01 — Personas: owner (3-org cycle) + fresh signup + wrong-account share recipient
- **Locked:** Three personas drive the sweep.
  - **Persona A — Owner cycling all 3 orgs.** Use `CALLVAULTAI_LOGIN` / `CALLVAULTAI_LOGIN_PASSWORD` from `.env`. On every major surface (sidebar, 2nd pane, 3rd-pane table, settings tabs, share modal, import modal, call-detail modal, billing), cycle through **AI SIMPLE → BUSINESS → GOVIBEY** and confirm parity. This catches cross-org cache leaks (related to SEC-03C) and org-specific selection-state bugs.
  - **Persona B — Fresh signup as `soren@vibeos.com`.** Free-tier path. Tests AUTH-01 (signup completes), AUTH-02 (pricing page shown before account creation), AUTH-03 (payment gate before onboarding), AUTH-04 (signup error surfacing). REQUIREMENTS.md already names this account as the canonical free-tier test target.
  - **Persona C — Wrong-account share recipient.** Owner creates a share link addressed to a known email (e.g., `naegele412@gmail.com`). A separate browser session signed in as a DIFFERENT account opens the link. Surfaces SHARE-02 wrong-account error directly. Anonymous (signed-out) recipient flow is deferred to Phase 32 planning.
- **Why:** Each persona unlocks a distinct class of bugs that the other two can't surface. Owner-only would miss every front-door (signup/payment) and share-recipient bug.
- **Edge case:** If `soren@vibeos.com` already has an account from a previous test run, document that as a QA-NN ("free-tier signup blocked because account exists") and use a throwaway alternative. Do NOT delete account state from production database.

### D-02 — Skipped personas (documented)
- **Locked deferred:**
  - Google OAuth fresh signup — AUTH-05 is in Phase 31 scope; runs there
  - Anonymous (signed-out) share recipient — SHARE-01 is in Phase 32 scope; runs there
  - Member-role non-admin user — not in v2.2 unless a P0/P1 finding requires it
- **Why:** Each is already owned by a downstream phase. Sweeping them here would duplicate verification effort.

### D-03 — Evidence format per QA-NN entry: text + inline screenshot + conditional log
- **Locked default format for every new QA-NN entry:**
  ```
  - [ ] **QA-NN** — {one-line title}
    - **Surface/Route:** {URL or in-app location}
    - **Persona:** {A | B | C}
    - **Steps to reproduce:**
      1. {step}
      2. {step}
    - **Observed:** {what happened}
    - **Expected:** {what should happen}
    - **Severity:** {P0 | P1 | P2 | P3}
    - **Maps to:** {Phase NN — or BACKLOG}
    - **Screenshot:** ![](screenshots/qa-NN-{slug}.png)
    - **Backend log (conditional):** {include only when console error / 4xx-5xx / RLS denial observed}
  ```
- **Rationale:** Title + steps + screenshot is the minimum that satisfies ROADMAP success criterion #4 ("a developer could reproduce every finding from the written description alone"). Backend log is captured only when relevant so visual-only bugs don't carry irrelevant data. Mirrors how `BUG-01` (HTTP `invalid input syntax for type uuid`) and `BUG-02` (HTTP 406 PGRST116) are already structured in REQUIREMENTS.md.

### D-04 — Screenshot storage: phase-local, committed to git
- **Locked:** Save screenshots to `.planning/phases/29-qa-sweep-regression-catalog/screenshots/` with filename pattern `qa-NN-{kebab-slug}.png` (and `qa-NN-{slug}-{seq}.png` for entries with multiple shots).
- **Why:** Permanent reference, no external dependency, browsable from the QA catalog forever. Repo will grow by 2-5 MB — acceptable for the durability gain.
- **Tradeoff:** Repo size grows. Mitigation: PNG screenshots only; no video. Compress with `pngquant` if total exceeds 10 MB.

### D-05 — Conditional backend log capture
- **Locked:** Append a backend log snippet to a QA-NN entry ONLY when one of these is observed during the bug reproduction:
  - Console `error` level message
  - Any network response with status ≥ 400
  - Postgres / RLS error text visible in console or response body
  - Supabase auth failure surface
- **Format:** A short fenced code block in the QA-NN entry (e.g., `console: invalid input syntax for type uuid: "143800259"` or `network: PATCH /workspaces 406 PGRST116 — "JSON object requested, multiple (or no) rows returned"`). Long stack traces truncated to relevant frames.
- **Why:** Mirrors the level of detail in BUG-01 / BUG-02 / SEC-* items. Visual-only bugs don't need this; backend bugs do.

### D-06 — Dedupe policy: re-verify existing, only catalog NEW as QA-NN
- **Locked:** While sweeping, every observation is matched against the 55 existing v2.2 requirements (BUG-*, VIS-*, BRAND-*, TABLE-*, FILTER-*, DND-*, CARD-*, AUTH-*, SHARE-*, SEC-*, FEAT-*, DEBT-*).
  - If a matching existing requirement is found → DO NOT create a duplicate QA-NN. Instead, record the observation in the Sweep Status column (see D-07).
  - If no matching existing requirement → create a new QA-NN entry.
- **Why:** Re-cataloging 50+ already-cataloged bugs as duplicate QA-NN IDs creates noise. Single-source-of-truth: every bug has exactly one canonical requirement ID (its original) plus a sweep status note.
- **Partial-match policy:** When an observation is "close but not identical" to an existing requirement (e.g., BUG-02 covers workspace update 406 but the sweep observes a 406 on `organizations` PATCH), create a NEW `QA-NN` and reference the related existing requirement in the entry's body ("Related: BUG-02"). The threshold is "same surface AND same root cause" → match; otherwise → new entry.

### D-07 — Sweep Status column added to REQUIREMENTS.md traceability table
- **Locked:** Add a new "Sweep Status" column to the traceability table at the bottom of `.planning/REQUIREMENTS.md` with these values:
  - **`Confirmed`** — observed still reproducing on production during sweep
  - **`No-repro`** — cannot reproduce on production during sweep
  - **`Cannot-verify`** — requires non-prod state (e.g., a specific Fathom OAuth state, a free-tier account that doesn't exist yet, a multi-Fathom-account user)
  - **`Not-tested`** — out of sweep scope for this phase (e.g., member-role flows)
- **Why:** Compact, single-source-of-truth, downstream phases consume it directly. Avoids creating a parallel SWEEP-LOG.md file that would drift out of sync with REQUIREMENTS.md.

### D-08 — `No-repro` does NOT auto-close a requirement
- **Locked:** A `No-repro` Sweep Status DOES NOT close the requirement. The requirement stays open. The implementing phase (30 / 31 / 36 / etc.) confirms via dev-browser before final closure.
- **Why:** A single sweep run is not authoritative — observations may miss due to mid-deploy state, different org, browser cache, or environmental flake. Mid-implementation re-verification is the ground truth for closure.
- **Implementation:** Downstream phases reading REQUIREMENTS.md should treat `No-repro` as a hint ("may already be fixed — re-verify first"), not a green light to skip.

### D-09 — Orphan mapping: Phase 36 default catch-all, themed mini-phase only when ≥3 cluster
- **Locked:**
  - **Default:** New `QA-NN` findings that don't naturally fit Phase 30/31/32/33/34/35/37/38/39/40/41 are appended to **Phase 36 (Critical Bug Sweep)** scope (added to its Requirements list in ROADMAP.md).
  - **Themed mini-phase:** When ≥3 new findings share a single subsystem (e.g., "transcript player", "MCP token UI", "org-admin panel"), spin up a new themed phase numbered between 41 and 42 (e.g., **Phase 41.5 — QA-Discovered: Transcript Player**). Update ROADMAP.md + Progress table accordingly.
  - **BACKLOG:** P2/P3 severity findings that don't fit any v2.2 phase go to `.planning/BACKLOG.md` for v2.3+ consideration.
- **Why:** Phase 36 already exists as the bug-fix catch-all; using it is zero overhead. The ≥3 threshold protects against creating single-purpose mini-phases for one-off bugs.

### D-10 — Severity tagging: P0/P1/P2/P3 with v2.2-inclusion rule
- **Locked rubric for every new QA-NN:**
  - **P0** — Data loss, security bypass (RLS leak, auth bypass, cross-org data exposure), signup completely broken, billing charges wrong. MUST ship in v2.2.
  - **P1** — High user frustration but app remains usable (broken core flow with workaround, visible error that doesn't crash). MUST ship in v2.2.
  - **P2** — Visual / polish / minor (spacing, label, mis-aligned border). Eligible for BACKLOG.
  - **P3** — Nice-to-have / micro-improvement. Eligible for BACKLOG.
- **Phase routing by severity:**
  - P0/P1 → routed per D-09 (Phase 36 or themed mini-phase)
  - P2/P3 → eligible for BACKLOG; downstream phase author decides
- **Why:** Clean cut-off rule for milestone scope discipline. P0/P1 force inclusion; P2/P3 are negotiable.

### D-11 — Coverage exit criteria: every route + every primary user flow
- **Locked:** Phase 29 exits when BOTH conditions are TRUE:
  1. **Route coverage:** Every route defined in `src/App.tsx` has been visited at least once on `app.callvaultai.com` by Persona A
  2. **Flow checklist coverage:** Every flow on the primary user flow checklist (below) has been completed end-to-end by the assigned persona
- **Primary user flow checklist (must be completed):**
  - Persona A — Owner login
  - Persona A — Sidebar nav across all sections (CALLS, IMPORT, RULES, PEOPLE, ORGANIZATION) in each of the 3 orgs
  - Persona A — Settings tabs (Account, Billing, Organizations, AI Integrations, Admin)
  - Persona A — Global search (Cmd+K) and results
  - Persona A — Open a call → Overview / Transcript / Invitees / Participants tabs
  - Persona A — Filter the 3rd-pane table by Date / Source / Contacts / Tags
  - Persona A — Drag a call to a folder (DND)
  - Persona A — Click "Tag with AI" on a Fathom-imported call (BUG-01 re-verify)
  - Persona A — Toggle default-workspace in Workspace Detail panel (BUG-02 re-verify)
  - Persona A — Move / delete / tag a call and verify table refresh (BUG-03 re-verify)
  - Persona A — Sort by Date ascending and descending (BUG-04 re-verify)
  - Persona A — Open Import Source Manager → click "+" and "Import History" buttons (BUG-06/07 re-verify)
  - Persona A — Create a new workspace and verify no auto-folders appear (BUG-08 re-verify)
  - Persona A — Create a share link addressed to a specific email
  - Persona B — Fresh signup as `soren@vibeos.com` end-to-end (or document the error)
  - Persona C — Open the share link from a wrong-account browser session
- **Why:** Concrete and verifiable, no time pressure. Prevents "I'll just keep poking around forever" or "ran out of time and missed half the surfaces". Time-boxed runs lose coverage in deep surfaces; open-ended runs never finish.

### D-12 — Catalog output format inside REQUIREMENTS.md
- **Locked:** New QA-NN entries are appended to REQUIREMENTS.md under a new section header `### QA Sweep Findings (Phase 29, 2026-05-11)`, inserted between the existing "Tech Debt" section and "Future Requirements" section.
- **Each QA-NN follows the format in D-03.** QA-NN IDs start at QA-02 (QA-01 is the existing sweep-execution requirement). Numbered sequentially in observation order.
- **Why:** Keeps the section grouped (downstream agents can find all sweep findings in one place). Sequential numbering keeps IDs stable.

### D-13 — Roadmap mutations Phase 29 may make
- **Locked:** Phase 29 IS allowed to mutate ROADMAP.md ONLY in these specific ways:
  - Add new QA-NN requirement IDs to existing phases' "Requirements" lists (e.g., Phase 36 grows from "BUG-02..09" to "BUG-02..09, QA-05, QA-12, ...")
  - Add a new themed mini-phase between 41 and 42 (e.g., 41.5) if ≥3 related QA-NN findings cluster
  - Update the Progress table (`## Progress` at end of ROADMAP.md) with the new phase if added
- **NOT allowed:** Reordering existing phases, removing requirements from existing phases, changing existing phases' dependencies.

### Claude's Discretion
- Screenshot filenames within the locked pattern (`qa-NN-{slug}.png`)
- Order of route walking within Persona A's pass
- How to organize the screenshots directory (flat or grouped by surface)
- Exact wording of new QA-NN titles (must convey the symptom in <80 chars)
- Whether to compress screenshots with `pngquant` (only required if total exceeds 10 MB)
- Whether to take secondary screenshots showing different states of the same bug (allowed but optional)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope source
- `.planning/ROADMAP.md` Phase 29 (lines ~58-67) — Goal, dependencies, requirements (QA-01), success criteria. The 4 success criteria define what "done" looks like for this phase.
- `.planning/REQUIREMENTS.md` — Active milestone requirements + traceability table. THIS is the target file the sweep edits. The "Sweep Status" column gets added here (D-07).
- `.planning/PROJECT.md` — Current milestone overview, target features for v2.2.

### Project conventions (MUST follow)
- `CLAUDE.md` (root) — One-Click Promise, KISS-UX Principle, **HARD RULE: dev-browser for ALL verification, never ask user to test**. Sweep driver is Claude per this rule.
- `src/CLAUDE.md` — Frontend design system + hard constraints (Remix Icons only, no AI label, vibe orange structural use). Reference for evaluating BRAND-* and VIS-* observations.
- `docs/CLAUDE.md` — Documentation standards (file naming, brand guidelines versioning).

### Design system (for BRAND / VIS / CARD / DND findings)
- `docs/design/brand-guidelines-v4.4.md` — Authoritative design system (colors, typography, components, selection-state pattern). Use to evaluate BRAND-01..10 and VIS-01..05 still reproduces.
- `docs/design/design-principles-callvault.md` — Visual development checklist + product ethos.

### Routing surface
- `src/App.tsx` — All routes defined here. Route coverage exit criterion (D-11) requires every route in this file to be visited.

### v2.2 milestone context
- `.planning/STATE.md` — Current phase, milestone progress, accumulated context.
- `.planning/BACKLOG.md` — Destination for P2/P3 findings + non-fitting orphans (D-09).
- `.planning/milestones/v2.1-ROADMAP.md` — Prior milestone roadmap (reference only).

### Prior phase context (for understanding what's already verified vs deferred)
- `.planning/milestones/v2.1-phases/27-close-v2-1-audit-gaps/27-CONTEXT.md` — Most recent CONTEXT.md. Documents the 13 deferred human-verification items from v2.0 and the v2.1 audit close-out (some of these items will surface again during the sweep).

### Test credentials
- `.env` (local, not committed) — `CALLVAULTAI_LOGIN` / `CALLVAULTAI_LOGIN_PASSWORD` for Persona A. Owner of 3 orgs (AI SIMPLE / BUSINESS / GOVIBEY).
- `soren@vibeos.com` — Persona B free-tier signup target (account state at sweep time TBD — check first, document if already exists).

### Memory (security context referenced by SEC-* items)
- `~/.claude/projects/-Users-Naegele-dev-brain/memory/project_security_audit_2026_05_07.md` — 2026-05-07 Edge Function security audit. Phase 28 deferrals (SEC-06..12) and v2.2 new scope (SEC-01..05) originate here. If the sweep surfaces a security-flavored finding, cross-reference this memory first.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **dev-browser MCP** (`mcp__dev-browser__*` family): Sweep driver. Already authenticated session can persist via stored cookies. Use `screenshot`, `navigate`, `evaluate`, `click`, `type`, and console/network log readers.
- **`.env` test credentials**: `CALLVAULTAI_LOGIN` + password for owner persona. No need to manage credentials separately.
- **REQUIREMENTS.md traceability table** (lines ~106-200): Existing structure to extend with the new "Sweep Status" column. Don't rebuild — extend.
- **Phase 36 (Critical Bug Sweep)** existing scope: Already exists as catch-all. New QA-NN findings append to its Requirements list (D-09).

### Established Patterns
- **REQUIREMENTS.md structure pattern**: Active Requirements grouped by area (Auth & Signup, Shared-Call, Critical Root-Cause Bugs, Selection State, etc.), each with `- [ ] **ID-NN** — description` format. New QA-NN entries follow this exact format but with the extended detail block from D-03.
- **Phase-local artifact pattern**: SUMMARY, UAT, VERIFICATION, SHIPPED-INVENTORY, screenshots all stored under `.planning/phases/{NN}-{slug}/`. Screenshots go in a `screenshots/` subdirectory (D-04).
- **Severity rubric pattern**: REQUIREMENTS.md already uses informal severity language ("Critical Root-Cause Bugs" section vs "Layout & Brand Polish"). Phase 29 formalizes this with explicit P0/P1/P2/P3 (D-10).

### Integration Points
- **REQUIREMENTS.md mutation** — sweep appends a new section + adds a column to the traceability table. Atomic git commit at sweep completion.
- **ROADMAP.md mutation** — append QA-NN IDs to Phase 36's Requirements list; potentially add new themed mini-phase (D-13).
- **BACKLOG.md mutation** — append P2/P3 findings that don't fit v2.2.
- **No source code changes** — Phase 29 is documentation-only. `src/` and `supabase/` are untouched.

</code_context>

<specifics>
## Specific Ideas

- **Use the 3-org cycle as the cross-check for cache-leak bugs.** When switching from AI SIMPLE to BUSINESS to GOVIBEY, watch for: (a) calls from the previous org momentarily appearing in the table, (b) folder counts that match the previous org, (c) AI-tag suggestions referencing previous-org data. These are SEC-03C symptoms.

- **`soren@vibeos.com` is the free-tier canary.** REQUIREMENTS.md AUTH-03 explicitly calls it out. The sweep is the first time this account hits the real signup flow — document EVERY screen it sees (pricing, payment, onboarding, error pages) verbatim. If the account already exists, that's itself a finding (P1).

- **Phase 36 already exists — don't recreate it.** Most orphan QA-NN findings (cache invalidation, alignment, accessibility) land there by default. Only create a new themed mini-phase (e.g., 41.5) when ≥3 findings cluster around one subsystem.

- **Screenshots are inline-referenced via relative path.** Markdown looks like `![](screenshots/qa-05-folder-empty-on-fathom-import.png)`. Keep filenames kebab-case and prefixed with the QA-NN ID for searchability.

- **Sweep Status column wording is locked (D-07).** Use exactly these four values: `Confirmed`, `No-repro`, `Cannot-verify`, `Not-tested`. Don't paraphrase — downstream agents will parse this column.

- **Backend log capture format mirrors REQUIREMENTS.md precedent.** BUG-01 already shows the format: ```invalid input syntax for type uuid: "143800259"```. BUG-02 shows network: ```HTTP 406 PGRST116 — "JSON object requested..."```. Match this style.

- **QA-NN numbering starts at QA-02.** QA-01 is the existing sweep-execution requirement. Sequential thereafter.

- **No source code changes during Phase 29.** If the sweep tempts an immediate fix (especially for a P0 with a 2-line fix), STOP — document the QA-NN, route it to its phase, let that phase fix it. Phase 29 is observation-only.

</specifics>

<deferred>
## Deferred Ideas

### Personas / scopes explicitly deferred
- **Google OAuth fresh signup** — covered by AUTH-05 in Phase 31 scope (D-02)
- **Anonymous (signed-out) share recipient** — covered by SHARE-01 in Phase 32 scope (D-02)
- **Member-role / non-admin user sweep** — only added to v2.2 if a P0/P1 finding surfaces a role-gated bug (D-02)
- **Multi-Fathom-account user testing** — FEAT-01 (Phase 39) requirement #4 explicitly covers this; out of scope for Phase 29

### Tooling / methodology ideas raised but not implemented
- **Video-clip evidence capture** — considered but rejected; PNG screenshots are sufficient and don't bloat the repo with binary media
- **Inline base64 screenshots in REQUIREMENTS.md** — rejected (D-04); file-based storage is cleaner
- **External screenshot hosting (Supabase Storage / Drive)** — rejected (D-04); phase-local + git is more durable
- **Time-boxed sweep duration** — rejected (D-11); coverage-based exit is more reliable
- **Mobile viewport sweep** — not in scope; CallVault v2.2 is desktop-first per current PROJECT.md

### Catalog-quality enhancements considered but not in scope
- **Automated regression test generation from QA-NN findings** — interesting, deferred to v2.3+
- **Severity auto-classification** (e.g., from console error patterns) — manual P0/P1/P2/P3 tagging is enough for v2.2 catalog volume
- **Re-running the sweep at milestone close** — would be useful but is a separate "v2.2 close-out sweep" phase, not Phase 29

### Reviewed Todos (not folded)
No todos were folded from the cross_reference_todos step — `gsd-sdk query todo.match-phase 29` returned zero matches.

</deferred>

---

*Phase: 29-qa-sweep-regression-catalog*
*Context gathered: 2026-05-11*
