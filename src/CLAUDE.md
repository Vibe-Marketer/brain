# CALLVAULT FRONTEND - CLAUDE INSTRUCTIONS

**Last Updated:** 2026-03-01
**Status:** Slim reference — design details live in the `callvault-design-system` skill
**Note:** After migration, move to `callvault/src/CLAUDE.md`

---

## WHERE TO FIND WHAT

| What | Where |
|------|-------|
| Full design system (colors, layout, buttons, icons, animations) | `callvault-design-system` skill (loads on demand) |
| Hard constraints (icons, AI-02, vibe orange) | Root `CLAUDE.md` |
| Tech stack, anti-patterns, project structure | `callvault/CLAUDE.md` |
| Brand guidelines canonical spec | `docs/design/brand-guidelines-v4.3.md` |

**Do not duplicate rules from those files here.** This file covers only what isn't documented elsewhere.

---

## FILE ORGANIZATION

```text
src/
  routes/                  # TanStack Router file-based routes
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
- Radix UI: `import { Dialog } from 'radix-ui'` (flat package, NOT `@radix-ui/react-*`)
- Motion: `import { motion } from 'motion/react'` (NOT `framer-motion`)
- Order: React → external libs → components → hooks → stores → utils → types

---

## TOKEN SYSTEM (v2)

v2 uses **shadcn/Tailwind semantic tokens** — no custom token systems.

| Use | Token | NOT this |
|-----|-------|----------|
| Primary text | `text-foreground` | ~~text-ink~~ |
| Secondary text | `text-muted-foreground` | ~~text-ink-soft~~ |
| Tertiary text / icons | `text-muted-foreground` | ~~text-cb-ink-muted~~ |
| Page background | `bg-viewport` | hardcoded hex |
| Pane background | `bg-card` | hardcoded hex |
| Hover states | `bg-muted` | ~~bg-hover~~ |
| Borders | `border-border` | ~~border-soft~~ |
| Active accent | `text-vibe-orange`, `bg-vibe-orange` | hardcoded #FF8800 |

The `text-ink`, `text-ink-muted`, `bg-hover`, `border-soft` tokens are from v1 brand guidelines and do NOT exist in v2. Never use them.

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
