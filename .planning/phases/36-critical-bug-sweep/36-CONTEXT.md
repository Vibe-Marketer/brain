---
phase: 36
phase_name: Critical Bug Sweep
gathered: 2026-05-11
status: Ready for planning
mode: Auto-generated from REQUIREMENTS.md (all bugs fully specified)
---

# Phase 36: Critical Bug Sweep — Context

<domain>
## Phase Boundary

Resolve 8 remaining high-impact bugs across the app, leaving no known regressions. Each bug is individually scoped in REQUIREMENTS.md.

Out of scope: BUG-01 (Phase 30, already shipped), share-call bugs (Phase 32), security findings (Phase 37/38), Fathom-specific bugs (Phase 39/40).
</domain>

<decisions>
## Implementation Decisions

### BUG-02 — Workspace Update 406 PGRST116

- Toggling default-workspace on the Workspace Detail panel triggers `HTTP 406 PGRST116 on PATCH /workspaces` and shows "Failed to update workspace" toast.
- PGRST116 = "JSON object requested, multiple (or no) rows returned" — the `.single()` or `.maybeSingle()` call against the update RPC is failing.
- **Root cause hypothesis (plan-phase research must verify):** the update query targets multiple workspace rows (because `is_default` is being set true on one without first setting all others to false), OR the response shape expectation doesn't match Supabase's return for a 0-row update (no matching row → 406).
- **Fix:** Audit the workspace update flow — likely needs a transactional set: `UPDATE workspaces SET is_default = false WHERE org_id = X` then `UPDATE workspaces SET is_default = true WHERE id = Y`. Or use a SQL function for atomicity. Verify the response handler uses `.maybeSingle()` not `.single()` if 0-row response is possible.

### BUG-03 — Cache Invalidation on Mutations

- Call list does NOT refresh immediately after mutations (move, delete, tag). User must reload the page.
- TanStack Query cache invalidation likely missing on some mutations.
- **Fix:** Audit every call-list mutation (`moveCallToFolder`, `removeCallFromFolder`, `assignCallToFolder`, `useCallTags` mutations, etc.) for proper `queryClient.invalidateQueries({ queryKey: [...] })` in `onSuccess`. Confirm query keys are stable across mutations (query factory pattern per `src/lib/query-config.ts`).

### BUG-04 — Date Sort Chronological

- Date sort shows Apr → Nov → Mar in the same column direction. Sort is NOT strictly chronological.
- **Likely cause:** sorting on string representation of date instead of timestamp. Or local-string sort that orders "Apr 2026" before "Nov 2025" alphabetically.
- **Fix:** Cast to `new Date(...)` or use ISO string and ensure timestamps are numeric-compared in the table sort function. Verify both ascending and descending.

### BUG-05 — Manual Paste/Upload Transcript UI Exposed

- Route exists (`save-pasted-transcript` Edge Function + "Q3 Sales Sync" test call proves it), but there's no entry point in the UI.
- **Fix:** Add a button/CTA on the Import page (or Import Source Manager) labeled "Paste transcript manually" or "Upload audio file" that opens a dialog with the existing flow. Match brand-guidelines-v4.4 button styles.

### BUG-06 — Import History Button Works

- "Import History" button in Import Source Manager exists but doesn't show import history.
- **Fix:** Wire the button to a dialog/panel that lists past import runs (likely from an `import_history` or `sync_log` table). If the data source doesn't exist, plan-phase adds it.

### BUG-07 — Import "+" Button Works

- "+" button at top of Import Source Manager doesn't add a new source.
- **Fix:** Wire the button to open the "Add Import Source" dialog (Fathom, Zoom, manual paste, etc. selection). Likely the click handler is missing or the dialog mount is broken.

### BUG-08 — Auto-Creation of Magic Folders Removed

- "Hall of Fame" and "Manager Reviews" folders are auto-created on first run. Should be removed.
- **Fix:** Find the auto-create logic (likely in a signup hook, onboarding flow, or org-creation flow) and delete it. Verify on a fresh signup that no auto-folders appear.

### BUG-09 — DialogContent Accessibility Warnings

- Console shows `DialogContent` accessibility warnings on every modal that lacks a `DialogDescription`.
- **Fix:** Audit every Radix Dialog usage. Add `<DialogDescription>` to each. When the description is implicit (e.g., a confirm dialog), use `<VisuallyHidden>` wrapper. Suppress no warning that signals a real a11y gap.

### Plus Phase-29 QA Surfaces

The Phase 29 QA sweep produced QA-01..23 items. The ones routed to Phase 36 (per the requirements table at end of REQUIREMENTS.md) should be folded into this phase's scope:
- QA-04 (selection state — may overlap with Phase 33)
- QA-08 (CSP issue — verify if routed here)
- QA-11 (raw enum leak "Copy And_remove" in Settings > Organizations)
- QA-13, QA-14 (any P0/P1 routed to Phase 36 per Sweep Status column)

Plan-phase must scan the requirements table at the bottom of REQUIREMENTS.md and pull any QA-NN item marked `Maps to: Phase 36` into scope.

### Test Strategy

- **Real-DB integration tests** for BUG-02 (workspace update), BUG-03 (cache invalidation in particular — verify table updates).
- **Visual regression** for BUG-04 sort order (commit screenshots).
- **Dev-browser** verification of every BUG-NN fix on `app.callvaultai.com`.
- **A11y axe check** for BUG-09 — no console warnings on any modal.

### Sequencing

Bugs are independent — can ship in any order. Suggested:
1. BUG-02 (workspace default toggle — high-friction)
2. BUG-03 (cache invalidation — broad impact)
3. BUG-04 (date sort — single-spot fix)
4. BUG-08 (remove auto-folders — pure deletion)
5. BUG-09 (DialogDescription audit — bulk)
6. BUG-07 + BUG-06 + BUG-05 (Import UI wiring)
7. Phase 29 QA fold-ins

Atomic commits per BUG-NN.
</decisions>

<code_context>
## Existing Code Insights

**Likely target files:**
- `src/services/workspaces.service.ts` + `src/hooks/useWorkspaces.ts` — BUG-02
- `src/lib/query-config.ts` + every mutation hook — BUG-03
- `src/components/transcript-library/TranscriptTable.tsx` sort logic — BUG-04
- `src/pages/ImportPage.tsx` + `src/components/import/*` — BUG-05, BUG-06, BUG-07
- Signup/onboarding flow — BUG-08
- Every modal component — BUG-09

**Reusable foundations:**
- `@radix-ui/react-dialog` `<DialogDescription>` + `<VisuallyHidden>`
- TanStack Query `queryClient.invalidateQueries`
- shadcn Dialog primitives

**Phase 29 cross-reference:**
- `.planning/phases/29-qa-sweep-regression-catalog/29-SUMMARY.md` — Sweep Status column for Phase 36 mapped items
</code_context>

<specifics>
## Requirements (from REQUIREMENTS.md)

- **BUG-02** Workspace update 406 PGRST116
- **BUG-03** Cache invalidation on mutations
- **BUG-04** Date sort chronological
- **BUG-05** Manual paste/upload UI exposed
- **BUG-06** Import History button works
- **BUG-07** Import "+" button works
- **BUG-08** Auto-folders removed
- **BUG-09** DialogDescription on every modal
- Plus QA-NN items mapped to Phase 36

## Success Criteria (from ROADMAP.md)

1. Workspace default toggle works without 406.
2. Mutations refresh call list immediately.
3. Date sort strictly chronological.
4. Manual paste/upload accessible from UI.
5. Import buttons functional.
6. No auto-folders on new accounts.
7. No DialogDescription warnings.

## Verification Strategy

- Dev-browser per-bug functional + visual check.
- Real-DB integration tests for workspace update + cache invalidation.
- Console clean (no a11y warnings) across every modal open.
- Fresh-signup test (BUG-08): create new account, confirm no auto-folders.
</specifics>

<canonical_refs>
- `.planning/ROADMAP.md` — Phase 36
- `.planning/REQUIREMENTS.md` — BUG-02..09, QA items mapped to Phase 36
- `.planning/phases/29-qa-sweep-regression-catalog/29-SUMMARY.md` — QA cross-reference
- `src/CLAUDE.md`, `supabase/CLAUDE.md` — conventions
- `@radix-ui/react-dialog` — DialogDescription a11y
</canonical_refs>

<deferred>
## Deferred Ideas

- **Bulk paste/upload** — paste a whole folder of transcripts. v2.3.
- **Audit-log surface for imports** — full import history UI with retry / dedupe. v2.3 beyond BUG-06's basic surface.
- **Test coverage backfill** — many of these bugs reveal gaps in test coverage. Capture a v2.3 phase for systematic test additions.
</deferred>
