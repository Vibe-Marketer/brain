# Phase 29: QA Sweep & Regression Catalog - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-11
**Phase:** 29-qa-sweep-regression-catalog
**Areas discussed:** Persona, Evidence, Dedupe, Mapping

---

## Persona — Account/persona dimension

### Q1 — Which logged-in user(s) should drive the production sweep?

| Option | Description | Selected |
|--------|-------------|----------|
| Owner test acct only | Sweep entirely as owner. Fast, covers ~80%. Auth/signup/share-recipient tested as standalone. | |
| Owner + fresh signup + share-recipient | Three personas — owner drives most pages, fresh signup covers auth/onboarding/payment, wrong-account share covers SHARE-02. Most thorough but ~3x longer. | ✓ |
| Owner + member-only seat | Owner drives main sweep, then member-role user to surface role-gated bugs. | |

**User's choice:** Owner + fresh signup + share-recipient

### Q2 — For the fresh-signup persona, what email + plan path should be used?

| Option | Description | Selected |
|--------|-------------|----------|
| soren@vibeos.com (free-tier path) | REQUIREMENTS.md AUTH-03 already names this account as the free-tier test target. | ✓ |
| Brand-new throwaway email + free tier | Cleanest possible signup flow with no leftover state. Need a new throwaway every run. | |
| Both email signup AND Google OAuth signup | Run TWO fresh signups — email/password (AUTH-01) and Google OAuth (AUTH-05). | |

**User's choice:** soren@vibeos.com (free-tier path)

### Q3 — For the share-recipient persona, how should the wrong-account scenario be staged?

| Option | Description | Selected |
|--------|-------------|----------|
| Owner shares with known email; sweep logs in as the wrong account | Surfaces SHARE-02 wrong-account error directly. | ✓ |
| Both wrong-account AND right-account flows | Tests SHARE-02 error path AND SHARE-04 happy path. | |
| Anonymous (signed-out) recipient | Tests public landing page expectation (SHARE-01). | |

**User's choice:** Owner shares with known email; sweep logs in as the wrong account

### Q4 — Within the owner account, how should we handle multi-org switching during the sweep?

| Option | Description | Selected |
|--------|-------------|----------|
| Switch through all orgs once per major surface | Cycle AI SIMPLE → BUSINESS → GOVIBEY on each major surface; catches cross-org cache leaks and org-specific selection-state bugs. | ✓ |
| Single org only | Faster but misses org-switching cache leaks and 2nd-pane org-selector bugs. | |
| Two-org sample | Sweep primarily in one org, then switch to a second to confirm parity. | |

**User's choice:** Switch through all orgs once per major surface

**Notes:** Persona dimension well-defined: 3 personas (owner across 3 orgs, fresh signup as soren@vibeos.com, wrong-account share recipient).

---

## Evidence — Evidence depth per QA-NN

### Q1 — How thorough should each QA-NN catalog entry be?

| Option | Description | Selected |
|--------|-------------|----------|
| Steps + screenshot | Title, repro steps, URL, observed, expected, inline screenshot. Strikes balance with success criterion #4. | ✓ |
| Text-only (steps + observed/expected) | No screenshots. Fastest. Visual bugs lose fidelity. | |
| Full forensic bundle | Steps + screenshot + console log + network HAR + timestamp. Most thorough; heavy for visual-only. | |

**User's choice:** Steps + screenshot

### Q2 — Where should the screenshots be stored?

| Option | Description | Selected |
|--------|-------------|----------|
| Phase-local: .planning/phases/29-.../screenshots/ | Committed to git alongside REQUIREMENTS.md. Permanent reference. ~2-5 MB repo growth. | ✓ |
| Inline as base64 in REQUIREMENTS.md | Self-contained but bloats REQUIREMENTS.md hugely. | |
| External: Supabase Storage / Google Drive | Keeps repo small but adds external dependency + dead-link risk. | |

**User's choice:** Phase-local: .planning/phases/29-.../screenshots/

### Q3 — When a bug has a backend symptom, should we ALSO capture console/network log?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — capture console + network only when backend error observed | Visual-only stays text+screenshot. Backend symptoms get log snippet. Mirrors BUG-01 / BUG-02 style. | ✓ |
| No — keep all entries text+screenshot uniformly | Simpler format but loses signal on backend issues. | |
| Capture console+network for ALL entries | Most consistent but overkill for visual bugs. | |

**User's choice:** Yes — capture console + network only when backend error observed

**Notes:** Evidence format locked at text + inline screenshot, plus conditional backend log when an error is observed.

---

## Dedupe — Dedupe vs existing requirements

### Q1 — When the sweep observes a bug that's already documented as an existing requirement, what should we do?

| Option | Description | Selected |
|--------|-------------|----------|
| Re-verify all existing reqs and only catalog NEW findings as QA-NN | Re-verify in a Sweep Status column. New findings get QA-NN. Keeps catalog clean. | ✓ |
| Catalog everything observed as QA-NN, cross-reference where overlap | Doubles the catalog with duplicates. | |
| Only catalog NEW findings, do not re-verify existing | Skip past matches; only QA-NN for new bugs. Loses 're-still-broken?' signal. | |

**User's choice:** Re-verify all existing reqs and only catalog NEW findings as QA-NN

### Q2 — How should the 'still reproduces / no-repro / cannot-reproduce' verification be recorded?

| Option | Description | Selected |
|--------|-------------|----------|
| New 'Sweep Status' column on the traceability table | Compact, single-source-of-truth, easy for downstream phases to consume. | ✓ |
| Separate 29-SWEEP-LOG.md file | Standalone file. REQUIREMENTS.md untouched but creates second source. | |
| Inline annotations on each requirement bullet | Inline visibility but bloats the file. | |

**User's choice:** New 'Sweep Status' column on the traceability table

### Q3 — If a requirement comes up as 'No-repro' on production during the sweep, what should we do?

| Option | Description | Selected |
|--------|-------------|----------|
| Mark No-repro + downgrade to 'pending re-verify' — don't auto-close | Implementing phase confirms via dev-browser before closing. Avoids false-close. | ✓ |
| Auto-close: if not reproducible on production, the requirement is closed | Faster but risks closing genuinely-still-broken bugs. | |
| Move to a 'Sweep Discovery: Possibly Fixed' section | Explicit but adds bookkeeping overhead. | |

**User's choice:** Mark No-repro + downgrade to 'pending re-verify' — don't auto-close

**Notes:** Dedupe locked: re-verify existing, Sweep Status column added, No-repro never auto-closes.

---

## Mapping — Mapping strategy for orphans + severity + exit criteria

### Q1 — When a new QA-NN finding doesn't naturally fit into Phases 30-41, where should it land?

| Option | Description | Selected |
|--------|-------------|----------|
| Default to Phase 36 (Critical Bug Sweep); new mini-phase only when ≥3 related findings share a theme | Phase 36 already exists as catch-all. Mini-phase only when cluster justifies it. | ✓ |
| Always create a new dedicated phase for QA discoveries | Easier to track as a unit but bloats roadmap with single-purpose phase. | |
| Defer all orphans to v2.3 BACKLOG by default | Keeps v2.2 frozen but means QA findings might not be fixed for months. | |

**User's choice:** Default to Phase 36 (Critical Bug Sweep) as catch-all; spin up new mini-phase only when ≥3 related findings share a theme

### Q2 — Should QA-NN findings carry a severity tag, and what gates v2.2 vs v2.3+?

| Option | Description | Selected |
|--------|-------------|----------|
| P0/P1/P2/P3 — P0/P1 must ship in v2.2, P2/P3 can defer | Clean cut-off rule for milestone scope discipline. | ✓ |
| Severity tag but ALL get fixed in v2.2 | No QA-NN deferred — every finding closed before v2.2 ships. | |
| Flat list, no severity — each finding judged individually | Simpler but no consistent rubric. | |

**User's choice:** P0/P1/P2/P3 — P0/P1 must ship in v2.2, P2/P3 can defer

### Q3 — What's the coverage-complete signal?

| Option | Description | Selected |
|--------|-------------|----------|
| Every documented route + every primary user flow visited once | Concrete and verifiable, no time pressure. | ✓ |
| Time-boxed: 3 hours max | Time-bound. Risk: incomplete coverage if surfaces deep. | |
| Open-ended — sweep until no new findings in last 30 min | Most exhaustive but unbounded duration. | |

**User's choice:** Every documented route + every primary user flow visited once

**Notes:** Mapping locked: Phase 36 default catch-all, themed mini-phase when ≥3 cluster, P0/P1/P2/P3 with P0/P1 forcing v2.2, route + flow coverage exit.

---

## Claude's Discretion

- Screenshot filenames within the locked `qa-NN-{slug}.png` pattern
- Order of route walking within Persona A's pass
- Screenshots directory layout (flat vs grouped by surface)
- Exact wording of new QA-NN titles (must convey symptom in <80 chars)
- Whether to compress screenshots with `pngquant` (only if total >10 MB)
- Whether to take secondary screenshots showing different states of the same bug

## Deferred Ideas

- **Google OAuth fresh signup** — covered by AUTH-05 in Phase 31 scope
- **Anonymous (signed-out) share recipient** — covered by SHARE-01 in Phase 32 scope
- **Member-role / non-admin user sweep** — only added if a P0/P1 finding surfaces a role-gated bug
- **Multi-Fathom-account user testing** — FEAT-01 (Phase 39) requirement #4 covers this
- **Video-clip evidence capture** — rejected; PNG screenshots sufficient
- **Inline base64 screenshots in REQUIREMENTS.md** — rejected; file-based cleaner
- **External screenshot hosting** — rejected; phase-local + git more durable
- **Time-boxed sweep duration** — rejected; coverage-based exit more reliable
- **Mobile viewport sweep** — not in scope; CallVault v2.2 is desktop-first
- **Automated regression test generation from QA-NN findings** — deferred to v2.3+
- **Severity auto-classification from console error patterns** — manual tagging sufficient for v2.2 volume
- **Re-running the sweep at milestone close** — would be a separate close-out phase
