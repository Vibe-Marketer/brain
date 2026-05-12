# Milestones

## v2.2 Security Hardening & UI Polish (Shipped: 2026-05-12)

**Phases completed:** 13 phases, 63 plans, 3 tasks

**Key accomplishments:**

- 1. [Rule 3 - Blocker] `.env` vs `.env.local` path mismatch
- 1. [Rule 3 — Blocker] dev-browser server not running at sweep start
- 1. [Rule 3 — Approach] No UI sign-out; used context.clearCookies() instead
- Confirmed SHARE-02 still broken via verbatim wrong-account error capture on production — Edge Function returns identical 404 + `CALL_NOT_FOUND` for "doesn't exist" and "wrong account", which means the Phase 32 frontend fix is blocked behind a backend response-shape change.
- 1. [Rule 2 - Missing critical functionality] AUTH-01 description update
- Status:
- NO-REPRO.
- Status:
- Status:
- Status:
- Status:
- Status:
- Created:
- package.json:
- Modified:
- Modified:
- vercel.json
- Status:
- Status:
- Status:
- Status:
- Status:
- Phase:

---

## v2.1 MCP Production Infrastructure (Shipped: 2026-05-08)

**Phases completed:** 9 phases, 16 plans, 6 tasks

**Key accomplishments:**

- One-liner:
- Service (`src/services/mcp-tokens.service.ts`):
- Code-level:
- Title:
- Title:
- Title:
- Title:
- Service
- User-paste flow for permanently saving Fathom share-link transcripts as searchable recordings, with org-scoped dedup, structured segment parsing, and recording-detail rendering — zero server-side fathom.video fetches.
- 1. `src/types/supabase.ts` had appended Supabase CLI banner text breaking TS parser
- 1. `RiDraggable2Line` does not exist in the installed @remixicon/react v4.7

---

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
