# Callvault (brain)

## What This Is

Callvault is a private transcript library and intelligence platform for sales teams and organizations. Users import meeting recordings from Fathom, Zoom, YouTube, or file upload, then browse, search, filter, and analyze their call library. All data is org-scoped — each user belongs to an organization and should only ever see data within that org.

## Core Value

Every user can instantly find any call by any combination of who was on it, when it happened, how long it was, what folder it's in, or what tags it carries — and every result is strictly scoped to their organization.

## Requirements

### Validated

- ✓ Transcript import from Fathom, Zoom, YouTube, file upload — v1.0
- ✓ Transcript library table with pagination — v1.0
- ✓ Folder hierarchy (workspace + personal) — v1.0
- ✓ Tag management (org + user level) — v1.0
- ✓ URL-based filter state persistence — v1.0
- ✓ Analytics filter bar (time range, chart toggles) — v1.0
- ✓ Global search modal — v1.0

### Active

- [ ] All filters (Tags, Folders, Contacts/Participants, Duration, Source, Date range) are strictly scoped to current organization
- [ ] Search (global modal + inline syntax) is strictly scoped to current organization
- [ ] Participant/contact filter works by name AND email address (attendee, speaker, invitee)
- [ ] Multiple filters can be applied simultaneously (stacking)
- [ ] Individual filters can be removed without affecting others
- [ ] All sort columns (Title, Date, Duration, Participants, Source) work correctly
- [ ] All filter popovers consistently apply and clear state
- [ ] E2E tests cover all filter/sort scenarios and combinations

### Out of Scope

- Real-time collaboration features — future milestone
- Mobile native app — future milestone
- Cross-org admin view — not for this milestone (would break org scoping intentionally)

## Context

- **Stack:** React 18 + TypeScript + Vite + Supabase + Zustand + TanStack Query
- **Filter state:** URL params via `filtersToURLParams()` / `urlParamsToFilters()` in `filter-utils.ts`
- **Filter components:** `FilterBar.tsx` aggregates TagFilterPopover, FolderFilterPopover, ContactsFilterPopover, DurationFilterPopover, SourceFilterPopover
- **Sorting:** `useTableSort` hook in `TranscriptTable.tsx`
- **Search syntax parser:** `parseSearchSyntax()` in `filter-utils.ts`
- **Org context:** `useOrgContext` hook — org_id must be passed to all queries
- **Known data isolation bug:** queries in filter popovers likely missing org_id scoping on Supabase calls
- **E2E tests exist** at `e2e/` using Playwright (port 3001)

## Constraints

- **Tech stack:** React + TypeScript — no framework changes
- **Backend:** Supabase only — no alternative DB
- **Org isolation:** All queries MUST include org_id filter — this is a hard security requirement
- **Test coverage:** Every fix must have a corresponding Playwright test

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Fix in-place vs rebuild filter system | Rebuild would take too long; fix existing architecture | — Pending |
| URL param persistence kept | Working feature, just needs org scoping | — Pending |

---
*Last updated: 2026-03-15 — GSD initialized, milestone v1.1 started*
