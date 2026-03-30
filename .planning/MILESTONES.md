# Milestones

## v1.0 — Foundation (pre-GSD)

**Status:** Shipped
**Phases:** 1–0 (pre-GSD — codebase existed before planning was initialized)

### What shipped

- Transcript library UI with table view (TranscriptTable)
- Filter bar with popovers: Tags, Folders, Contacts, Duration, Source, Date range
- Column sorting: Title, Date, Duration, Participants, Source
- Search bar with inline syntax parsing (participant:, date:, tag:, folder:, source:, duration:, status:)
- Global search modal (Zustand store)
- URL-based filter persistence
- Folder hierarchy (workspace + personal)
- Tag management (org-level + user-level)
- Analytics filter bar (time range + chart toggles)
- Multi-org / multi-workspace support (Supabase backend)
- Playwright E2E test infrastructure

### Known issues carried forward

- Filters not scoped to current organization (show data across orgs)
- Search not scoped to current organization
- Participant/contact filter broken — cannot filter by name or email
- Filters do not stack (combining multiple filters fails)
- Individual filter removal broken (removing one resets all)
- Sort columns partially functional
- Filter popovers inconsistently apply / clear

## v1.1 — Sort/Filter Hardening (ABSORBED)

**Status:** Absorbed into v2.0
**Phases:** 1-10 defined, 0% executed

Defined 2026-03-15 with 6 core phases + 4 stub phases. Never started. All filter/sort requirements carried forward as FILTER-01 through FILTER-06 in v2.0. Stub phases (Drag-to-Folder, YouTube Workspace UI, Global Search/Notifications, Raw Call Details) absorbed into v2.0 scope as needed.

---
*Last updated: 2026-03-30 — v1.1 absorbed into v2.0 Launch Readiness*
