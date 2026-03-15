# Requirements: Callvault — Sort & Filter Fix

**Milestone:** v1.1 — Sort/Filter Hardening
**Defined:** 2026-03-15
**Core Value:** Every user can instantly find any call by any combination of filters — all results strictly scoped to their organization.

---

## v1.1 Requirements

### Org Scoping (Critical)

- [ ] **SCOPE-01**: All filter popover queries include org_id so results only show data from the current organization
- [ ] **SCOPE-02**: Global search modal results are scoped to current org_id only
- [ ] **SCOPE-03**: Inline search syntax filters (participant:, tag:, folder:, source:, duration:, date:, status:) apply only within current org
- [ ] **SCOPE-04**: Contact/participant autocomplete in ContactsFilterPopover only shows people from the current org's calls

### Participant / Contact Filter

- [ ] **CONTACT-01**: User can filter calls by participant name (attendee, speaker, or invitee)
- [ ] **CONTACT-02**: User can filter calls by participant email address
- [ ] **CONTACT-03**: ContactsFilterPopover search matches on both name AND email simultaneously
- [ ] **CONTACT-04**: Inline search syntax `participant:email@example.com` and `p:John` both resolve correctly
- [ ] **CONTACT-05**: Participant filter shows the correct count of matching calls

### Filter Stacking

- [ ] **STACK-01**: Applying a Tags filter then a Contacts filter returns calls matching BOTH criteria (AND logic)
- [ ] **STACK-02**: Applying Source + Duration filters returns only calls from that source within that duration range
- [ ] **STACK-03**: Applying Folder + Tags + Contacts simultaneously returns correct intersection
- [ ] **STACK-04**: Date range + any other filter stacks correctly
- [ ] **STACK-05**: All 6 filter types (Tags, Folders, Contacts, Duration, Source, Date) can be active simultaneously

### Individual Filter Removal

- [ ] **REMOVE-01**: Clicking X on a filter pill removes only that filter, all others remain active
- [ ] **REMOVE-02**: "Clear all" button removes all filters simultaneously
- [ ] **REMOVE-03**: Reopening a filter popover after partial clear shows correct current state
- [ ] **REMOVE-04**: URL params update correctly when a single filter is removed

### Tags Filter

- [ ] **TAG-01**: TagFilterPopover correctly fetches and displays tags for current org only
- [ ] **TAG-02**: Selecting one or more tags filters the transcript list to calls with ALL selected tags
- [ ] **TAG-03**: Tag filter search within popover works (by name/description)
- [ ] **TAG-04**: Tag filter Apply button applies without closing the page context
- [ ] **TAG-05**: Tag filter Clear button resets tag selection only

### Folder Filter

- [ ] **FOLDER-01**: FolderFilterPopover shows only folders belonging to current org
- [ ] **FOLDER-02**: Selecting a parent folder includes calls in child folders
- [ ] **FOLDER-03**: "Unorganized" option filters to calls not assigned to any folder
- [ ] **FOLDER-04**: Folder filter displays correct call count per folder
- [ ] **FOLDER-05**: Folder filter search by name works correctly

### Duration Filter

- [ ] **DUR-01**: "Less than X minutes" mode correctly filters calls shorter than threshold
- [ ] **DUR-02**: "More than X minutes" mode correctly filters calls longer than threshold
- [ ] **DUR-03**: Custom range slider (min/max) returns only calls within that range
- [ ] **DUR-04**: Duration filter Clear resets to no duration constraint

### Source Filter

- [ ] **SRC-01**: SourceFilterPopover only shows sources that exist in the current org's calls
- [ ] **SRC-02**: Selecting Fathom shows only Fathom-sourced calls
- [ ] **SRC-03**: Selecting multiple sources returns calls from ANY of the selected sources (OR logic)
- [ ] **SRC-04**: Source filter pill shows selected source names correctly

### Date Range Filter

- [ ] **DATE-01**: Setting dateFrom filters to calls on or after that date
- [ ] **DATE-02**: Setting dateTo filters to calls on or before that date
- [ ] **DATE-03**: Setting both dateFrom and dateTo returns calls within the range (inclusive)
- [ ] **DATE-04**: Inline `date:today`, `date:this week`, `date:this month` presets work correctly

### Sorting

- [ ] **SORT-01**: Clicking Title column sorts calls alphabetically (asc/desc toggles correctly)
- [ ] **SORT-02**: Clicking Date column sorts by recording date (asc/desc toggles correctly)
- [ ] **SORT-03**: Clicking Duration column sorts by call length (asc/desc toggles correctly)
- [ ] **SORT-04**: Clicking Participants column sorts by participant count (asc/desc toggles correctly)
- [ ] **SORT-05**: Clicking Source column sorts by source platform alphabetically (asc/desc)
- [ ] **SORT-06**: Sorting works correctly when filters are also active (sorted filtered results)
- [ ] **SORT-07**: Active sort column shows direction indicator (up/down arrow) correctly

### Search

- [ ] **SEARCH-01**: Main search bar returns only calls from current org
- [ ] **SEARCH-02**: Global search modal returns only calls from current org
- [ ] **SEARCH-03**: Search results respect active filters (search within filtered set)
- [ ] **SEARCH-04**: Inline `participant:name` syntax filters correctly by participant
- [ ] **SEARCH-05**: Inline `tag:name` syntax filters correctly by tag
- [ ] **SEARCH-06**: Inline `folder:name` syntax filters correctly by folder
- [ ] **SEARCH-07**: Inline `source:platform` syntax filters correctly by source
- [ ] **SEARCH-08**: Inline `duration:>30` and `duration:<60` syntax works correctly
- [ ] **SEARCH-09**: Inline `date:today`, `date:this week`, `date:this month` work correctly
- [ ] **SEARCH-10**: Inline `status:synced` and `status:unsynced` work correctly

### E2E Test Coverage

- [ ] **TEST-01**: Playwright test covers each filter in isolation (all 6 filter types)
- [ ] **TEST-02**: Playwright test covers filter stacking (at least 3-filter combination)
- [ ] **TEST-03**: Playwright test covers individual filter removal
- [ ] **TEST-04**: Playwright test covers all 5 sort columns
- [ ] **TEST-05**: Playwright test covers sort + filter combination
- [ ] **TEST-06**: Playwright test covers org isolation (no cross-org data leaks)
- [ ] **TEST-07**: Playwright test covers inline search syntax (key variants)

---

## v2 Requirements (Deferred)

### Advanced Search
- **SRCH-ADV-01**: Saved searches / search presets
- **SRCH-ADV-02**: Boolean search operators (AND/OR/NOT) in search bar
- **SRCH-ADV-03**: Search history autocomplete

### Analytics Filters
- **ANLYT-01**: Analytics filter bar time range scoped per org
- **ANLYT-02**: Analytics chart visibility settings persisted per user

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Cross-org admin search | Would intentionally break org isolation — separate admin feature |
| Fuzzy/semantic search improvements | Separate AI feature track |
| Mobile-optimized filter UI | Future milestone |
| Filter presets / saved views | v2 feature |

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SCOPE-01 | Phase 1 | Pending |
| SCOPE-02 | Phase 1 | Pending |
| SCOPE-03 | Phase 1 | Pending |
| SCOPE-04 | Phase 1 | Pending |
| TAG-01 | Phase 2 | Pending |
| TAG-02 | Phase 2 | Pending |
| TAG-03 | Phase 2 | Pending |
| TAG-04 | Phase 2 | Pending |
| TAG-05 | Phase 2 | Pending |
| FOLDER-01 | Phase 2 | Pending |
| FOLDER-02 | Phase 2 | Pending |
| FOLDER-03 | Phase 2 | Pending |
| FOLDER-04 | Phase 2 | Pending |
| FOLDER-05 | Phase 2 | Pending |
| CONTACT-01 | Phase 2 | Pending |
| CONTACT-02 | Phase 2 | Pending |
| CONTACT-03 | Phase 2 | Pending |
| CONTACT-04 | Phase 2 | Pending |
| CONTACT-05 | Phase 2 | Pending |
| DUR-01 | Phase 2 | Pending |
| DUR-02 | Phase 2 | Pending |
| DUR-03 | Phase 2 | Pending |
| DUR-04 | Phase 2 | Pending |
| SRC-01 | Phase 2 | Pending |
| SRC-02 | Phase 2 | Pending |
| SRC-03 | Phase 2 | Pending |
| SRC-04 | Phase 2 | Pending |
| DATE-01 | Phase 2 | Pending |
| DATE-02 | Phase 2 | Pending |
| DATE-03 | Phase 2 | Pending |
| DATE-04 | Phase 2 | Pending |
| STACK-01 | Phase 3 | Pending |
| STACK-02 | Phase 3 | Pending |
| STACK-03 | Phase 3 | Pending |
| STACK-04 | Phase 3 | Pending |
| STACK-05 | Phase 3 | Pending |
| REMOVE-01 | Phase 3 | Pending |
| REMOVE-02 | Phase 3 | Pending |
| REMOVE-03 | Phase 3 | Pending |
| REMOVE-04 | Phase 3 | Pending |
| SORT-01 | Phase 4 | Pending |
| SORT-02 | Phase 4 | Pending |
| SORT-03 | Phase 4 | Pending |
| SORT-04 | Phase 4 | Pending |
| SORT-05 | Phase 4 | Pending |
| SORT-06 | Phase 4 | Pending |
| SORT-07 | Phase 4 | Pending |
| SEARCH-01 | Phase 5 | Pending |
| SEARCH-02 | Phase 5 | Pending |
| SEARCH-03 | Phase 5 | Pending |
| SEARCH-04 | Phase 5 | Pending |
| SEARCH-05 | Phase 5 | Pending |
| SEARCH-06 | Phase 5 | Pending |
| SEARCH-07 | Phase 5 | Pending |
| SEARCH-08 | Phase 5 | Pending |
| SEARCH-09 | Phase 5 | Pending |
| SEARCH-10 | Phase 5 | Pending |
| TEST-01 | Phase 6 | Pending |
| TEST-02 | Phase 6 | Pending |
| TEST-03 | Phase 6 | Pending |
| TEST-04 | Phase 6 | Pending |
| TEST-05 | Phase 6 | Pending |
| TEST-06 | Phase 6 | Pending |
| TEST-07 | Phase 6 | Pending |

**Coverage:**
- v1.1 requirements: 57 total
- Mapped to phases: 57
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-15*
*Last updated: 2026-03-15 — traceability updated with per-requirement phase mapping*
