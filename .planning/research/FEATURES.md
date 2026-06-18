# Feature Research

**Domain:** "Connect a source and import/sync content" — durable, observable batch import across 7 meeting-recorder providers (Fathom, Zoom, Fireflies, Grain, Read.ai, PLAUD, YouTube) into CallVault.
**Researched:** 2026-06-18
**Confidence:** HIGH on UX patterns (multiple verified sources + direct read of the two existing CallVault surfaces); MEDIUM on competitor-specific internals (the AI-notetaker tools don't publish import-UX docs; their patterns are inferred from category norms).

> **Scope note (subsequent milestone — v2.1 Import/Sync Rebuild).** This replaces the v2.0 autonomous-ops FEATURES research. The connectors, OAuth, manual paste, MCP server, and the dense `TranscriptTable` already exist — this milestone reworks the *import/sync UX* so selection, progress, and partial-failure survive navigation; one shared surface replaces the two forked codepaths; "sync all" actually syncs all; and browsing already-synced calls is cleanly separated from finding/importing new ones. Workstream codes from PROJECT.md: IMP / SEL / TBL / JOB / FAIL / SYNC / BROWSE.

---

## Framing: the structural fault this milestone fixes

Both existing surfaces hold the trustworthy state — selection, search results, progress, results — in **volatile React `useState`**:

- `ConnectorImportWizard` (Import tab): `useState` for `results`, `selected: Set`, `nextCursor`, `importing`. Fire-and-forget — `handleImport` fires the job, toasts once, clears the selection, forgets. No poller. "Load more" is manual cursor paging. **This is the surface John from Clickable hit: selections vanished on navigation, only some imported, no status.**
- `SyncTab` (Transcripts area): better — has a `sync_jobs` poller (`useSyncTabState`), an `ActiveSyncJobsCard`, a `SyncStatusIndicator`, auto-loops pages, and renders the dense shared `TranscriptTable` via `UnsyncedMeetingsSection` (find) over `SyncedTranscriptsSection` (browse). But selection still lives in `useSyncTabSelection` (volatile), and the two surfaces have forked into two paging models, two selection stores, two progress UIs.

Every John-complaint maps to a missing feature below. The job of this research is to name those features and rank them table-stakes vs differentiator vs anti-feature so v2.1 scopes correctly. The North Star pattern, verified across sources: **"The UI must restore the job's latest status correctly when [users] return and not restart from scratch or show stale information."** That single sentence is the milestone.

---

## The two-mode mental model (Question 1: Browse vs Find/Import)

Best-in-class connect-and-import products separate two fundamentally different operations, and the separation is **economic**, not just visual:

| Mode | What it is | Data source | Cost | Speed expectation |
|------|-----------|-------------|------|-------------------|
| **BROWSE** (already-synced) | "What's in my vault?" | Cheap durable DB read (`recordings`) | Free, paginated, fast | Instant, sortable, virtualizable |
| **FIND + IMPORT** (new) | "What's available at the provider I haven't pulled yet?" | Expensive live provider API call (rate-limited, cursor-paged) | Slow, network-bound, costs API quota | Acknowledged-slow, must show progress |

**How good products present this — one surface or two?**

The dominant, correct pattern is **one surface with a clear mode signal**, not two separate apps:

- **Plaid-style connect flows / Gmail import / Google Photos importer / Salesforce data import:** a single destination view (your inbox / your library / your records) where importing is an *action that adds to that view*, and "already imported" items are shown **inline, visually de-emphasized** — greyed, checkmarked, or with an "Imported" badge — rather than hidden in a separate screen. You never make the user mentally diff two lists.
- **The "already imported" affordance is inline state, not a separate area.** CallVault's `ConnectorImportWizard` already does the right thing here at the row level (`call.alreadyImported` → opacity-50, disabled checkbox, "(already imported)" label). The fix is to make that signal **durable and trustworthy** — the PROJECT.md `recordings` vs legacy `fathom_calls` split must resolve to one query (IMP workstream) — not to build a second screen.
- **Anti-pattern (call this out explicitly):** building BROWSE and FIND/IMPORT as two separate top-level destinations the user navigates between. That is exactly today's `SyncTab` vs `ConnectorImportWizard` fork. Collapsing onto one surface with one section split is the whole point — **do not re-create two apps.**

**Recommended concrete shape:** one page, one shared `TranscriptTable`, two stacked sections the user reads as "new to import (live, slow, costs a fetch)" above "already in your vault (instant, free)". This is structurally what `SyncTab` already does. The win is killing the wizard and pointing the Import tab at this same component (TBL workstream).

---

## Feature Landscape

### Table Stakes (Users Expect These)

Missing these = the product feels broken. John already proved each gap is a real complaint.

| Feature | Why Expected | Complexity | Notes / dependency |
|---------|--------------|------------|-------------------|
| **Selection survives navigation, date change, OAuth return** | User selected a batch, navigated, selections vanished — the canonical John failure. Every importer assumes selection persistence. | MEDIUM | Move `selected: Set` out of `useState` into a durable Zustand store keyed by `provider + dateRange` (SEL). Hardest part is the key model, not the store. |
| **Per-job progress that survives refresh** | "No status indicator" — user can't tell if anything happened. Verified universal expectation: restore latest job status on return, never restart or show stale. | MEDIUM | `sync_jobs` table exists and `SyncTab` already polls it. Port the poller to the unified surface (JOB). |
| **Partial-success display** | "Only some imported" with no explanation. Verified: partial failure is a real outcome — show "18 of 30 imported, 12 failed", not silent success or total failure. | MEDIUM | Surface `completed_with_errors` / `failed_ids` *where the button was pressed*. Backend likely already returns counts; the gap is the UI never renders them (FAIL). |
| **Retry just the failures** | Re-importing 30 to recover 12 is hostile. Verified: "retry failed items only" is the expected recovery. | LOW–MEDIUM | Wire to the **existing single-call retry path** (PROJECT.md confirms it exists). Mostly UI: a "Retry 12 failed" button bound to `failed_ids`. |
| **Select-all (current results)** | Baseline bulk affordance. | LOW | Both surfaces already have it (`toggleSelectAll`). Keep. |
| **"X selected" running count + persistent bulk-action bar** | Users must see selection size and act without scrolling. Verified: the action bar "has to stay persistent while users scroll." | LOW | `UnsyncedMeetingsSection` already shows "{n} selected" + an action row. Standardize on the unified surface. |
| **No silent auto-dismiss of status/errors** | The 8-second auto-dismiss hides what happened. | LOW | PROJECT.md explicitly calls for removing it (JOB). Trivial deletion, high trust payoff. |
| **Persistent per-provider status indicator** | "Last synced X · N new available · M failed" — the at-a-glance "am I caught up?" signal every sync product has (Gmail "Updated just now", Dropbox "Up to date"). | MEDIUM | Needs a cheap durable read of last-sync time + a failure count. Depends on the unified sync-status source of truth (IMP). |
| **Pagination that doesn't feel slow** | "Load 10 at a time" is the explicit slowness complaint. | MEDIUM | See dedicated section. BROWSE: bigger pages + virtualized table. FIND: background-prefetch the next cursor page. |
| **Empty / connected / disconnected states** | Stranger-self-serve launch bar. | LOW | Already largely present in both surfaces. |

### Differentiators (Competitive Advantage)

Aligned with CallVault's Core Value ("reliable enough that a stranger wires it up without help") and the One-Click Promise.

| Feature | Value Proposition | Complexity | Notes / dependency |
|---------|-------------------|------------|-------------------|
| **Select-all-matching-filter ("Select all 312 matching", not just this page)** | The single biggest scale unlock. User filters by date, wants the whole result set, not 10 visible rows. Verified: when select-all covers the filtered set, say so explicitly ("Select all 312") and confirm for large N. | MEDIUM–HIGH | Requires the backend to accept "import everything matching this filter" rather than an explicit ID list — which is exactly **Server-side Sync-all**. These two are the same feature from two ends. |
| **Server-side "Sync all from this provider"** | One-click "just sync everything, I don't want to babysit pages." Decouples the import from what the UI has scrolled — backend pages the provider itself across the date range. This is the "everything is being synced without worry" reassurance (Question 4). | HIGH | SYNC. Backend job owns the provider cursor loop. The current `handleSyncAll` is a lie — it only syncs `allSelectableIds` (what's currently loaded on screen), not everything available. Real sync-all must run server-side. **Flagship differentiator.** |
| **Live progress via push (Realtime) instead of polling** | "124 of 500 imported" updating live feels dramatically more trustworthy than a spinner. Verified: "real-time updates, if possible." | MEDIUM | Supabase Realtime on `sync_jobs` (PROJECT.md key decision leans this way). Polling is the acceptable fallback and already exists. |
| **Calm, specific progress microcopy** | "Fetching available calls from Fathom (page 3)" / "Imported 97, skipped 3" beats "Processing…". Verified anti-pattern: vague "Loading…". | LOW | Pure copy. Cheap trust win. |
| **Range select (shift-click)** | Power-user batch selection in a dense table. | LOW–MEDIUM | Differentiator, not table-stakes. Defer if it complicates the durable-selection store. |
| **One dense shared `TranscriptTable` everywhere** | Consistency = learnability; one paging model, one selection store, one progress UI. Reduces the maintenance + bug surface that forked the two flows in the first place. | MEDIUM–HIGH | TBL. Plumbing, but the structural fix that makes every other feature land once instead of twice. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Two separate destinations for Browse vs Find/Import** | "They're different operations, give them different screens" | This *is* the current fork. Two screens = two paging models, two selection stores, two progress UIs, two places for bugs to diverge — the root cause of John's failure. | One surface, two stacked sections (new-above-synced) with one shared table + one durable selection store. |
| **Client-side "Sync all" that loops the loaded pages** | Looks like sync-all, easy to ship | The current wizard `handleSyncAll` only imports what's been scrolled into `results` — it silently under-imports, which is *exactly* the "only some imported" complaint. A sync-all that depends on UI scroll is a trap. | Server-side sync-all that owns the provider cursor; UI just fires it and watches the job. |
| **Spinner-only / indeterminate progress for long imports** | Quick to build | Users can't tell stuck from slow; verified anti-pattern. For a 500-call import this is unacceptable. | Determinate counters ("N of M"), per-item states, persistent across refresh. |
| **Reject/abort whole batch on any failure** | "All-or-nothing is cleaner" | Hostile at scale — one bad call shouldn't sink 300 good ones. Verified: "Rejecting an entire file because of one invalid row is hostile UX." | Partial success + retry-failures-only. |
| **8-second auto-dismissing toasts as the status system** | Already built; non-blocking | Status that vanishes is status that doesn't exist; the user navigates away and loses the thread. | Durable, persistent status indicator + a jobs card that stays until acknowledged. |
| **Infinite scroll for the BROWSE (already-synced) list** | Feels modern, "no paging" | Loses scroll position on navigation, hard to "jump to page 7", user can't tell how much is left. For a durable archive users return to, explicit paging + total count is more trustworthy. | Virtualized dense table with explicit page controls + total count (what `SyncedTranscriptsSection` already does). Reserve infinite/auto-loop for the FIND list where total is unknown anyway. |
| **Generic "select all" that silently means only this page** | Simplest checkbox behavior | Users assume it covers the filter; the gap between "selected 10" and "wanted 312" is the scale frustration. | Explicit "Select all N matching" with a confirm for large N, distinct from "select visible". |

---

## Feature Dependencies

```
[Unified sync-status source of truth (IMP)]
    └──required by──> [Inline "already imported" badge that's trustworthy]
    └──required by──> [Per-provider "Last synced · N new · M failed" indicator]
    └──required by──> [Browse vs Find/Import split (BROWSE)]

[Durable selection store (SEL)]
    └──required by──> [Selection survives navigation / date / OAuth return]
    └──required by──> [Select-all-matching-filter]

[One shared TranscriptTable surface (TBL)]
    └──enables once-not-twice──> [every status/selection/progress feature]
    └──requires──> [Durable selection store (SEL)]  (table reads one store)

[sync_jobs poller on unified surface (JOB)]
    └──required by──> [Partial-success display (FAIL)]
    └──required by──> [Retry-failures-only (FAIL)]
    └──required by──> [observing a server-side Sync-all the UI didn't enumerate]
    └──enhanced by──> [Realtime push progress]

[Server-side Sync-all (SYNC)]
    ══is the same feature as══> [Select-all-matching-filter]  (two ends of one capability)
    └──requires──> [sync_jobs poller (JOB)]
```

### Dependency Notes

- **IMP is the foundation.** Until "is this call synced?" has one durable answer, the inline badge, the per-provider indicator, and the browse/find split all sit on sand. This is why PROJECT.md's provisional build order leads with it.
- **SEL must precede TBL.** The shared table should read selection from the durable store, not its own `useState` — building the table first means rewiring it later.
- **SYNC and select-all-matching-filter are one capability.** The backend that pages the provider across a date range is what makes "select all 312 matching" mean something the UI can't enumerate. Scope them together; don't budget them twice.
- **JOB gates FAIL and SYNC observability.** You can't show partial-success/retry, or watch a server-side sync-all, without the poller on the surface.

---

## MVP Definition

### Launch With (v2.1 — the rebuild)

The milestone *is* the MVP; these are the cuts that make John's failure impossible by construction.

- [ ] **Unified sync-status source of truth (IMP)** — one durable answer to "is this synced?"; trustworthy inline "imported" badge.
- [ ] **Durable selection (SEL)** — survives navigation, date change, OAuth return.
- [ ] **One shared `TranscriptTable` surface (TBL)** — kill the wizard's custom checkbox list; both tabs use the same component, paging model, selection store.
- [ ] **`sync_jobs` poller on every import surface + remove 8s auto-dismiss (JOB)** — durable, refresh-surviving progress.
- [ ] **Partial-success + retry-failures-only (FAIL)** — "18 of 30 imported, 12 failed — Retry", wired to the existing single-call retry path.
- [ ] **Server-side "Sync all from provider" (SYNC)** — real sync-all that pages the provider itself; doubles as select-all-matching-filter.
- [ ] **Persistent per-provider indicator** — "Last synced X · N new available · M failed".
- [ ] **Faster paging** — bigger page size + virtualized BROWSE table + background-prefetch the next FIND cursor page (replace "Load 10 at a time").

### Add After Validation (v2.1.x)

- [ ] **Realtime push progress** — swap polling for Supabase Realtime once the poller is proven and the job model is stable. Trigger: polling feels laggy or job volume makes polling chatty.
- [ ] **Range select (shift-click)** in the dense table. Trigger: power users ask after select-all-matching ships.
- [ ] **Calm per-step microcopy** — easy polish once job states are wired.

### Future Consideration (v2+)

- [ ] **Scheduled / continuous auto-sync per provider** (set-and-forget). Defer — webhook-driven arrival already covers some providers; full scheduled backfill is a separate reliability project.
- [ ] **Cross-provider "fetch from all connected sources at once"** — `SyncTab` gestures at this with source filters; promote to a real one-button multi-source sync only after single-provider sync-all is trusted.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Durable selection (SEL) | HIGH | MEDIUM | P1 |
| sync_jobs poller + kill auto-dismiss (JOB) | HIGH | MEDIUM | P1 |
| Partial-success + retry-failures (FAIL) | HIGH | MEDIUM | P1 |
| Unified sync-status source of truth (IMP) | HIGH | MEDIUM | P1 |
| One shared TranscriptTable surface (TBL) | MEDIUM (plumbing, enables rest) | HIGH | P1 |
| Server-side Sync-all (SYNC) = select-all-matching | HIGH | HIGH | P1 |
| Persistent per-provider indicator | HIGH | MEDIUM | P1 |
| Faster paging (virtualize + prefetch) | HIGH | MEDIUM | P1 |
| Realtime push progress | MEDIUM | MEDIUM | P2 |
| Range select (shift-click) | LOW | LOW–MEDIUM | P3 |
| Scheduled auto-sync | MEDIUM | HIGH | P3 |

**Priority key:** P1 = must-have to make John's failure impossible by construction · P2 = polish once the durable loop is proven · P3 = defer.

---

## Pagination / loading UX that doesn't feel slow (Question 5)

The "Load 10 at a time" complaint has two different fixes because BROWSE and FIND have different constraints:

- **BROWSE (already-synced, DB-backed):** use a **virtualized dense table** with a **large page size** and explicit page controls + total count. `SyncedTranscriptsSection` already paginates with `existingPageSize`/`existingTotalCount` — bump the default page size and virtualize the row rendering so a big page stays smooth. Explicit paging (not infinite scroll) is correct here: it's a durable archive the user returns to and wants to navigate predictably.
- **FIND (live provider API, cursor-paged):** the slowness is the network, not the render. Two fixes: (1) **background-prefetch the next cursor page** while the user reviews the current one, so "more" is already loaded; (2) **auto-loop pages up to a sane cap** with a visible "fetching page N…" counter rather than a manual "Load more" per 10. `SyncTab`'s orchestration already auto-loops — adopt that model and kill the wizard's manual cursor button. Pair with select-all-matching so the user never has to scroll-to-select the whole set anyway.

---

## Status / observability detail (Question 3) — the John failure, fully specified

Verified job-status contract every good async UI exposes: **state** (queued / running / succeeded / failed / canceled), **progress** (N of M), **short message**, **timestamps**, **result pointer**. Applied to CallVault:

- **Per-job:** "Importing 124 of 500 from Fathom" — live counter, survives refresh (read from `sync_jobs`).
- **Per-item:** queued → importing → done / failed, with failed items **pinned to the top** and a reason.
- **Partial success:** "18 of 30 imported · 12 failed" rendered *where the import was triggered* (not a vanishing toast), with **"Retry 12 failed"** wired to the existing single-call retry.
- **Persistent per-provider:** "Fathom — Last synced 2h ago · 6 new available · 0 failed" — the at-a-glance caught-up signal (Gmail "Updated just now" / Dropbox "Up to date" equivalent).
- **Reassurance for sync-all (Question 4):** when a server-side sync-all is running, the indicator becomes the trust anchor — "Syncing everything from Fathom… 240 of ~600" — so the user can navigate away and come back to find it still tracking. Calm specific microcopy, never "Processing…".

---

## Selection at scale detail (Question 2)

- **Select visible** (current page) and **Select all N matching** (whole filtered set) are *distinct affordances* — both surfaces today only do select-visible. Verified: make select-all-matching explicit ("Select all 312") and confirm for large N.
- **"X selected" persistent bulk bar** that expands/contracts with selection and overflows extra actions into "More" — stays where the user expects while scrolling.
- **Range select (shift-click)** is a differentiator, not table-stakes.
- **Persistence across pages and navigation** is the hard part and the whole point of SEL — selection lives in a durable store, not the table's `useState`, keyed by provider + date range so it survives an OAuth round-trip.
- **Dual recording-ID caution:** selection keys must route through `@/lib/recording-ids` (`toRecordingUuid`) — never `parseInt`/`Number` — because of the UUID-vs-legacy-numeric split.

---

## Dependencies on existing CallVault pieces (for scoping)

- **`TranscriptTable`** (`src/components/transcript-library/TranscriptTable.tsx`): the dense shared table. Already consumed by `UnsyncedMeetingsSection` (FIND) *and* `SyncedTranscriptsSection` (BROWSE) — proof the one-surface model already works on one side. Accepts `selectedCalls`, `onSelectCall`, `onSelectAll`, `isUnsyncedView`, paging props. TBL = make the wizard use this too. Selection keys must route through `@/lib/recording-ids`.
- **`sync_jobs` table + poller** (`useSyncTabState`, `ActiveSyncJobsCard`, `SyncStatusIndicator`): the observable-job machinery already exists on the Sync tab side. JOB/FAIL = generalize and port it to the unified surface; do not rebuild it.
- **Existing single-call retry path** (PROJECT.md confirms): FAIL "retry failed only" wires to this — don't build a new batch-retry backend.
- **Connector adapter registry** (`connectorRegistry.ts`, `searchAvailable` / `importSelected` capability flags): the provider-agnostic seam. Server-side sync-all (SYNC) needs a provider-side pager alongside `searchAvailable`; capability gating (`canSearchAvailable`, `importsAutomatically`) already handles webhook-only providers (YouTube, file-upload) that can't be searched.
- **`recordings` vs legacy `fathom_calls` split** (IMP): the one piece of genuine data-model work — collapse to a single durable "is synced?" query before the inline badge and per-provider indicator are trustworthy.

---

## Competitor Feature Analysis

| Feature | AI-notetaker libraries (Fathom/Fireflies/Otter) | Plaid / Gmail / Photos importers | CallVault v2.1 approach |
|---------|------------------------------------------------|----------------------------------|--------------------------|
| Browse vs import | Single library; ingestion automatic/background, "import" invisible | One destination; already-imported shown inline & de-emphasized | One surface, new-above-synced sections, inline "imported" badge |
| Select at scale | Bulk-select within library; select-all-on-page | "Select all N matching" with confirm | Select-all-matching = server-side sync-all |
| Status | Background, minimal surfaced status | Persistent progress + restore-on-return | sync_jobs poller, refresh-surviving, per-provider indicator |
| Partial failure | Largely hidden | "Imported 97, skipped 3" + retry | "18 of 30 · Retry 12 failed" |
| Sync-all | N/A (auto-ingests) | "Import everything" backend job | Server-side provider pager (flagship) |

CallVault's edge: it aggregates *seven* providers into one vault, so the **per-provider observable indicator + provider-agnostic durable job model** is the differentiator the single-source notetakers don't need and don't have.

---

## Sources

- [How To Design Bulk Import UX — Smart Interface Design Patterns](https://smart-interface-design-patterns.com/articles/bulk-ux/) — five-stage import model, "help users fix issues" emphasis (MEDIUM: lacked selection/status specifics).
- [Bulk action UX: 8 design guidelines — Eleken](https://www.eleken.co/blog-posts/bulk-actions-ux) — persistent action bar, select-all-matching explicitness, confirm for large N.
- [UI patterns for async workflows, background jobs, and data pipelines — LogRocket](https://blog.logrocket.com/ux-design/ui-patterns-for-async-workflows-background-jobs-and-data-pipelines/) — per-item states, partial-success summaries, retry-failed-only, restore-status-on-return, calm microcopy, anti-patterns (HIGH).
- [Background tasks with progress updates: UI patterns that work — AppMaster](https://appmaster.io/blog/background-tasks-progress-ui) — job-status snapshot contract, partial-success counts, retry/backoff, session restoration.
- [Data import UX: spreadsheet imports users don't hate — ImportCSV](https://www.importcsv.com/blog/data-import-ux) — "rejecting whole file on one bad row is hostile UX."
- [Filtering UX — Smart Interface Design Patterns](https://smart-interface-design-patterns.com/articles/filtering-ux/) — filter-then-select scale patterns.
- [Otter vs Fireflies vs Fathom comparisons (2026)](https://www.usecarly.com/blog/otter-vs-fireflies-vs-fathom/) — category norms for AI-notetaker libraries (MEDIUM: no import-UX internals published).
- Direct read of CallVault source: `src/components/connectors/ConnectorImportWizard.tsx`, `src/components/transcripts/SyncTab.tsx`, `src/components/transcripts/UnsyncedMeetingsSection.tsx`, and `.planning/PROJECT.md` (v2.1 scope + workstreams) — authoritative current-state evidence (HIGH).

---
*Feature research for: durable, observable, provider-agnostic call import/sync (CallVault v2.1)*
*Researched: 2026-06-18*
