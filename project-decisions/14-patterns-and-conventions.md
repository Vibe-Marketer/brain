# Established Patterns & Conventions

Patterns confirmed across multiple phases and locked as official project conventions.

---

## Data Access Pattern (Service + Hook)

- [ ] `src/services/*.service.ts` — pure async functions (database queries, no React, testable, reusable)
- [ ] `src/hooks/use*.ts` — React hooks wrapping services with TanStack Query (caching, loading states, optimistic updates)
- [ ] Service = "how to get/mutate data"
- [ ] Hook = "how React consumes that data"
- [ ] This is the locked-in pattern for all data access in v2

---

## State Management Boundary

- [ ] **Zustand v5** = UI state only (sidebar collapsed, active tab, slide-over open)
- [ ] **TanStack Query v5** = server state only (recordings, workspaces, tokens)
- [ ] Never mixed — FOUND-06 hard boundary
- [ ] Zustand v5 double-invocation: `create<T>()(` not `create<T>(`

---

## TypeScript Conventions

- [ ] Type aliases for concept rename: Organization=Bank, Workspace=Vault, Folder=folders row
- [ ] DB queries still use real table names: `supabase.from('banks')`, `supabase.from('vaults')`
- [ ] `Pick<Row, ...>` for list queries to avoid fetching heavy columns (e.g., full_transcript)
- [ ] Radix UI uses flat imports: `import { Dialog } from 'radix-ui'` (Slot exposed as `Slot.Root`)

---

## Animation System

- [ ] Spring physics via motion/react (import from `"motion/react"`, NOT `framer-motion`)
- [ ] Standard spring: `{ type: 'spring', stiffness: 260, damping: 28 }`
- [ ] `initial={false}` on all Motion elements to suppress entry animation on page load
- [ ] Width-only animation for same-plane push (no x offset — x:20 caused "drawer feel" bug)
- [ ] Never use CSS `transition-all`; always use `@media (prefers-reduced-motion)`

---

## Visual System

### Nav Active State (4-Layer)

- [ ] `bg-vibe-orange/10` tint
- [ ] Fill icon in `text-vibe-orange`
- [ ] `font-semibold`
- [ ] Absolute left pill: `w-1 h-[65%] rounded-r-full bg-vibe-orange`

### Page Titles

- [ ] All in-app page h1s use `text-vibe-orange` (wayfinding indicator)
- [ ] Login h1 "CallVault" stays `text-foreground` (brand logo wordmark, not wayfinding)
- [ ] Heading base: Montserrat at font-weight 700; components add `font-extrabold` (800)

### Component Patterns

- [ ] Button: `cva` + `cn()`, 6 variants, 4 sizes, `asChild` via `Slot.Root`
- [ ] Tabs: Radix Tabs with 6px vibe-orange pill underline via `data-[state=active]:after:*`
- [ ] Icons: Remix Icons only (`@remixicon/react`) — no Lucide, FontAwesome, or others

### Tokens

- [ ] shadcn/Tailwind standard: `text-foreground`, `text-muted-foreground`, `bg-card`, `bg-muted`, `border-border`
- [ ] NO custom token systems (`text-ink`, `text-ink-muted` are v1 artifacts)
- [ ] `border-soft` is dead/removed

---

## Database Patterns

- [ ] Archive: `RENAME table TO table_archive` + COMMENT with hold period and drop phase
- [ ] Compatibility VIEW: `CREATE VIEW old_name AS SELECT * FROM new_name` — drop both in cleanup
- [ ] RLS test: `BEGIN; SET LOCAL ROLE authenticated; SET LOCAL 'request.jwt.claims' = ...; query; ROLLBACK;`
- [ ] psql connection: `PGHOST=aws-1-us-east-1.pooler.supabase.com PGUSER=postgres.vltmrnjsubfzrgrtdqey psql`
- [ ] Fail-open: routing/pipeline errors log and continue, never block imports

---

## Connector Pipeline Pattern

- [ ] 5-stage: credentials -> fetch -> dedup -> transform -> insert
- [ ] New connector = 1 adapter file + 1 edge function + 1 connector component + 1 registry line (~148-230 lines)
- [ ] Dedup by: `owner_user_id + source_app + source_metadata->>'external_id'`
- [ ] Fail-open on dedup error
- [ ] Vault entry creation is non-blocking

---

## Development Patterns

- [ ] Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`
- [ ] Scope with phase number: `feat(17-04):`, `fix(16):`
- [ ] Node.js via Homebrew (not nvm)
- [ ] brain repo: npm, callvault repo: pnpm
- [ ] Dev-browser auth: inject Supabase token from production localStorage to localhost
- [ ] Supabase CLI: `/opt/homebrew/bin/supabase` directly (not npx)
- [ ] Worker deployment: `unset CLOUDFLARE_API_TOKEN && wrangler deploy`

---

## AppShell Layout Rules

- [ ] 4-pane layout, all panes on same z-index plane
- [ ] Pane 4 slides in, Pane 3 shrinks to make room — NO drawer overlays
- [ ] Sidebar: 220/72px (expanded/collapsed)
- [ ] Secondary: 280px
- [ ] Main: flex-1
- [ ] Detail: 360/320px
- [ ] OrgSwitcherBar spans full AppShell width above all panes
- [ ] Mobile: route-based stack navigation (not overlay/drawer)
- [ ] DnD on desktop only; action menu on mobile
