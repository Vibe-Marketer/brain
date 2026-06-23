# Phase 26: Unified Import Surface - Research

**Researched:** 2026-06-23
**Domain:** Large frontend refactor — collapse two forked import UIs onto one `<ImportSurface>` built on the dense `TranscriptTable`, driven by the Phase 24 sync-status reader + Phase 25 durable selection store, across 7 connector providers.
**Confidence:** HIGH (every claim below verified by direct read of the real files in this repo; no training-data or external claims for the codebase facts)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (Andrew's operator UX brief — treat as binding)

**Density & table**
- Use the SAME dense table component the main Transcripts pages use (`TranscriptTable`). At one point the import tab used the same table as the main transcripts pages — "that was a lot better, you could list a lot more calls in a tighter space." Reuse it; do NOT rebuild a thin custom checkbox list (the wizard's regression).
- Fast loading is a hard requirement. "Should not take forever to load… I should not have had to watch John click 'more' a million times 10 calls at a time." Virtualize rows, larger page sizes, background prefetch/auto-paging. Kill the 10-at-a-time manual "more" loop.

**Browse vs find/import (BROWSE-01)**
- Two clearly distinct experiences, but NOT necessarily two separate areas. Implement as two stacked sections in ONE surface: already-synced (cheap DB read, de-emphasized inline) and find-new (live provider API). One surface, a browse/find split — NOT two separate apps (the named anti-feature).

**Selection & import flow**
- Selecting and importing must be fast and seamless; selections must persist (Phase 25 store) — John lost his selections, that must be impossible now.
- Sensible, natural control placement: connect, search/filter (date range), select (incl. select-all-matching), import — laid out so it feels natural to connect → search → scroll → select → import. Apply the One-Click Promise and KISS-UX.
- Provider-agnostic across ALL connectors (Fathom, Zoom, Fireflies, Grain, Read.ai, PLAUD, YouTube).

**CARRY-FORWARD from Phase 24 (must fix here)**
- SyncTab currently hardcodes `sourceApp: "fathom"` in the call path and does not thread `organizationId`. Now that the surface becomes multi-provider, thread the REAL per-row `source_app` (and the caller's org) into `getSyncStatusForExternalIds`, or non-Fathom providers will show as unsynced forever. (CR-02 / WR-01 / WR-02.)

### Claude's Discretion
- Virtualization library choice (existing `TranscriptTable` does NOT virtualize — see TBL-04; if adding, pick a library and run the legitimacy gate). Exact section layout/visual treatment within the dense-table + stacked-sections constraints. Prefetch page size. All grounded in matching the existing Transcripts UX.

### Deferred Ideas (OUT OF SCOPE — do not build in Phase 26)
- Observable job progress UI / per-provider status chip → Phase 27 (JOB). Leave mount points/seams in the surface.
- Server-side "Sync all from provider" button behavior → Phase 28 (SYNC). The select-all-matching descriptor (Phase 25) is the client twin; the surface exposes the affordance, wired to the real backend job in Phase 28.
- Partial-success/retry surfacing → Phase 29 (FAIL).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TBL-01 | One shared `<ImportSurface>` built on the dense `TranscriptTable`, used in both the Import tab and the Sync tab | `TranscriptTable` reuse contract mapped (Q1); `UnsyncedMeetingsSection` is the proven template; consumes Phase 25 `useImportSelection` |
| TBL-02 | Provider-agnostic "already imported" overlay so all 7 connectors grey out synced rows correctly (moved out of per-adapter search) | `getSyncStatusForExternalIds` overlay design with real per-row `source_app` + `organizationId` (Q3); replaces per-adapter `wasAlreadySynced(m)` |
| TBL-03 | Remove the forked `ConnectorImportWizard` + duplicate `useSyncTab*` hooks once both surfaces share the new component | Full consumer enumeration + safe deletion order (Q2); `source-registry.ts` boot-crash guard (Q2) |
| TBL-04 | Fast dense table — virtualized rows, larger page sizes, background prefetch — eliminating "Load 10 at a time" | `TranscriptTable` does NOT virtualize today (verified); virtualization approach + auto-paging design (Q4) |
| BROWSE-01 | Browse already-synced (cheap DB) cleanly separated from find/import new (live API), two stacked sections, synced de-emphasized inline | SyncTab already does this with `UnsyncedMeetingsSection` over `SyncedTranscriptsSection`; unify into one surface (Q5) |
</phase_requirements>

## Summary

The two import surfaces already share the keeper component — the dense `TranscriptTable` — on one side. `SyncTab` renders find-new (`UnsyncedMeetingsSection`) stacked over browse-synced (`SyncedTranscriptsSection`), both wrapping `TranscriptTable`. The `ConnectorImportWizard` is the regression: it hand-rolls a `<label>`+`<Checkbox>` list with manual cursor "Load more" paging and volatile `useState` selection. **Phase 26 is fundamentally a wiring + deletion phase, not a from-scratch build:** lift the SyncTab two-section pattern into a reusable `<ImportSurface>`, point both `ImportPage` and `TranscriptsNew` at it, wire it to the already-built Phase 24 reader and Phase 25 store/hook, then delete the wizard and the divergent `useSyncTab*` hooks.

Three real gaps must be closed: (1) `TranscriptTable` does **not** virtualize — it renders `sortedCalls.map()` directly and sorts client-side, so a "larger page" today means rendering every row, which is the actual TBL-04 work; (2) the "already imported" signal is computed **per-adapter server-side** (`wasAlreadySynced(m)` reads `m.synced` set by each provider's edge function), inconsistent across providers — TBL-02 moves it to one client-side `getSyncStatusForExternalIds` overlay; (3) the Phase 24 carry-forward (hardcoded `"fathom"`, missing `organizationId`, clobbering bridge) must be fixed as the surface becomes multi-provider, or non-Fathom rows show unsynced forever.

**Primary recommendation:** Build `<ImportSurface>` by lifting the `SyncTab` two-stacked-section pattern into one reusable component parameterized by `sourceApp`; reuse `TranscriptTable` unchanged for rendering but add row-level virtualization to it (or to a thin wrapper) using `@tanstack/react-virtual`; drive selection from `useImportSelection` (Phase 25); overlay synced status from `getSyncStatusForExternalIds` keyed by each row's real `source_app` + `organizationId`; then delete the wizard and `useSyncTab*` hooks in dependency order with `npm run build` against the committed tree as the boot-crash gate.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Render dense call rows + selection checkboxes | Browser (React) | — | Pure presentation; `TranscriptTable` already owns this |
| Virtualize row rendering for large pages | Browser (React) | — | Render-perf concern; lives in the table component |
| Find-new: list provider calls by date range | API (adapter → Edge Function) | Browser | `searchAvailable` invokes a per-provider edge function; UI only paginates |
| Browse-synced: list already-imported calls | Database (Postgres via service) | Browser | `useExistingTranscripts` cheap DB read of `recordings`/`workspace_entries` |
| "Already imported?" status overlay | Database (`recordings`) via service | Browser | TBL-02: one canonical reader, never per-adapter, never the store |
| Durable selection set | Browser (Zustand persist → sessionStorage) | — | Phase 25; client intent, survives nav/OAuth |
| Selection ↔ synced reconciliation | Database (`recordings`) reconciled in hook | Browser | Phase 25 `reconcile()`; server is truth for "synced", store is intent |
| Fire selected import | API (adapter → `importSelected` Edge Function) | Browser | Existing `importSelected` contract, unchanged |
| OAuth callback routing on boot | Browser (module init) | — | `source-registry.ts` is load-bearing at mount; fragile (Q2) |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x | UI | `[VERIFIED: src/CLAUDE.md tech-stack table]` already the project standard |
| Zustand (+persist) | 5.0.11 | Durable selection store (Phase 25) | `[VERIFIED: 25-01-SUMMARY tech-stack]` already installed + in use by `importSelectionStore` |
| TanStack Query | latest (installed) | Server-state for browse/find queries | `[VERIFIED: src/CLAUDE.md]` project standard; `useExistingTranscripts` already uses it |
| Remix Icons (`@remixicon/react`) | installed | All icons | `[VERIFIED: root CLAUDE.md HARD CONSTRAINT — Icons]` ONLY icon library allowed |
| Tailwind + shadcn semantic tokens | 3.x | Styling | `[VERIFIED: src/CLAUDE.md TOKEN SYSTEM]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@tanstack/react-virtual` | latest (verify) | Row virtualization for the dense table (TBL-04) | **Recommended addition** — see Package Legitimacy Audit. Only if Wave 0 confirms no virtualization helper already exists. `[ASSUMED]` until slopcheck + registry verification pass. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@tanstack/react-virtual` | `react-window` / `react-virtuoso` | `react-window` is lighter but harder to use with a semantic `<table>`/`<TableBody>`; `react-virtuoso` has table support but is heavier. `@tanstack/react-virtual` is headless (you keep the existing `<Table>` markup + shadcn styling) and pairs with the existing TanStack Query usage. All three are non-trivial to retrofit into the `<Table>`/`<TableHeader>`/`<TableBody>` shadcn primitives — see Pitfall 4. |
| Adding a virtualization lib | Large page size + CSS `content-visibility: auto` | Zero-dependency. `content-visibility:auto` skips offscreen render/layout cost for a long list and may be "fast enough" for the realistic page sizes (50–200 rows). Cheaper than retrofitting virtualization into a semantic table. **Evaluate this first in Wave 0** — it may satisfy TBL-04 with no new dependency. |

**Installation (only if Wave 0 chooses a virtualization library — gate behind a checkpoint):**
```bash
npm install @tanstack/react-virtual
```

**Version verification (run before locking the dependency):**
```bash
npm view @tanstack/react-virtual version
```

## Package Legitimacy Audit

> This phase is primarily wiring + deletion. The ONLY candidate new dependency is a virtualization library for TBL-04, and even that is optional (see "Alternatives Considered" — `content-visibility: auto` or a larger page size may suffice with zero new deps).

slopcheck was not run in this research session (no candidate package is yet committed — the library choice is explicitly Claude's Discretion and gated to Wave 0). Per protocol, the one candidate is tagged `[ASSUMED]` and the planner MUST gate its install behind a `checkpoint:human-verify` task that runs slopcheck + `npm view` before `npm install`.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@tanstack/react-virtual` | npm | (verify in Wave 0) | (verify) | github.com/TanStack/virtual | not run | `[ASSUMED]` — planner gates behind checkpoint:human-verify before install |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none
**Strong prior:** `@tanstack/react-virtual` is the official TanStack virtualization package (same org as the already-installed TanStack Query). It is a well-known package, but per the package-name provenance rule it stays `[ASSUMED]` until verified via official docs/Context7 AND slopcheck in this project at install time.

*If the team chooses the zero-dependency `content-visibility` path, this section becomes N/A — no external packages installed.*

## Architecture Patterns

### System Architecture Diagram

```
                        ┌─────────────────────────────────────────────┐
   Import tab           │              <ImportSurface>                 │           Sync tab
   (ImportPage,    ────►│   props: sourceApp, sourceId, workspaceId,   │◄────  (TranscriptsNew
    Pane 3 per source)  │          organizationId, dateRange           │        TabsContent="sync")
                        └───────────────────┬──────────────────────────┘
                                            │
        ┌───────────────────────────────────┼───────────────────────────────────┐
        ▼ (toolbar)                          ▼ (section A: FIND-NEW)              ▼ (section B: BROWSE-SYNCED)
  connect / status        ┌──────────────────────────────────┐     ┌──────────────────────────────────┐
  date-range picker       │  live provider search (slow)     │     │  cheap DB read (fast)            │
  search button           │  adapter.searchAvailable(params) │     │  useExistingTranscripts(...)     │
  select-all-matching     │       │ Edge Function            │     │       │ recordings + workspace   │
  import-selected button  │       ▼                          │     │       ▼                          │
                          │  AvailableCall[]                 │     │  Meeting[] (already synced)      │
                          │       │                          │     │       │                          │
                          │  OVERLAY synced status:          │     │  (already synced by definition)  │
                          │  getSyncStatusForExternalIds(    │     │                                  │
                          │    row.source_app,  ◄── REAL,    │     │                                  │
                          │    ids, {organizationId})        │     │                                  │
                          │       │ greys imported rows      │     │                                  │
                          │       ▼                          │     │       ▼                          │
                          │  <TranscriptTable                │     │  <TranscriptTable                │
                          │    isUnsyncedView selectable />  │     │    (de-emphasized, browse) />    │
                          └───────────────┬──────────────────┘     └──────────────────────────────────┘
                                          │ checkbox toggle
                                          ▼
                          useImportSelection({sourceApp, dateStart, dateEnd, organizationId})
                          ── durable Zustand store (sessionStorage), Phase 25 ──
                          toggle / selectAllMatching / isSelected / count / reconcile / clearSelection
                                          │ on "Import selected"
                                          ▼
                          adapter.importSelected({ sourceId, externalIds, workspaceId })
                                          │ creates sync_jobs row
                                          ▼  (Phase 27 mounts job banner HERE — leave the seam)
                          clearSelection()  ←  ONLY on job creation
```

### Component Responsibilities (target)

| Component | Responsibility | New / Modified / Delete |
|-----------|----------------|-------------------------|
| `src/components/import/ImportSurface.tsx` | The shared two-section dense surface (toolbar + find-new section + browse-synced section). Parameterized by `sourceApp`/`sourceId`/`workspaceId`/`organizationId`. | **NEW** |
| `TranscriptTable.tsx` | Dense table — reused for rendering. Add row virtualization (TBL-04) here or in a thin wrapper. | **MODIFIED** (add virtualization) or **REUSED as-is** if `content-visibility` path |
| `useImportSelection` (Phase 25) | Durable scoped selection + reconcile. Consumed directly. | **REUSE** |
| `getSyncStatusForExternalIds` (Phase 24) | Canonical synced overlay. Called per-`source_app` group. | **REUSE** (call site changes only) |
| `ConnectorImportWizard.tsx` (635 lines) | Hand-rolled checkbox list + manual cursor paging + volatile selection | **DELETE** |
| `useSyncTabSelection.ts` | Volatile selection (two sets) | **DELETE** (migrate to `useImportSelection`) |
| `useSyncTabState.ts` / `useSyncTabOrchestration.ts` / `useSyncTabStateBridge.ts` | Bespoke fork plumbing (fetch/paging/job-poll/bridge) | **DELETE / fold** — selection bits superseded; the job-poll bits are Phase 27's domain (leave a clean seam, don't rebuild here) |
| `UnsyncedMeetingsSection.tsx` / `SyncedTranscriptsSection.tsx` | Already wrap `TranscriptTable` — the template | **FOLD into `<ImportSurface>`** (or keep as the surface's two internal sections) |
| `connectorSearch.ts` (`appendUniqueAvailableCalls`) | De-dup helper for paged results | **REUSE** inside the find-new paging logic; delete only after both consumers (wizard + orchestration) are gone |

### Pattern 1: Lift-and-parameterize (not rewrite)
**What:** The `SyncTab` already implements the exact target shape — find-new section stacked over browse-synced section, both on `TranscriptTable`. Extract that into `<ImportSurface sourceApp=...>` rather than designing a new component.
**When to use:** When a proven pattern already exists on one of the two forks. The wizard is the bad fork; SyncTab is the good one.
**Example (the existing two-section structure to lift):**
```tsx
// Source: src/components/transcripts/SyncTab.tsx:279-323 (verified)
{orchestration.hasFetchedResults && (
  <UnsyncedMeetingsSection meetings={meetings} selectedMeetings={selection.unsyncedSelected} ... />
)}
<div ref={syncedSectionRef}>
  <SyncedTranscriptsSection existingTranscripts={existingTranscripts} ... />
</div>
```

### Pattern 2: Canonical-read overlay (TBL-02)
**What:** After a provider search returns `AvailableCall[]`, overlay synced status by calling `getSyncStatusForExternalIds(sourceApp, items.map(i => i.externalId), { organizationId })` — instead of trusting each adapter's `alreadyImported` flag.
**When to use:** Any multi-provider "already have this?" check.
**Example (the canonical reader, verified):**
```ts
// Source: src/services/sync-status.service.ts:33 (verified)
export async function getSyncStatusForExternalIds(
  sourceApp: string,
  externalIds: string[],
  opts?: { organizationId?: string | null },
): Promise<Map<string, SyncStatus>> // keyed by source_call_id (TEXT, never coerced)
```

### Pattern 3: Selection as durable scoped intent (Phase 25)
**What:** Selection lives in `useImportSelection`, keyed by `sourceApp` + date range, persisted to sessionStorage. Clear ONLY on job creation; `reconcile(visibleIds)` after each search auto-drops now-synced ids.
**Example (the hook to consume, verified):**
```ts
// Source: src/hooks/useImportSelection.ts (Phase 25, verified API)
const { toggle, selectAllMatching, isSelected, count, reconcile, clearSelection }
  = useImportSelection({ sourceApp, dateStart, dateEnd, organizationId });
```

### Anti-Patterns to Avoid
- **Rebuilding a thin checkbox list:** the wizard's `<label><Checkbox/></label>` list is the exact regression Andrew named. Use `TranscriptTable`.
- **Selection in `useState`:** the root cause of John's vanishing selections. Use `useImportSelection` (Phase 25), never local component state.
- **Trusting per-adapter `alreadyImported`:** inconsistent across providers; use the canonical overlay.
- **Hardcoding `"fathom"` as `sourceApp`:** the Phase 24 carry-forward bug. Thread the real per-row `source_app`.
- **Manual "Load more" cursor button:** the "10 at a time" complaint. Auto-page / prefetch + virtualize.
- **Rebuilding job-progress/poll machinery:** that's Phase 27. Leave a mount seam; do not port the 8s-dismiss poller.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Dense call table + selection + sort + pagination | A custom checkbox list (the wizard did this) | `TranscriptTable` | Already handles sort, column visibility, dual-ID row keys, workspace-entries batch fetch |
| "Is this call synced?" | Per-adapter `synced` flags / `parseInt` against `fathom_calls` | `getSyncStatusForExternalIds` (Phase 24) | Provider-agnostic, TEXT ids, org-scoped, mirrors `checkDuplicate` |
| Durable selection across nav/OAuth | `useState<Set>` | `useImportSelection` + `importSelectionStore` (Phase 25) | sessionStorage persistence, scope-keyed, reconcile primitive |
| Row virtualization | A custom windowing effect | `@tanstack/react-virtual` (or `content-visibility:auto`) | Edge cases: scroll restoration, dynamic row heights, sticky header |
| OAuth callback route resolution | Re-deriving callback routes | `OAUTH_CALLBACK_ROUTES` / `resolveOAuthCallbackRoute` | Boot-critical; throws loudly if registry empty (Q2) |
| Selection key format | Ad-hoc `provider+id` strings | `getSelectionEntryKey` / `getUnsyncedMeetingSelectionKey` (`::` + `encodeURIComponent`) | Both Phase 25 store and existing sync code already use the `::` convention |

**Key insight:** This phase's value is *deletion and consolidation*. Every "build" temptation here has an existing, tested asset. The new code is almost entirely the `<ImportSurface>` shell that wires those assets together, plus virtualization for TBL-04.

## Runtime State Inventory

> This is a fork-collapse + deletion refactor. A grep finds files; it does NOT find runtime/boot state. The fragile surfaces below are the real risk.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no datastore keys reference the deleted component/hook names. Selection now lives in sessionStorage under the Phase 25 store key (already shipped, unchanged). | None |
| Live service config | None — no external service config references these UI modules. | None |
| OS-registered state | None — pure frontend. | None |
| Secrets/env vars | None — no env var names reference these modules. | None |
| Build artifacts | `source-registry.ts` `oauthCallbackFunctionName` entries drive `OAUTH_CALLBACK_ROUTES` at **module init**; the import-source flow gates (`isConnectorWizardImportSource`) decide what `ImportPage` renders. A broken/zeroed registry **white-screens prod at boot** (the `FALLBACK_ROUTE` IIFE throws if `OAUTH_CALLBACK_ROUTES` is empty — verified at `oauth-callback-routing.ts:50-60`). | Build against the COMMITTED tree; run `npm run build` before every push; keep the CI assertion that `OAUTH_CALLBACK_ROUTES.length` is non-zero (test file `src/lib/__tests__/oauth-callback-routing.test.ts`). |

**The canonical question:** After deleting the wizard + `useSyncTab*` hooks, what still references them at boot? Answer: `ImportPage.tsx` (renders the wizard) and `TranscriptsNew.tsx` → `SyncTab.tsx` (renders the sections + hooks). Both MUST be rewired to `<ImportSurface>` BEFORE the deletes, or the build breaks. No runtime/DB state is affected — this is a compile-time dependency graph problem, gated by `npm run build`.

## Common Pitfalls

### Pitfall 1: TranscriptTable does NOT virtualize — "bigger page" = render everything
**What goes wrong:** Assuming `TranscriptTable` already windows rows. It does not — it does `sortedCalls.map()` over the full `calls` array and sorts client-side via `useTableSort` (verified `TranscriptTable.tsx:332`, `:149`). Bumping `pageSize` to 200 renders 200 full rows with per-row `WorkspaceEntriesBatchProvider` lookups.
**Why it happens:** `SyncedTranscriptsSection` paginates server-side (20/page) so the table never sees a huge array today.
**How to avoid:** TBL-04 requires actually adding virtualization (or `content-visibility:auto`) to the table/wrapper. Measure first: a 100–200 row page with `content-visibility` may be fast enough with zero deps. Reserve `@tanstack/react-virtual` for confirmed-slow cases.
**Warning signs:** Janky scroll, slow tab switches, after raising page size.

### Pitfall 2: The Phase 24 carry-forward triple (CR-02 / WR-01 / WR-02)
**What goes wrong:** The only runtime caller passes literal `"fathom"` to the reader (`useSyncTabState.ts:202`, verified). The reader filters `recordings` by `.eq("source_app", sourceApp)`, so any non-Fathom row is excluded → `synced` stays `false` forever → re-importing already-synced Zoom/Fireflies/Grain/Read.ai calls. The bridge (`useSyncTabStateBridge.ts:50-52`) force-sets `synced` for EVERY meeting to `statusMap.has(...)`, so a per-provider multi-call would clobber meetings outside each batch. And `organizationId` is never threaded, so a call synced under Org A reads "synced" in Org B.
**Why it happens:** SyncTab was Fathom-only when Phase 24 landed; these were logged as latent, not live.
**How to avoid:** In `<ImportSurface>`, group visible rows by their real `source_app` (or call the reader per provider) and **merge** results — flip to `true` only on a hit, never reset non-batch rows. Thread `organizationId` (available as `activeOrganizationId` in SyncTab / `activeOrgId` in ImportPage) through to the reader. **Order: the merge fix (WR-01) must land before/with the per-provider multi-call (CR-02).**
**Warning signs:** Multi-provider test where a synced Zoom call shows selectable/ungreyed.

### Pitfall 3: Deleting `connectorSearch.ts` too early
**What goes wrong:** `appendUniqueAvailableCalls` has TWO consumers: the wizard AND `useSyncTabOrchestration.ts` (verified). Deleting it with the wizard breaks orchestration until that's also gone.
**How to avoid:** Either keep `connectorSearch.ts` and reuse it in `<ImportSurface>`'s paging, or delete it only in the final wave after BOTH consumers are removed. Safe deletion order below.

### Pitfall 4: Virtualizing a semantic shadcn `<Table>` is non-trivial
**What goes wrong:** `TranscriptTable` uses `<Table><TableHeader><TableBody>` shadcn primitives (real `<table>` markup). Naively wrapping `<TableBody>` rows in an absolutely-positioned virtualizer breaks `<table>` layout, column alignment, and the sticky header.
**How to avoid:** Use `@tanstack/react-virtual`'s table recipe (measure rows, translate the tbody, keep one column-width source), OR switch the virtualized section to a CSS-grid "table" while keeping the existing visual tokens, OR use `content-visibility:auto` on each `<TableRow>` (least invasive — keeps the table intact). Prototype in Wave 0 before committing.
**Warning signs:** Misaligned columns, header detaching, horizontal-scroll breakage.

### Pitfall 5: `selectedCalls` prop is `(number | string)[]` and matched by `String(call.recording_id)`
**What goes wrong:** `TranscriptTable` selection compares `selectedCalls.some(id => String(id) === String(call.recording_id))` (verified `:335`). The find-new rows key by `getUnsyncedMeetingSelectionKey` (`platform::externalId`), but browse rows key by raw `recording_id`. Mixing the two keyspaces silently breaks selection.
**How to avoid:** Keep the two sections' selection keyspaces distinct (find = `source_app::externalId` per Phase 25 `getSelectionEntryKey`; browse = recording UUID). Feed each `TranscriptTable` instance the matching `selectedCalls` array. Never `parseInt`/`Number` an id (dual recording-ID rule).

## Code Examples

### TBL-02: provider-agnostic overlay after a search (target pattern)
```ts
// After adapter.searchAvailable returns items for the find-new section:
const ids = items.map((i) => i.externalId);
const statusMap = await getSyncStatusForExternalIds(sourceApp, ids, { organizationId });
const overlaid = items.map((i) => ({
  ...i,
  alreadyImported: statusMap.get(i.externalId)?.hasWorkspaceEntries ?? false,
}));
// reconcile durable selection against server truth (Phase 25):
await reconcile(ids); // drops now-synced ids from the persisted selection
```

### TBL-01/SEL: wiring the table to the durable hook (target pattern)
```tsx
// Source: composes verified APIs from TranscriptTable.tsx + useImportSelection.ts
<TranscriptTable
  calls={overlaidRows}
  selectedCalls={overlaidRows.filter(r => isSelected(r.externalId)).map(r => r.externalId)}
  isUnsyncedView
  onSelectCall={(id) => toggle(String(id))}
  onSelectAll={() => selectAllMatching({ dateStart, dateEnd })}
  onCallClick={openPreview}
  onPageChange={setPage}
  onPageSizeChange={setPageSize}
  /* ...tags, hostEmail, totalCount... */
/>
```

### Safe deletion order (TBL-03)
```
Wave A (build + wire, no deletes):
  1. Create <ImportSurface> consuming TranscriptTable + useImportSelection + getSyncStatusForExternalIds.
  2. Add virtualization (or content-visibility) to TranscriptTable / wrapper — TBL-04.
  3. Point ImportPage's connector branch at <ImportSurface> (replace <ConnectorImportWizard>).
  4. Point TranscriptsNew's sync tab at <ImportSurface> (replace <SyncTab> body / fold its two sections).
  5. npm run build (boot-crash gate) + manual smoke both tabs.

Wave B (delete, dependency-leaf first):
  6. Delete ConnectorImportWizard.tsx + its 2 test files + ImportPage import.
  7. Delete SyncTab.tsx, UnsyncedMeetingsSection.tsx, SyncedTranscriptsSection.tsx (folded into surface).
  8. Delete useSyncTabSelection.ts, useSyncTabState.ts, useSyncTabOrchestration.ts, useSyncTabStateBridge.ts
     (and SyncStatusIndicator.tsx / ActiveSyncJobsCard.tsx — but ONLY if Phase 27's seam doesn't reuse them;
      flag for the planner: these are job-status UI, arguably Phase 27's territory — confirm before deleting).
  9. Delete connectorSearch.ts ONLY after both wizard + orchestration are gone (Pitfall 3).
  10. Migrate the .registry.test.ts files to cover <ImportSurface>.
  11. npm run build + full vitest + npm run lint:docs.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Per-adapter `wasAlreadySynced(m)` reading `m.synced` (set server-side, inconsistent) | One client overlay via `getSyncStatusForExternalIds` | Phase 24 shipped the reader; Phase 26 adopts it | All 7 providers grey synced rows consistently |
| Volatile `useState<Set>` selection (wizard + `useSyncTabSelection`) | Durable `useImportSelection` + sessionStorage store | Phase 25 shipped the store/hook; Phase 26 wires it | Selection survives nav/OAuth/date-change |
| Two forked surfaces (wizard vs SyncTab) | One `<ImportSurface>` | Phase 26 | One paging model, one selection store |

**Deprecated/outdated (do not extend):**
- `ConnectorImportWizard.tsx` — the regression surface, to be deleted.
- `useSyncTabSelection.ts` — volatile selection, superseded by Phase 25.
- Manual "Load more" cursor button — replaced by auto-page/prefetch + virtualization.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@tanstack/react-virtual` is the right virtualization choice IF a library is needed | Standard Stack / Pitfall 4 | Wrong lib choice = rework; mitigated by Wave 0 prototype + the `content-visibility` zero-dep alternative |
| A2 | `content-visibility: auto` may satisfy TBL-04 with no new dependency | Alternatives Considered | If perf is still bad at realistic page sizes, must add a library; low risk — it's a measure-first step |
| A3 | `SyncStatusIndicator` + `ActiveSyncJobsCard` are job-status UI that belongs to Phase 27, not safe to delete in 26 | Code Examples (deletion order) | Deleting them here could orphan Phase 27's seam; flagged for planner confirmation |
| A4 | The job-poll bits of `useSyncTabState` (Realtime + 8s dismiss) are Phase 27's domain and should NOT be ported in 26 | Component Responsibilities | If 26 must keep job visibility, a minimal poll seam is needed; confirm scope boundary with planner |

**Note:** All codebase facts (file contents, props, call sites, the carry-forward bug, no-virtualization) are `[VERIFIED]` by direct read this session. The assumptions above are forward-looking design choices, not codebase facts.

## Open Questions

1. **Where does `<ImportSurface>` get `dateRange` from in the Import tab?**
   - What we know: SyncTab owns `dateRange` state + a `DatePresetBar`; the wizard owns its own `dateRange` + `DateRangePicker`.
   - What's unclear: whether the surface owns date state internally or receives it as a prop.
   - Recommendation: surface owns its own date-range state + picker (it's the toolbar's job); pass only `sourceApp`/`sourceId`/`workspaceId`/`organizationId` from the page.

2. **Should the Import tab's browse-synced section be scoped to the selected provider only, or show all synced calls?**
   - What we know: SyncTab's browse section (`useExistingTranscripts`) is org/workspace-scoped and source-filtered client-side.
   - Recommendation: scope browse to the surface's `sourceApp` for the per-source Import-tab pane; the global Transcripts page already shows all. Confirm with Andrew during planning.

3. **Do `SyncStatusIndicator`/`ActiveSyncJobsCard` get deleted in 26 or carried to 27?** (See A3.) Planner should resolve the Phase 26/27 boundary before the deletion wave.

## Environment Availability

> Skipped — Phase 26 is a frontend code/config refactor. The only external dependency is the optional npm virtualization library, covered in the Package Legitimacy Audit (gated to Wave 0 + a human-verify checkpoint). No runtime services, CLIs, or DB migrations are introduced by this phase.

## Validation Architecture

> nyquist_validation assumed enabled (config key not confirmed false in this session). Existing test infra is Vitest + @testing-library/react.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react `[VERIFIED: 25-02-SUMMARY, existing *.test.tsx]` |
| Config file | `vitest` (project-standard; tests run via `npx vitest run`) |
| Quick run command | `npx vitest run src/components/import/__tests__/ImportSurface.test.tsx` |
| Full suite command | `npx vitest run` |
| Type gate | `tsc -p tsconfig.app.json` (root tsconfig is hollow — per MEMORY) |
| Boot gate | `npm run build` against committed tree (boot-crash guard) |

> RTK note (verified across Phases 24/25): RTK blanks vitest/tsc/grep output. Run verification via `rtk proxy` or `/usr/bin/grep` directly.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TBL-01 | `<ImportSurface>` renders both sections on `TranscriptTable` in both tabs | component | `npx vitest run src/components/import/__tests__/ImportSurface.test.tsx` | ❌ Wave 0 |
| TBL-02 | Synced rows grey out for a non-Fathom provider (real `source_app`) | component/unit | same file, multi-provider case | ❌ Wave 0 |
| TBL-03 | No remaining imports of wizard / `useSyncTab*` | source-grep | `grep -rln "ConnectorImportWizard\|useSyncTabSelection\|useSyncTabState" src/` (expect only deleted files gone) | partial (use existing pattern) |
| TBL-03 | Boot does not white-screen | build/CI | `npm run build` + `oauth-callback-routing.test.ts` (OAUTH_CALLBACK_ROUTES.length) | ✅ exists |
| TBL-04 | Large page renders without re-rendering all rows / virtualization present | component | `ImportSurface.virtualization.test.tsx` (assert windowed row count) or perf note | ❌ Wave 0 |
| BROWSE-01 | Two stacked sections; synced de-emphasized; distinct selection keyspaces | component | `ImportSurface.test.tsx` section structure assertions | ❌ Wave 0 |
| Carry-forward | Reader called with real per-row `source_app` + `organizationId`; merge not clobber | unit | `ImportSurface.syncStatus.test.tsx` (mock reader, assert per-provider grouping + merge) | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run <touched test>` + `tsc -p tsconfig.app.json` on touched files
- **Per wave merge:** `npx vitest run` + `npm run build` (boot gate)
- **Phase gate:** Full suite green + `npm run build` green + `npm run lint:docs` before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/components/import/__tests__/ImportSurface.test.tsx` — TBL-01, BROWSE-01 structure
- [ ] `src/components/import/__tests__/ImportSurface.syncStatus.test.tsx` — TBL-02 + carry-forward (per-provider grouping, merge-not-clobber, org threading)
- [ ] `src/components/import/__tests__/ImportSurface.virtualization.test.tsx` — TBL-04 (or a documented `content-visibility` perf decision if no library)
- [ ] Migrate `SyncTab.registry.test.ts`, `UnsyncedMeetingsSection.registry.test.ts`, `ConnectorImportWizard.*.test.*` coverage onto `<ImportSurface>`
- [ ] Decide virtualization approach (prototype `content-visibility` vs `@tanstack/react-virtual`) — gate dep install behind checkpoint:human-verify

## Security Domain

> security_enforcement assumed enabled. This is a client-only refactor with no new network surface (it reuses the existing Phase 24 owner/org-scoped reader and the existing adapter `searchAvailable`/`importSelected` contracts).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth code touched |
| V3 Session Management | no | — |
| V4 Access Control | yes | Org scoping: thread `organizationId` into `getSyncStatusForExternalIds` so a user in multiple orgs cannot read cross-org synced status (WR-02 / T-25-04). RLS already bounds `recordings`/`workspace_entries`. |
| V5 Input Validation | yes | External ids treated as opaque TEXT, never coerced (dual recording-ID rule); date-range inputs validated before search |
| V6 Cryptography | no | No crypto |

### Known Threat Patterns for React + Supabase client
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-org synced-status leak via missing org filter | Information Disclosure | Thread `organizationId` to the reader (WR-02); the surface must always pass it |
| Stale selection across users on a shared machine | Information Disclosure | sessionStorage (Phase 25) clears on tab close; selection holds call IDs, not secrets/PII |
| Numeric coercion of UUID ids re-importing/mismatching calls | Tampering | TEXT end-to-end; route any cross-ID translation through `@/lib/recording-ids`; never `parseInt`/`Number` |

## Project Constraints (from CLAUDE.md)

| Constraint | Rule | Source |
|------------|------|--------|
| Icons | Remix Icons ONLY (`@remixicon/react`) — no Lucide/FontAwesome | root CLAUDE.md HARD CONSTRAINT |
| Animation | `motion/react`, NOT `framer-motion` | src/CLAUDE.md |
| Package manager | `npm` only (no pnpm/bun/yarn) | root + src CLAUDE.md |
| Routing | react-router-dom v6 (no TanStack Router / file-based) | src/CLAUDE.md |
| Dual recording-ID | Never `parseInt`/`Number` on ids; `source_call_id` is TEXT; route through `toRecordingUuid`/`toRecordingUuidBatch` | src/CLAUDE.md COMMON PITFALLS |
| Share URLs | Use `resolveShareUrl()`; `recordings.share_url` is not a column | ARCHITECTURE.md |
| Tokens | shadcn/Tailwind semantic tokens (`text-foreground`, `bg-card`, `text-vibe-orange`); never `text-ink`/`bg-hover`/`border-soft` | src/CLAUDE.md TOKEN SYSTEM |
| Service+hook separation | services = pure async (`*.service.ts`); hooks wrap with TanStack Query | root CLAUDE.md |
| Zustand v5 | `create<T>()((set) => ({` double-invocation | src/CLAUDE.md |
| Doc lint | `npm run lint:docs` before committing docs | root CLAUDE.md |
| Verify before claim | `npm run build` zero-exit in session before claiming boot-safe | root CLAUDE.md + global directives |

---

## UI/Layout Contract

> This is the phase's UI-SPEC. It reuses the existing Transcripts page design language verbatim — the dense `TranscriptTable`, Remix Icons, shadcn semantic tokens. **No new design language.** All visual treatments below already exist in `UnsyncedMeetingsSection` / `SyncedTranscriptsSection` / the wizard; this contract just specifies how they compose in `<ImportSurface>`.

### AppShell pane behavior
- `<ImportSurface>` renders inside **Pane 3** (main content). In the Import tab it sits inside the per-source pane (`ImportPage` Pane 3, scrollable). In the Sync tab it replaces the current `SyncTab` body inside `TranscriptsNew`'s `TabsContent value="sync"` (`overflow-auto`, `p-4 md:p-10`). Pane 4 (detail) continues to slide in / Pane 3 shrinks per existing AppShell rules — do not change pane mechanics.

### Control layout (toolbar — top of surface, in natural connect→search→select→import order)
Single horizontal toolbar that wraps responsively (`flex flex-wrap items-end gap-3`), in this left-to-right order:
1. **Connection status / connect** — reuse `ConnectorSetupCluster` (disconnected) and the `ConnectedConnectorSummary` row (connected, with "Manage connection"). Same as the wizard today.
2. **Date-range filter** — `DateRangePicker` (`min-w-[260px]`), the existing component. Drives the find-new search.
3. **Search button** — `variant="default"`, `RiSearchLine` icon (spinner `RiLoader4Line` while searching). Label `Search {provider}`.
4. **Select-all-matching** — checkbox lives in the table header (already in `TranscriptTable`: tooltip cycles "Select all matching" / "Select all visible (N)" / "Deselect all"). Wire its `onSelectAll` to `selectAllMatching({ dateStart, dateEnd })` (Phase 25 SEL-02 descriptor).
5. **Import-selected button** — `variant="default"`, label `Import selected (N)` where N = `count` from `useImportSelection` (renders `"all"` for the all-matching descriptor). Disabled when count is 0 or no destination workspace. Numbers use `tabular-nums`.
6. **Destination workspace** — the existing `<select>` (org-scoped via `useOrganizationWorkspaces`), placed adjacent to the import button (as the wizard does).

> Phase 28 will add a "Sync all from provider" button next to import-selected — leave horizontal space / a clear slot. Phase 27 will add a job-status banner directly under the toolbar — leave that mount seam.

### Two-section structure (BROWSE-01)
Stacked vertically in one scroll container, find-new ABOVE browse-synced (cost-class order: slow/live above instant/free):

**Section A — Find new (live provider API):**
- Section heading: `font-display text-2xl font-bold uppercase tracking-wide` (matches `UnsyncedMeetingsSection`'s "Unsynced Meetings"). Suggested label: **"New to import"** or **"Available to import"**.
- Subtext: `text-sm text-muted-foreground` — `{N} call{s} found` + `• {count} selected` when any selected (selected count in `text-primary font-medium`).
- Body: `TranscriptTable` with `isUnsyncedView` (checkbox column, selectable). Rows whose `alreadyImported` (from the overlay) is true are **de-emphasized inline** (the existing `opacity-50` + disabled checkbox + "(already imported)" treatment).
- Loading: skeleton rows via `<Skeleton>` from `@/components/ui/skeleton` while searching; spinner in the search button.
- Empty (searched, no results): bordered muted card `rounded-lg border border-border bg-muted/30 p-4 text-sm text-muted-foreground` — "No calls found for that date range." (existing wizard copy).
- Empty (not connected): muted card — "Connect {provider} to search and import available calls."

**Section B — Browse synced (cheap DB read):**
- Section heading: same typographic treatment — **"Already in your vault"** / "Synced Transcripts".
- Subtext: `{totalCount} {meetings synced for this date range | total transcripts}` (existing `SyncedTranscriptsSection` copy).
- Body: `TranscriptTable` (browse mode — no `isUnsyncedView` for find-style selection; bulk actions via existing `BulkActionToolbarEnhanced` when rows selected). Paginated server-side via `PaginationControls` (existing).
- This section is the durable archive — explicit page controls + total count (NOT infinite scroll), matching today.

### Density / visual treatment
- The dense `TranscriptTable` is the only table — same row height (`h-10 md:h-12` header cells), same columns, same sort buttons, same column-visibility + export dropdowns. Do not introduce a card grid or a looser list.
- Already-synced de-emphasis in Section A: `opacity-50`, disabled checkbox, muted "(already imported)" label — inline, never a separate screen (BROWSE-01).
- Numbers (`{N} selected`, durations, counts): always `tabular-nums`.
- Icons: Remix Icons only (`RiSearchLine`, `RiLoader4Line`, `RiSettings3Line`, `RiLoader2Line`, etc. — all already imported in the existing surfaces).

### Loading / skeleton / empty states (summary)
| State | Treatment |
|-------|-----------|
| Searching (find) | `<Skeleton>` rows + button spinner (`RiLoader4Line` animate-spin) |
| Importing | button label → "Syncing…" / "Importing…", disabled, spinner |
| No results (searched) | bordered muted card with existing copy |
| Not connected | bordered muted card "Connect {provider}…" |
| Connector imports automatically (PLAUD webhook / YouTube / file-upload) | existing "imports automatically" muted card (capability-gated via `getConnectorCapabilities`) |
| Browse empty | `TranscriptTable`'s built-in "No transcripts found" centered muted state |
| Selection persisted (returns after nav/OAuth) | selection re-renders from the durable store automatically — no spinner, no flash |

### Capability gating (provider-agnostic, all 7)
Reuse `getConnectorCapabilities(adapter)`:
- No `searchAvailable` (file-upload, youtube) → hide date picker + find section; show the "imports automatically" card.
- No `importSelected` → hide workspace picker + import button.
This is exactly the wizard's existing gating — carry it into `<ImportSurface>` unchanged.

---

## Sources

### Primary (HIGH confidence — direct file reads this session)
- `src/components/transcript-library/TranscriptTable.tsx` — props contract, no-virtualization (map over sortedCalls), client-side sort, `selectedCalls (number|string)[]` matched by `String(recording_id)`, pagination via `PaginationControls`
- `src/components/transcripts/UnsyncedMeetingsSection.tsx` — the proven `TranscriptTable` reuse template (Meeting → table shape map, `getUnsyncedMeetingSelectionKey` keys)
- `src/components/transcripts/SyncedTranscriptsSection.tsx` — browse-synced section, server-paginated
- `src/components/transcripts/SyncTab.tsx` — the good fork: two stacked sections, `activeOrganizationId` available, Fathom-only call path
- `src/components/connectors/ConnectorImportWizard.tsx` (635 lines) — the bad fork: hand-rolled checkbox list, manual cursor "Load more", volatile `useState` selection, `handleSyncAll` only syncs loaded `allSelectableIds`
- `src/pages/ImportPage.tsx` — renders `<ConnectorImportWizard>` in the connector branch; OAuth-return handling
- `src/pages/TranscriptsNew.tsx` — renders `<SyncTab>` in `TabsContent value="sync"`
- `src/services/sync-status.service.ts` — `getSyncStatusForExternalIds(sourceApp, externalIds, {organizationId})` canonical reader (Phase 24)
- `src/hooks/useImportSelection.ts` + `src/stores/importSelectionStore.ts` (via 25-01/25-02 summaries) — durable selection API
- `src/hooks/useSyncTabSelection.ts` — volatile two-set selection (the coupling that deferred its refactor to Phase 26)
- `src/components/connectors/registry/types.ts` — `AvailableCall` (`alreadyImported`), `searchAvailable`/`importSelected` adapter contract, `ConnectorSourceApp`
- `src/components/connectors/registry/adapters/adapter-helpers.ts` + `fathom.ts` + `zoom.ts` — `wasAlreadySynced(m) => m.synced` (per-adapter, server-computed) — the TBL-02 inconsistency
- `src/lib/oauth-callback-routing.ts` — `OAUTH_CALLBACK_ROUTES` (boot-init, throws if empty), CI test `src/lib/__tests__/oauth-callback-routing.test.ts`
- `src/config/source-registry.ts` — `oauthCallbackFunctionName` entries (boot-critical)
- `.planning/research/ARCHITECTURE.md`, `.planning/research/FEATURES.md`, `.planning/phases/24/*`, `.planning/phases/25/*`, `CONTEXT.md`, `REQUIREMENTS.md`

### Secondary (MEDIUM — design choices)
- `@tanstack/react-virtual` as the virtualization library (official TanStack package; verify at install)
- `content-visibility: auto` as the zero-dependency TBL-04 alternative

### Tertiary (LOW)
- None — all codebase claims are first-hand reads.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — reuses already-installed deps; only virtualization is a (gated) addition
- Architecture / fork-collapse targets: HIGH — every file, consumer, and call site read directly
- Carry-forward bug (CR-02/WR-01/WR-02): HIGH — confirmed against the real call path + reader filter
- TBL-04 virtualization approach: MEDIUM — table is confirmed non-virtualizing; the exact technique needs a Wave 0 prototype
- Pitfalls: HIGH — derived from verified code behavior

**Research date:** 2026-06-23
**Valid until:** 2026-07-23 (stable internal codebase; re-verify only if Phases 24/25 files change before planning)
