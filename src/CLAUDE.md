# CALLVAULT FRONTEND - CLAUDE INSTRUCTIONS

**Last Updated:** 2026-03-09
**Status:** Authoritative frontend reference — single-repo (`brain/`)

---

## WHERE TO FIND WHAT

| What | Where |
|------|-------|
| Full design system (colors, layout, buttons, icons, animations) | `callvault-design-system` skill (loads on demand) |
| Hard constraints (icons, AI-02, vibe orange) | Root `CLAUDE.md` |
| Brand guidelines canonical spec | `docs/design/brand-guidelines-v4.4.md` |

**Do not duplicate rules from those files here.** This file covers only what isn't documented elsewhere.

---

## TECH STACK (actual, verified)

| Layer | Technology | Version |
|-------|-----------|---------|
| Build | Vite | 5.x |
| UI | React | 18.x |
| Routing | react-router-dom | 6.x (`BrowserRouter`, `src/pages/` directory) |
| Styling | Tailwind CSS | 3.x (JS config: `tailwind.config.ts`) |
| State (server) | TanStack Query | latest |
| State (client) | Zustand v5 | `create<T>()((set) => ({` double-invocation |
| Icons | Remix Icons | `@remixicon/react` — ONLY icon library allowed |
| Animation | motion | `import { motion } from 'motion/react'` (NOT framer-motion) |
| Radix UI | Individual packages | `@radix-ui/react-dialog`, `@radix-ui/react-popover`, etc. |
| Toasts | Sonner | `import { toast } from 'sonner'` |
| Dates | date-fns | — |
| Forms/validation | Zod | — |
| Error monitoring | Sentry | `@sentry/react` |

**Anti-patterns — never do these:**
- Do NOT use `framer-motion` — use `motion/react`
- Do NOT use Lucide, FontAwesome, or any icon library other than Remix Icons
- Do NOT use TanStack Router or file-based routing — this project uses react-router-dom v6
- Do NOT use `pnpm` or `bun` — this project uses `npm`
- Do NOT reference or import from `/Users/Naegele/dev/callvault/` — that repo is abandoned

---

## FILE ORGANIZATION

```text
src/
  pages/                   # Route-level page components
  components/
    {domain}/              # Domain-specific (workspace/, import/, etc.)
    layout/                # AppShell, SidebarNav, OrgSwitcherBar, etc.
    panels/                # Detail panel components
    panes/                 # Secondary pane components
    dialogs/               # Radix Dialog wrappers
    ui/                    # Shared UI primitives (shadcn/ui)
  services/                # Pure async functions — *.service.ts naming
  hooks/                   # React hooks wrapping services with TanStack Query
  stores/                  # Zustand v5 stores — create<T>()( double-invocation
  lib/                     # Utility functions
  types/                   # TypeScript type definitions
  integrations/            # Supabase client, external service configs
```

### Naming Conventions

| Pattern | Convention | Example |
|---------|------------|---------|
| Components | PascalCase | `FolderDetailPanel.tsx` |
| Hooks | camelCase with `use` prefix | `useFolders.ts` |
| Services | kebab-case with `.service.ts` | `folders.service.ts` |
| Stores | camelCase with `Store` suffix | `panelStore.ts` |
| Types | PascalCase | `Folder`, `PanelType` |

### Import Patterns

- Always use `@/` path aliases, never relative paths
- Radix UI: `import { Dialog } from '@radix-ui/react-dialog'` (individual packages)
- Motion: `import { motion } from 'motion/react'` (NOT `framer-motion`)
- Order: React → external libs → components → hooks → stores → utils → types

---

## TOKEN SYSTEM

Uses **shadcn/Tailwind semantic tokens** — no custom token systems.

| Use | Token | Light | Dark | NOT this |
|-----|-------|-------|------|----------|
| Primary text | `text-foreground` | `#171717` | `#FAFAFA` | ~~text-ink~~ |
| Secondary text | `text-muted-foreground` | `#666666` | `#999999` | ~~text-ink-soft~~ |
| Tertiary text / icons | `text-muted-foreground` | `#666666` | `#999999` | ~~text-cb-ink-muted~~ |
| Page background | `bg-viewport` | `#FCFCFC` | `#171717` | hardcoded hex |
| Pane background | `bg-card` | `#FFFFFF` | `#212121` | hardcoded hex |
| Hover states | `bg-muted` | `#F2F2F2` | `#292929` | ~~bg-hover~~ |
| Borders | `border-border` | `#E6E6E6` | `#3B3B3B` | ~~border-soft~~ |
| Active accent | `text-vibe-orange` / `bg-vibe-orange` | `#FF8800` | `#FF8800` | hardcoded hex |

The `text-ink`, `text-ink-muted`, `bg-hover`, `border-soft` tokens are from v1 brand guidelines and do NOT exist. Never use them.

---

## STATE MANAGEMENT

### TanStack Query
- Query keys via factory: `queryKeys.folders.list()` from `lib/query-config.ts`
- Always use optimistic updates for mutations that affect visible UI

### Zustand v5
- **Double-invocation syntax:** `create<T>()((set) => ({` — NOT `create<T>((set) => ({`
- Panel store types: `'call-detail' | 'folder-detail' | 'workspace-detail' | 'settings-help' | null`
- Sidebar/panel state: `usePreferencesStore` — persists across routes

---

## TYPOGRAPHY QUICK REFERENCE

| Context | Classes |
|---------|---------|
| Pane headings | `font-montserrat font-extrabold uppercase tracking-wide text-sm` |
| Section labels | `text-[10px] uppercase tracking-wide text-muted-foreground/60` |
| Body text | `text-sm` (Inter, default) |
| Metadata | `text-xs text-muted-foreground` |
| Numbers | Always add `tabular-nums` |

---

## BUTTON VARIANTS

| Context | Use |
|---------|-----|
| Primary CTA | `variant="default"` (slate gradient) |
| Secondary action | `variant="hollow"` (bordered) |
| Destructive | `variant="destructive"` (red gradient) |
| Icon-only | `variant="ghost"` (transparent) |
| Dialog submit | `bg-foreground text-background` or `bg-brand-500 text-white` |

Primary and destructive buttons NEVER change in dark mode. Only hollow/outline/ghost adapt.

---

## RESPONSIVE BREAKPOINTS

| Breakpoint | Width | Behavior |
|------------|-------|----------|
| Desktop | >1024px | All panes visible, sidebar expanded |
| Tablet | 768-1024px | Sidebar auto-collapsed |
| Mobile | <768px | Single-pane with overlays |

Use `useBreakpointFlags()` from `@/hooks/useBreakpoint` for responsive logic.

---

## COMMON PATTERNS

- **Loading states:** Use `<Skeleton>` from `@/components/ui/skeleton`
- **Toasts:** `import { toast } from 'sonner'` — `toast.success()`, `toast.error()`
- **Error boundaries:** Wrap pages with `react-error-boundary`
- **Empty states:** Centered icon in `bg-muted/60` container + text below

---

**END OF FRONTEND CLAUDE INSTRUCTIONS**
