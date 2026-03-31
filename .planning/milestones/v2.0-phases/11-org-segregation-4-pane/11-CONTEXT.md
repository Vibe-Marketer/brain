# Phase 11: Org Segregation + 4-Pane Foundation - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Lock all data queries to the current org_id and enforce the 4-pane layout hierarchy consistently across all major pages. This is the foundation phase — every subsequent phase (12-18) depends on org scoping being correct and layout rules being established.

</domain>

<decisions>
## Implementation Decisions

### Import page Pane 2 layout
- **D-01:** Import sources appear in Pane 2 as an icon + label list — vertical nav style with each source showing its icon, name, and connection status indicator (green dot = connected, empty circle = not connected)
- **D-02:** Pane 2 must match the existing brand styling from Settings and other pages — same component patterns, spacing, typography. Not a unique design.
- **D-03:** Below the source list, include "Routing Rules" and "Import History" as additional nav items separated by a divider
- **D-04:** The Calls page folder sidebar (Pane 2) also needs visual cleanup to match the same consistent Pane 2 pattern — captured as deferred item for a later cleanup pass

### Import page Pane 3 empty state
- **D-05:** When no source is selected, Pane 3 shows an overview dashboard: summary cards per source (connected status, call count or "Setup needed"), recent import activity, and any failed imports needing attention
- **D-06:** Include a visual hint/prompt encouraging the user to click a source in Pane 2 to manage or import from it

### Modal vs Pane 4 rules
- **D-07:** Call detail opens as a modal overlay (existing CallDetailDialogue component) — this is how it works now, keep it
- **D-08:** Pane 4 is for simple, quick config/info: workspace settings, folder details/rename, tag management, member role/info, import source config, quick call preview (title + summary)
- **D-09:** Modals are for complex, deep content: full call detail + transcript, onboarding wizard, first-time source setup, bulk import selection, advanced org settings
- **D-10:** The dividing line: if it has scrollable content with multiple sections or requires focused attention, it's a modal. If it's a quick glance or single-action config, it's Pane 4.

### Org switch experience
- **D-11:** Switching orgs triggers a brief fade transition (200-300ms) on the content area, then redirects to the Calls page of the new org. Always a clean start.
- **D-12:** Full state reset on org switch — clear all filters, search queries, folder selection, sort order, active workspace, and close Pane 4. User starts completely fresh in the new org.
- **D-13:** The org switcher UI itself (in header) is already implemented and functional — no changes needed to the switcher component itself

### Claude's Discretion
- Org scoping enforcement strategy (explicit org_id vs RLS reliance vs both)
- Service layer refactoring approach for adding org_id to queries
- Migration scripts for any schema changes needed
- Import overview dashboard card layout and exact content
- Fade transition implementation details
- Which existing pages need 4-pane adjustments and the specific fixes

</decisions>

<specifics>
## Specific Ideas

- Pane 2 across the app should be visually consistent — Import, Calls, Settings should all feel like the same component with different content
- Connection status should be "easy to see and tell at a glance" — not hidden or subtle
- Import overview dashboard should surface actionable info (failed imports, setup needed) not just stats

</specifics>

<canonical_refs>
## Canonical References

### Design system
- `docs/design/brand-guidelines-v4.4.md` — Authoritative design system for colors, typography, components
- `docs/design/design-principles-callvault.md` — Visual development checklist and product ethos

### Architecture
- `docs/adr/README.md` — Architecture Decision Records index
- `docs/architecture/api-naming-conventions.md` — Function, hook, and type naming standards

### Frontend implementation
- `src/CLAUDE.md` — Design system, visual standards, tech stack, hard constraints

### Backend
- `supabase/CLAUDE.md` — Edge Functions, database schema, RLS policies

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/hooks/useOrgContext.ts` — Core org context hook with switchOrg() that already resets workspace/folder
- `src/stores/orgContextStore.ts` — Zustand v5 store with localStorage persistence and cross-tab sync
- `src/components/header/OrganizationSwitcher.tsx` — Org switcher dropdown, fully functional
- `src/components/layout/AppShell.tsx` — 4-pane layout with secondaryPane prop and detail pane outlet
- `src/components/calls/CallDetailDialogue.tsx` (or similar) — Existing call detail modal overlay

### Established Patterns
- Service + Hook separation: `src/services/*.service.ts` for data access, `src/hooks/use*.ts` for React consumption via TanStack Query
- Org-scoped queries: Some services already use `.eq('organization_id', orgId)`, others rely on RLS
- AppShell accepts `secondaryPane` (JSX for Pane 2) and `showDetailPane` (boolean for Pane 4)

### Integration Points
- `src/pages/ImportPage.tsx` — Needs Pane 2 conversion (currently single-pane with tabs)
- `src/pages/TranscriptsNew.tsx` — Reference implementation of full 4-pane pattern (FolderSidebar in Pane 2)
- `src/services/import-sources.service.ts` — Queries missing org_id filtering (line 51, 348)
- `src/services/recordings.service.ts` — Has org_id scoping via `getAvailableSources()`
- `src/components/settings/IntegrationsTab.tsx` — Connected accounts stored at user level in `user_settings` table (shared across orgs per ORG-05)

### Pages Needing 4-Pane Audit
- `ImportPage.tsx` — No Pane 2, no Pane 4 (needs full conversion)
- `Analytics.tsx` — 3-pane only (no detail outlet)
- `CallDetailPage.tsx` — Standalone page (should route to modal instead)

</code_context>

<deferred>
## Deferred Ideas

- Calls page folder sidebar visual cleanup to match consistent Pane 2 pattern (mentioned by user — separate cleanup task, not Phase 11 scope)
- Per-org state memory (remember filters/folder/sort per org and restore on switch) — future enhancement if users want it

</deferred>

---

*Phase: 11-org-segregation-4-pane*
*Context gathered: 2026-03-30*
