# Roadmap: Callvault (brain)

## Milestones

- ✅ **v1.0 Foundation** - Pre-GSD (shipped before planning init)
- 🚧 **v1.1 Sort/Filter Hardening** - Phases 1-6 (in progress)

## Phases

<details>
<summary>✅ v1.0 Foundation - SHIPPED (pre-GSD, no phase plans)</summary>

Transcript library, filter bar, sorting, global search, URL persistence, folder/tag management, and Playwright infrastructure all shipped. Known issues carried forward into v1.1.

</details>

---

### 🚧 v1.1 Sort/Filter Hardening (In Progress)

**Milestone Goal:** Every filter, sort, and search in the transcript library works correctly, stacks with other filters, removes independently, and is strictly scoped to the current organization — with Playwright tests covering every scenario.

- [ ] **Phase 1: Org Scoping** — Audit all queries and lock every filter, popover, and search to current org_id
- [ ] **Phase 2: Individual Filter Fixes** — Fix each filter popover (Tags, Folders, Contacts, Duration, Source, Date) in isolation
- [ ] **Phase 3: Filter Stacking & Removal** — Fix FilterBar state so filters stack with AND logic and remove individually
- [ ] **Phase 4: Sort Column Fixes** — Fix all 7 sort behaviors including direction indicators and sort-under-filters
- [ ] **Phase 5: Search Fixes** — Fix main search bar, global modal, and all inline syntax operators, all org-scoped
- [ ] **Phase 6: E2E Test Suite** — Write/update Playwright tests covering isolation, all filters, stacking, removal, sort, and search

---

## Phase Details

### Phase 1: Org Scoping
**Goal**: Every query that powers filters, popovers, autocomplete, and search is scoped to the current org_id — no cross-org data can ever appear
**Depends on**: Nothing (first phase)
**Requirements**: SCOPE-01, SCOPE-02, SCOPE-03, SCOPE-04
**Success Criteria** (what must be TRUE):
  1. A user logged into Org A sees zero tags, folders, contacts, or transcripts from Org B in any filter popover or search result
  2. TagFilterPopover, FolderFilterPopover, ContactsFilterPopover, DurationFilterPopover, and SourceFilterPopover all pass org_id to their Supabase queries
  3. Global search modal returns only records whose org_id matches the current session
  4. All inline search syntax operators (participant:, tag:, folder:, source:, duration:, date:, status:) resolve only within current org
  5. ContactsFilterPopover autocomplete candidates are drawn exclusively from the current org's call participants
**Plans**: TBD

Plans:
- [ ] 01-01: Audit filter-utils.ts, FilterBar.tsx, and all popover components — catalog every Supabase query missing org_id
- [ ] 01-02: Patch org_id into all popover queries (TAG, FOLDER, DUR, SRC) using useOrgContext
- [ ] 01-03: Patch org_id into ContactsFilterPopover autocomplete query and GlobalSearchModal queries
- [ ] 01-04: Patch inline search syntax parser (parseSearchSyntax) to inject org_id into all operator resolutions

### Phase 2: Individual Filter Fixes
**Goal**: Each filter popover correctly fetches org-scoped data, applies its filter to the transcript list, and clears its own state without touching others
**Depends on**: Phase 1
**Requirements**: TAG-01, TAG-02, TAG-03, TAG-04, TAG-05, FOLDER-01, FOLDER-02, FOLDER-03, FOLDER-04, FOLDER-05, CONTACT-01, CONTACT-02, CONTACT-03, CONTACT-04, CONTACT-05, DUR-01, DUR-02, DUR-03, DUR-04, SRC-01, SRC-02, SRC-03, SRC-04, DATE-01, DATE-02, DATE-03, DATE-04
**Success Criteria** (what must be TRUE):
  1. Selecting one or more tags in TagFilterPopover and clicking Apply filters the transcript list to calls carrying all selected tags, and Clear resets only the tag selection
  2. Selecting a folder (including parent folders that cascade to children) in FolderFilterPopover filters the list correctly; "Unorganized" shows only unassigned calls with correct count
  3. Typing a participant name or email in ContactsFilterPopover and applying returns only calls where that person appears as attendee, speaker, or invitee — both name and email match work
  4. Selecting a duration mode (less than / more than / range) in DurationFilterPopover and applying returns only calls matching that length constraint
  5. Selecting one or more sources in SourceFilterPopover returns calls from any selected source (OR logic); selecting a date range returns only calls within that window (inclusive)
**Plans**: TBD

Plans:
- [ ] 02-01: Fix TagFilterPopover — org-scoped fetch, apply/clear state, call-count display
- [ ] 02-02: Fix FolderFilterPopover — org-scoped fetch, parent-cascade logic, Unorganized option, call counts
- [ ] 02-03: Fix ContactsFilterPopover — name+email search, all role types (attendee/speaker/invitee), inline syntax operators (participant:, p:)
- [ ] 02-04: Fix DurationFilterPopover — all three modes (less than / more than / custom range), clear
- [ ] 02-05: Fix SourceFilterPopover + Date range — org-scoped source list, OR logic, date inclusive bounds, inline date presets

### Phase 3: Filter Stacking & Removal
**Goal**: Multiple filters can be active simultaneously with AND logic, and any single filter can be removed via its pill without disturbing the others
**Depends on**: Phase 2
**Requirements**: STACK-01, STACK-02, STACK-03, STACK-04, STACK-05, REMOVE-01, REMOVE-02, REMOVE-03, REMOVE-04
**Success Criteria** (what must be TRUE):
  1. Applying a Tags filter and then a Contacts filter returns only calls that satisfy both — the transcript list is the intersection
  2. All 6 filter types (Tags, Folders, Contacts, Duration, Source, Date) can be active at the same time and the list reflects their combined AND constraint
  3. Clicking the X on a single filter pill removes only that filter; all other active filters remain applied and the list updates correctly
  4. Clicking "Clear all" removes every filter simultaneously and the list resets to unfiltered
  5. URL params reflect the exact set of active filters at all times — removing one filter updates the URL without touching params for the others; reopening a popover after partial clear shows the correct remaining state
**Plans**: TBD

Plans:
- [ ] 03-01: Audit FilterBar state management — identify where combining filters clobbers state; fix to merge filter objects instead of replacing
- [ ] 03-02: Implement per-filter pill removal that updates only the targeted filter key in URL params and FilterBar state
- [ ] 03-03: Verify "Clear all" path, popover re-open state consistency, and URL round-trip correctness

### Phase 4: Sort Column Fixes
**Goal**: All five sort columns toggle correctly between ascending and descending, display direction indicators, and produce accurate results even when filters are active
**Depends on**: Phase 3
**Requirements**: SORT-01, SORT-02, SORT-03, SORT-04, SORT-05, SORT-06, SORT-07
**Success Criteria** (what must be TRUE):
  1. Clicking the Title column header sorts the visible transcript list alphabetically (A-Z on first click, Z-A on second), and an up/down arrow appears next to the column label
  2. Clicking Date, Duration, Participants, and Source column headers each sort correctly in both directions with the direction indicator updating accordingly
  3. When one or more filters are active, sorting is applied to the filtered result set — the sorted order does not reset or expand the filter
  4. Only one sort column is active at a time; clicking a new column clears the previous sort indicator
**Plans**: TBD

Plans:
- [ ] 04-01: Audit useTableSort hook and TranscriptTable sort wiring — identify broken columns and incorrect sort comparators
- [ ] 04-02: Fix all 5 sort columns with correct comparators, asc/desc toggle, and direction indicator rendering; verify sort-under-active-filters

### Phase 5: Search Fixes
**Goal**: Main search bar, global modal, and all inline syntax operators return only org-scoped results and respect any active filters
**Depends on**: Phase 1
**Requirements**: SEARCH-01, SEARCH-02, SEARCH-03, SEARCH-04, SEARCH-05, SEARCH-06, SEARCH-07, SEARCH-08, SEARCH-09, SEARCH-10
**Success Criteria** (what must be TRUE):
  1. Typing in the main search bar returns only transcripts from the current org — zero results from other orgs appear regardless of query
  2. The global search modal (keyboard shortcut / nav trigger) returns only current-org transcripts
  3. Results from search respect any active filter pills — searching within an already-filtered set narrows further rather than resetting filters
  4. Inline operators participant:name and p:name correctly filter by participant; tag:name, folder:name, source:platform, duration:>30, duration:<60 all resolve correctly within current org
  5. Inline date presets (date:today, date:this week, date:this month) and status operators (status:synced, status:unsynced) return correct results
**Plans**: TBD

Plans:
- [ ] 05-01: Fix main search bar query to include org_id and respect active filter state
- [ ] 05-02: Fix GlobalSearchModal to scope all queries to current org
- [ ] 05-03: Fix parseSearchSyntax inline operators — verify all 8 operator types produce correct org-scoped results

### Phase 6: E2E Test Suite
**Goal**: Playwright tests provide automated verification of every fixed scenario — org isolation, each filter type, stacking, removal, sort, and search
**Depends on**: Phases 1-5
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04, TEST-05, TEST-06, TEST-07
**Success Criteria** (what must be TRUE):
  1. Running the Playwright suite produces a passing result for each of the 6 filter types exercised in isolation (tags, folders, contacts, duration, source, date)
  2. A test covering at least a 3-filter combination (e.g., Tags + Contacts + Date) passes and confirms AND logic produces the correct intersection
  3. A test covering individual filter pill removal passes — confirms only the targeted filter clears, others remain
  4. Tests for all 5 sort columns pass, including one test that sorts while a filter is active
  5. A test covering org isolation passes — a fixture user from Org A cannot see any data from Org B in any filter popover or search result
**Plans**: TBD

Plans:
- [ ] 06-01: Write filter isolation tests for all 6 filter types
- [ ] 06-02: Write filter stacking test (3+ filters) and individual removal test
- [ ] 06-03: Write sort column tests including sort-under-filter scenario
- [ ] 06-04: Write org isolation test and inline search syntax tests for key operators

---

## Progress

**Execution Order:** 1 → 2 → 3 → 4 → 5 → 6
(Note: Phase 5 depends on Phase 1 but can begin after Phase 1 completes, parallel with Phases 2-4 if desired.)

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Org Scoping | v1.1 | 0/4 | Not started | - |
| 2. Individual Filter Fixes | v1.1 | 0/5 | Not started | - |
| 3. Filter Stacking & Removal | v1.1 | 0/3 | Not started | - |
| 4. Sort Column Fixes | v1.1 | 0/2 | Not started | - |
| 5. Search Fixes | v1.1 | 0/3 | Not started | - |
| 6. E2E Test Suite | v1.1 | 0/4 | Not started | - |

---
*Roadmap created: 2026-03-15 — v1.1 Sort/Filter Hardening*
