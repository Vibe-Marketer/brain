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

---
*Last updated: 2026-03-15 — GSD initialized*
