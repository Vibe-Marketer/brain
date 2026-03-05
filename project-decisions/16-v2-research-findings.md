# v2 Research Findings

Synthesized from 5 research documents (STACK, FEATURES, ARCHITECTURE, PITFALLS, SUMMARY) dated 2026-02-22.

---

## Stack Decisions (All Locked)

- [ ] Vite 7 (not Next.js) — 100% auth-gated SPA, SSR/ISR have zero value
- [ ] TanStack Router v1 — type-safe URL params essential for 4-pane layout
- [ ] TanStack Query v5 — `onSuccess`/`onError` removed from `useQuery` (key v4 breaking change)
- [ ] Zustand v5 — hard boundary with TanStack Query
- [ ] Motion v12 — spring physics (stiffness 200-300, damping 25-30)
- [ ] shadcn/ui with ResizablePanelGroup for 4-pane layout
- [ ] TailwindCSS v4 — CSS-first, `@theme {}` in globals.css, CSS variables need `hsl()` wrapping
- [ ] Architect for Tauri v3 now (abstract browser APIs), implement later

### Native-Feel Rules

- [ ] `user-select: none` on chrome
- [ ] `h-screen overflow-hidden` on shell
- [ ] `contain: layout` on scroll areas
- [ ] Never `transition-all`
- [ ] Always `@media (prefers-reduced-motion)`

---

## Feature Pattern Decisions

### Workspace Naming

- [ ] Research recommended "Workspace > Channel > Folder"
- [ ] Actual decision (locked in Phase 16): **Organization > Workspace > Folder**
- [ ] Organization = billing root / company silo
- [ ] Workspace = collaborative hub inside org
- [ ] Folder = content container

### Condition Builder UX

- [ ] Sentence-like, field-first
- [ ] Max 3-4 operators: contains, equals, starts with, doesn't contain
- [ ] First-match-wins
- [ ] Live preview count required
- [ ] Default destination required

### MCP Token UX

- [ ] Airtable-style: name required, show token once
- [ ] Scope selector: whole workspace or specific folders
- [ ] Read-only by default
- [ ] Copy-paste MCP config block included

### Connector Extensibility

- [ ] `CallVaultSourceAdapter` interface pattern
- [ ] New connector = 1 adapter + 1 edge function + 1 component + 1 registry line
- [ ] ~230 lines total target

---

## Architecture Decisions

### Data Migration Infrastructure (Pre-Deployed)

- [ ] `recordings` table existed before v2
- [ ] `migrate_fathom_call_to_recording()` existed
- [ ] `migrate_batch_fathom_calls()` existed
- [ ] `get_migration_progress()` existed
- [ ] `migrate-recordings` edge function existed

### Per-Workspace MCP Tokens

- [ ] Supabase OAuth 2.1 `client_id` in JWT
- [ ] RLS checks `(auth.jwt() ->> 'client_id')`
- [ ] Derives vault access from `workspace_mcp_tokens` table
- [ ] New table: `workspace_mcp_tokens` (client_id, vault_id, owner_user_id, label, last_used_at, revoked_at)

---

## Critical Pitfalls (9 Documented)

### Red (High Risk)

- [ ] **P1: Scope creep** — lock feature cut line Day 1, use Strangler Fig model
- [ ] **P2: Missing redirect URL** — add new domain to Supabase allowlist BEFORE any user touches new frontend; do NOT update SITE_URL until cutover
- [ ] **P3: RLS gap during migration** — explicitly add `ALTER TABLE recordings ENABLE ROW LEVEL SECURITY` + policies; test with real JWT not service_role
- [ ] **P4: No dry-run** — 18 months of real data; profile queries first, dry-run as SELECT INTO TEMP TABLE
- [ ] **P5: OAuth scopes don't enforce DB access** — RLS must check `client_id` from `auth.jwt()`, never trust `workspace_id` from request body

### Yellow (Medium Risk)

- [ ] **P6: Rename without URL redirects** — add 301 redirects BEFORE rename ships, audit all surfaces
- [ ] **P7: No rule priority from day 1** — `rules.priority` column must be in first migration
- [ ] **P8: No rule preview mode** — "X of last 20 calls match" is required, not optional
- [ ] **P9: Stale MCP tokens** — RLS must join against CURRENT membership at query time

---

## Pitfall Resolution Status

- [ ] P1 (scope creep): Addressed via GSD workflow with strict phase boundaries
- [ ] P2 (redirect URL): Handled in Phase 14 Plan 02
- [ ] P3 (RLS gap): Verified in Phase 15 Plan 01
- [ ] P4 (no dry-run): Profiling queries run in Phase 15 Plan 01
- [ ] P5 (OAuth scopes): Designed into Phase 19 Plan 04
- [ ] P6 (URL redirects): Shipped in Phase 16 Plan 01
- [ ] P7 (rule priority): Built into Phase 18 Plan 01 first migration
- [ ] P8 (rule preview): Built into Phase 18 Plan 03
- [ ] P9 (stale tokens): Designed into Phase 19 Plan 04 via live membership check
