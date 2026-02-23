# Research Summary: CallVault v2.0

**Date:** 2026-02-22  
**Milestone:** v2.0 — The Pivot  
**Synthesized from:** STACK.md · FEATURES.md · ARCHITECTURE.md · PITFALLS.md  
**Overall Confidence:** HIGH — all 4 research dimensions cross-validated; primary claims from official docs

---

## Executive Summary

CallVault v2.0 is a deliberate, scoped frontend rebuild on top of a proven Supabase backend — not a full rewrite. The strategy strips ~89K lines of AI/chat/RAG code, starts a new Vite+React repo pointing at the same Supabase project, and ships four strategic upgrades: a clarity-first workspace model (Workspace → Channel → Folder), a non-technical-user-friendly import routing rules engine, per-workspace MCP tokens via Supabase OAuth 2.1, and the `fathom_calls → recordings` data migration that is already deployed and waiting. The single biggest risk isn't technical — it's the "clean slate fantasy" (Spolsky 2000): the new repo invites scope expansion that triples timelines and leaves users on a degrading product. The second-biggest risk is the data migration: production `fathom_calls` data is 18 months of real usage, and running migration scripts without dry-runs on production data shape leads to partial states and potential data leaks if RLS isn't explicitly verified. Both risks have clear prevention strategies. The recommended build order has working demos at every phase boundary, which is the primary defense against both.

The stack decision is unambiguous: Vite (not Next.js), TanStack Router v1 (type-safe SPA routing), TanStack Query v5, Zustand v5, Motion for React v12, TailwindCSS v4, and TypeScript everywhere — including Edge Functions. The connector architecture is the key reusability investment: a 5-stage pipeline in `_shared/connector-pipeline.ts` reduces adding a new source from 800–1000 lines and 2 weeks to ~230 lines and 1–2 days. Per-workspace MCP scoping is solved at the RLS layer using `client_id` in the Supabase OAuth 2.1 JWT — the Cloudflare Worker code barely changes; the database enforces isolation automatically.

---

## Stack Decisions

*From STACK.md — Confidence: HIGH*

| Decision | Verdict | Rationale |
|----------|---------|-----------|
| **Build tool** | **Vite 7** (not Next.js) | 100% auth-gated SPA. SSR/ISR/RSC have zero value. Next.js 15 adds async APIs, caching overhaul, hydration complexity in exchange for solving problems CallVault doesn't have. |
| **Routing** | **TanStack Router v1** (not React Router) | Type-safe URL params are essential for 4-pane layout with complex URL state. Route-level loaders pre-fill TanStack Query cache — eliminates navigation spinners. |
| **Server state** | **TanStack Query v5** | New repo = use current. Key breaking change from v4: `onSuccess`/`onError` on `useQuery` removed — use mutation's `mutate()` callback instead. |
| **UI state** | **Zustand v5** | Hard boundary rule: Zustand = UI state only (selection, panel sizes, collapsed state). TanStack Query = server state. Never mix. |
| **Animations** | **Motion for React v12** (formerly Framer Motion) | Layout animations + spring physics + AnimatePresence are what create native app feel. CSS transitions cannot replicate spring physics or exit animations. Import from `"motion/react"`. |
| **Components** | **shadcn/ui** (current) | `ResizablePanelGroup` (react-resizable-panels v4) is the 4-pane layout foundation. Add: `resizable scroll-area command sidebar tooltip sonner`. |
| **Styling** | **TailwindCSS v4** | CSS-first config (`@theme {}` in globals.css, no `tailwind.config.js`). Better custom theme system for dark design. |
| **Language** | **TypeScript everywhere** | Python = no. Zero use cases in this stack. Would split type-sharing story between frontend and Supabase-generated types. |
| **Desktop (future)** | **Architect for Tauri v3, skip in v2** | Vite is Tauri's recommended frontend — zero React changes needed if added later. Abstract browser APIs behind hooks (`useFileOpen`, `useClipboard`) now. |

**Animation philosophy:** Spring physics (`stiffness: 200–300, damping: 25–30`) + instant Zustand state response = native feel. NOT long CSS durations. UI responds to click immediately; spring animation plays as consequence of state change; network call completes in background. Never use `duration-500` as a blanket rule.

**Native-feel CSS rules:** `user-select: none` on chrome elements; `h-screen overflow-hidden` on shell; `contain: layout` on scroll areas; never `transition-all`; always `@media (prefers-reduced-motion)`.

---

## Feature Patterns

*From FEATURES.md — Confidence: HIGH*

### Workspace Hierarchy Naming

**Verdict: Workspace → Channel → Folder**

| Level | Name | Maps To | Examples |
|-------|------|---------|---------|
| L1 (Billing root) | **Workspace** | Organization / Company | "Acme Corp", "Coach Sarah" |
| L2 (Logical group) | **Channel** | Team / Program / Client | "Sales Team", "Coaching Program A", "Client X" |
| L3 (Content container) | **Folder** | Project / Stage / Topic | "Q1 Discovery Calls", "Onboarding", "Won Deals" |

Why: "Bank" = confusing (money connotations). "Vault" = secure storage, doesn't suggest grouping. "Hub" = overused. All three require in-app explanation before use — violates the 30-second clarity goal. "Workspace → Channel → Folder" is self-evident across all three target use cases (sales teams, coaches, agencies) with zero learning curve.

### Condition Builder UX

**Pattern: Sentence-like, field-first, progressive complexity, live preview**

```
WHEN a call is imported...
  [ Field ▼ ]  [ contains ▼ ]  [ value input ]
  AND [+ Add condition]

THEN route to...
  Channel: [ Select ▼ ]
  Folder:  [ Select ▼ ] (optional)

[Preview: "This rule would match 8 of your last 20 calls"]
```

- **Field-first selection** → operators derive from field type (text, number, date, select)
- **Max 3–4 operators in v2**: `contains`, `equals`, `starts with`, `doesn't contain` — completeness kills adoption
- **First-match-wins** rule priority, drag to reorder
- **Default destination** for unmatched calls (required — rules feel incomplete without it)
- **Live preview count** ("8 calls match") is non-negotiable — users fear misconfiguring rules

### MCP Token UX

**Pattern: Airtable-style — scope + resource, show once, named, last-used visible**

- Token name required (not "token 1, token 2")
- Show token ONCE with "I've copied it, close" confirmation — no second display
- Scope: entire workspace OR specific channels (channel-scoped = data isolation for coaches)
- Read-only by default; write access opt-in
- Last-used timestamp visible — identify stale tokens
- Copy-paste MCP config block alongside token (removes ALL guesswork for non-technical users)

### Connector Extensibility

**Goal: Adding a new source = ~230 lines, 1–2 days**

Source Adapter pattern with `CallVaultSourceAdapter` interface: id, displayName, authType, getAuthConfig, validateCredentials, listAvailableCalls, importCall, optional webhook parsing. New connector = 1 file + 1 line in `_registry.ts`. Appears automatically in UI and import routing rules.

**v2.0 priority order:** (1) Direct file upload (MP3/MP4/video, auto-transcribe via Whisper), (2) Grain, (3) Fireflies, (4) Generic webhook receiver.

### Must-Ship vs. Defer

| Must-Ship v2.0 | Defer to v3 |
|----------------|-------------|
| Workspace → Channel → Folder rename + migration | AI-suggested routing rules |
| Import routing rules (5–6 condition types, first-match, default destination) | Additional connectors (Grain, Fireflies) |
| MCP tokens per workspace (generate, scope, name, revoke, copy-once UX) | Rule conflict detection |
| Source adapter registry (internal, enables v3 connectors) | Full workflow automation engine |
| Rule preview ("X of last 30 calls match") | Zapier integration |
| MCP config copy-paste block in token UI | |
| Direct file upload (MP3/video with auto-transcription) | |

---

## Architecture Plan

*From ARCHITECTURE.md — Confidence: HIGH*

### Repo Structure

New clean Vite repo (`callvault-v2/`) pointing at existing Supabase project via env vars. No schema copy. Same anon key, same project ref.

Key structural rules:
- **Feature-sliced design**: `features/auth/`, `features/recordings/`, `features/import/`, `features/settings/` — each owns components, hooks, and types
- **Services layer**: `services/*.service.ts` is the ONLY place that imports from Supabase. No `supabase` import in components. This enforces the Tauri-swap path.
- **`src-tauri/` reserved** from day 1 (`.gitkeep`). Zero code impact, prevents future restructuring.

### Data Migration: fathom_calls → recordings

**Good news: migration infrastructure is already deployed.** `recordings` table, `migrate_fathom_call_to_recording()`, `migrate_batch_fathom_calls()`, `get_migration_progress()`, `migrate-recordings` edge function, `get_unified_recordings` RPC — all live.

**Migration sequence:**
1. `get_migration_progress()` — check current state
2. POST `/functions/v1/migrate-recordings` — batch migrate remaining rows (idempotent)
3. Verify: zero `fathom_calls` rows without a corresponding `recordings` entry
4. Switch v2 frontend to query `recordings` only
5. New imports write directly to `recordings` (update connector edge functions)
6. Archive `fathom_calls` (rename, NOT drop) — 30-day hold before removal

**Must NOT do:** Drop `fathom_calls` during v2.0. Archive it.

### Connector Pipeline Architecture

5-stage pipeline in `_shared/connector-pipeline.ts`: (1) Get credentials, (2) Fetch raw meetings, (3) Dedup check by `source_metadata->>'external_id'`, (4) Transform to recordings schema, (5) Insert recording + vault_entry.

A new connector is: `grain-client.ts` (~50 lines) + `grain-sync/index.ts` (~80 lines) + `GrainConnector.tsx` (~100 lines) + 1 line in `_registry.ts`. **Total: ~230 lines.**

Existing connectors (`zoom-sync-meetings`, `google-meet-sync-meetings`) need a one-time normalization to add `external_id` as a consistent key in `source_metadata`.

### Per-Workspace MCP Token Architecture

**Mechanism:** Supabase OAuth 2.1 `client_id` in JWT → RLS policies check `(auth.jwt() ->> 'client_id')` → RLS derives vault access from `workspace_mcp_tokens` table. MCP Worker code barely changes. DB enforces isolation automatically.

New table: `workspace_mcp_tokens` (client_id, vault_id, owner_user_id, label, last_used_at, revoked_at).  
New edge functions: `create-mcp-token` (~120 lines), `revoke-mcp-token`.  
New RLS policy on `vault_entries`: normal sessions see all their vaults; MCP sessions see only the scoped vault.

### Build Order (Critical Path)

```
Phase 1: Foundation (Days 1–2)
  → Vite scaffold, Supabase connected, auth working, AppShell layout
  ✓ Can log in, see empty shell

Phase 2: Read existing data (Days 3–4)
  → get_unified_recordings() RPC, RecordingsList, RecordingDetail
  → Run batch fathom_calls migration to completion
  ✓ Can see and browse all existing calls

Phase 3: Core import connectors (Week 2)
  → Build _shared/connector-pipeline.ts
  → Fathom v2, YouTube v2 (write to recordings directly)
  → Import hub UI (ConnectorRegistry)
  ✓ Can import new calls from primary sources

Phase 4: Chat + search (Week 3)
  → Simplify chat-stream-v2 to ~100-line bridge
  → Chat UI, search bar
  ✓ Full read-query-chat loop

Phase 5: Workspace/channel/folder management (Weeks 3–4)
  → Rename Bank→Workspace, Vault→Channel, Hub→Folder
  → URL redirect rules (old paths → new paths, 90-day 301s)
  → Workspace settings page
  ✓ Multi-workspace navigation with correct naming

Phase 6: Per-workspace MCP tokens (Weeks 4–5)
  → workspace_mcp_tokens migration
  → create-mcp-token edge function
  → MCP token UI (generate, scope, copy-once)
  → Test: scope token to vault, verify isolation
  ✓ Coaches can share workspace-scoped MCP URLs

Phase 7: Import routing rules (Week 5+)
  → Condition builder UI (field → operator → value)
  → Rule evaluation engine (first-match)
  → Rule preview (live count against last 20 calls)
  → Default destination
  ✓ Auto-routing on import

Phase 8: Additional connectors (Week 6+)
  → Zoom v2, Google Meet v2 (via pipeline)
  → First new connector (Grain or Fireflies)
```

**Critical path:** Auth (P1) → everything. Recordings visible (P2) → chat/search. Connector pipeline (P3) → all future connectors. Workspace UI (P5) → MCP tokens (P6).  
**Do not skip Phase 2 before Phase 3.** Batch migration must complete before v2 writes new imports to `recordings`.

---

## Critical Pitfalls

*From PITFALLS.md — Confidence: HIGH (verified against official Supabase docs + Fowler/Spolsky canonical sources)*

### 🔴 P1 — Scope Creep Behind the Clean Slate Fantasy
New repo = every developer becomes an architect. "While we're at it..." triples timelines. Prevention: lock the feature cut line Day 1. Strangler Fig model (old repo serves users until every page is replaced). Phase completion = working demo in staging, not lines written.

### 🔴 P2 — Missing New Domain in Supabase Redirect URL Allowlist
New domain must be explicitly added to Authentication → URL Configuration BEFORE any user touches the new frontend. Don't update `SITE_URL` until the cutover date — doing it early pushes existing sessions to the new (incomplete) frontend. During dual-operation, use the allowlist, not SITE_URL.

### 🔴 P3 — RLS Gap During Migration Window
Tables created via raw SQL migrations do NOT automatically have RLS. Must explicitly include `ALTER TABLE recordings ENABLE ROW LEVEL SECURITY` + policies in migration. Test with an authenticated user JWT (never service_role). Assert User A cannot SELECT User B's recordings before any frontend switch.

### 🔴 P4 — Migrating Without Dry-Run on Production Data Shape
Production `fathom_calls` is 18 months of real usage — NULL fields, encoding edge cases, orphaned rows. Run profiling queries first. Dry-run as `SELECT ... INTO TEMP TABLE` before the real `INSERT`. Verify row counts. Keep `fathom_calls` intact (archive, NOT drop) until verified by real users in production for 30 days.

### 🔴 P5 — OAuth Scopes Don't Enforce DB Access — RLS Does
Supabase OAuth scopes control what goes in the ID token — they do NOT restrict database access. RLS must explicitly check `client_id` from `auth.jwt()`. Never trust `workspace_id` from the request body — derive it from the JWT claim. Never test MCP auth with service_role key.

### 🔴 P6 — Rename Without URL Redirect Strategy
Users have bookmarked `/bank/abc123/vault/xyz`. When the rename ships, those 404. Add redirect rules BEFORE any user sees the rename. Keep old routes for 90 days with 301s. Also audit ALL non-UI surfaces: API error messages, email templates, in-app tooltips — a partial rename creates "Vault not found" errors in an app that says "Workspace."

### 🟡 P7 — No Rule Priority System from Day 1
Rule conflicts produce non-deterministic results without a priority model. Add `rules.priority` integer column in the first migration. Surface it in UI as a numbered list with drag-to-reorder. First-match-wins.

### 🟡 P8 — No Rule Preview Mode
Users create a rule, it routes 10 calls to the wrong workspace. They don't notice for 3 days. Ship a "Preview" mode that shows "This rule would match X of your last 20 calls" BEFORE saving. This is a required feature, not a nice-to-have.

### 🟡 P9 — Stale MCP Tokens After Workspace Membership Change
JWT tokens are stateless. RLS must join against CURRENT workspace membership at query time, not trust the `workspace_id` claim in the token (which reflects membership at token-issuance time, not now).

---

## Phase Structure Recommendation

Based on architecture build order + pitfall risk map:

| Phase | Name | Key Deliverable | Pitfalls to Address First |
|-------|------|----------------|--------------------------|
| **P1** | Foundation | Auth working, AppShell, scope lock | Set hard cutover date; add new domain to Supabase redirect allowlist; audit third-party OAuth app callbacks |
| **P2** | Data Visibility | All existing calls queryable in new UI | Batch migration must complete; RLS verified before any user switch |
| **P3** | Import Pipeline | Fathom + YouTube writing to `recordings` directly | Dry-run on prod data; connector pipeline as shared utility; disable triggers during migration |
| **P4** | Chat + Search | Full read-query-chat loop | Simplification only — not architecture change |
| **P5** | Workspace Redesign | Correct naming, URL redirects, settings | URL redirect rules before rename; additive DB migration (not in-place rename); SITE_URL timing |
| **P6** | MCP Tokens | Per-workspace scoped tokens, revocation | RLS audit before issuance; workspace_id in JWT not request body; current membership check |
| **P7** | Import Rules | Condition builder with preview, priority, default dest | Operator overload; priority schema from day 1; preview required |
| **P8** | Connector Expansion | Zoom v2, Google Meet v2, Grain | Dynamic registration security review |

**Phases needing deeper research before build:**
- **Phase 6 (MCP Tokens):** Supabase Custom Access Token Hook implementation — verify availability on current plan tier and test actual OAuth 2.1 flow before building the token management UI.
- **Phase 7 (Import Rules):** UX prototype must be tested with a non-technical user BEFORE engineering builds the system. Can they set up a rule in under 2 minutes? If not, redesign before building.

**Phases with standard patterns (safe to build directly):**
- Phase 1 (Vite scaffold)
- Phase 2 (TanStack Query + already-deployed RPC)
- Phase 3 (Connector pipeline — pattern is clear from existing code analysis)
- Phase 4 (Chat bridge — simplification, not new architecture)

---

## Open Questions

Unresolved questions that need answers before or during build:

1. **Supabase Custom Access Token Hook availability**: Architecture relies on injecting `workspace_id` into JWT via this hook. Verify it's available on the current plan tier. Fallback: lookup in `workspace_mcp_tokens` table at query time (already designed).

2. **Fathom_calls production data shape**: Run profiling queries before writing the migration script — NULL rates on key fields, row count by user, anomalies. This is a prerequisite for Phase 3, not a task within it.

3. **Old repo (brain/) hard cutover date**: Must be decided and communicated Day 1. Recommended: old repo goes maintenance-only the moment any user is migrated. No feature work in old repo after that.

4. **New frontend domain**: Required to configure Supabase redirect allowlist before Phase 1 first deploy.

5. **Third-party OAuth app audits (Fathom, Zoom, Google)**: Do any of these OAuth apps use your APP domain (not Supabase's `/auth/v1/callback`) as a callback URL? Audit required as Phase 1 deliverable.

6. **Import rules — retroactive application**: When a rule is saved, does it apply to previously imported calls? Recommendation: NO — future imports only, explicit in UI. This is a product decision that affects the data model.

7. **AI feature-flag removal timeline**: Phase 4 builds a bridge chat. Is this permanent or a compatibility layer? Affects whether `chat-stream-v2` gets simplified vs. removed on a schedule.

8. **`source_metadata` normalization**: Dedup pipeline requires `external_id` as consistent key in `source_metadata` across all connectors. What's the current shape in production Zoom/Google Meet/YouTube records? Needed before Phase 3.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|-----------|-------|
| Stack decisions | **HIGH** | All primary claims verified against official docs (Vite 7, Motion v12.34.3, TanStack Router v1, TanStack Query v5, Tauri v2, shadcn/ui resizable v4) |
| Feature patterns | **HIGH** | Workspace naming from Notion/Linear/Airtable official docs. Condition builder from HubSpot official docs. MCP token UX from Airtable PAT docs. |
| Architecture | **HIGH** | Migration infrastructure confirmed from existing codebase. Supabase OAuth 2.1 RLS pattern from official docs. Connector pipeline from existing code analysis. |
| Pitfalls | **HIGH** | Auth pitfalls from Supabase official docs. Big rewrite pattern from Spolsky/Fowler canonical sources. Data migration risks from Supabase import docs. |
| Build order timing | **MEDIUM** | Phase duration estimates are directional. Phase 6 (Custom Access Token Hook) may expand if plan tier issues arise. |
| TailwindCSS v4 specifics | **MEDIUM** | `@theme {}` API confirmed. Full migration from v3 configuration not deeply stress-tested. |

**Overall: HIGH confidence on what to build and how. MEDIUM confidence on exact timing.**

---

## Sources (Aggregated)

| Source | Confidence | Used In |
|--------|-----------|---------|
| Next.js 15 release notes | HIGH | Stack — Vite vs Next.js verdict |
| Vite 7 official docs | HIGH | Stack — build tool verdict |
| Motion for React v12.34.3 docs | HIGH | Stack — animation library |
| TanStack Query v5 docs | HIGH | Stack — server state |
| TanStack Router v1 docs | HIGH | Stack — routing |
| Tauri v2 docs (Jan 2026) | HIGH | Stack — desktop future-proofing |
| shadcn/ui Resizable v4 docs | HIGH | Stack — 4-pane layout |
| Notion workspace/teamspaces docs | HIGH | Features — naming |
| Linear teams docs | HIGH | Features — naming |
| Airtable PAT docs (Nov 2025) | HIGH | Features — token UX |
| HubSpot workflow/filter docs | HIGH | Features — condition builder |
| Supabase OAuth 2.1 / MCP auth docs | HIGH | Architecture + Pitfalls — token scoping |
| Supabase Token Security + RLS docs | HIGH | Architecture + Pitfalls — scoping, RLS gap |
| Supabase Redirect URLs docs | HIGH | Pitfalls — OAuth redirect |
| Supabase Import Data docs | HIGH | Pitfalls — trigger overhead during migration |
| Existing codebase: migrations 20260131000007, 20260131000008 | HIGH | Architecture — migration status confirmed |
| Existing codebase: zoom-sync-meetings, google-meet-sync-meetings | HIGH | Architecture — connector pipeline derived |
| Joel Spolsky — Things You Should Never Do (2000) | HIGH | Pitfalls — big rewrite failure pattern |
| Martin Fowler — Strangler Fig | HIGH | Pitfalls — gradual migration model |
