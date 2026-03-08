---
phase: 14-foundation
plan: 01
subsystem: ui
tags: [vite, react, typescript, tanstack-router, tailwindcss, shadcn, motion, zustand, supabase, pnpm]

requires: []
provides:
  - New callvault repo at /Users/Naegele/dev/callvault/ (sibling of brain/)
  - Vite 7 + React 19 + TypeScript 5.9 dev server on port 3000
  - TanStack Router v1 with file-based routing (src/routes/)
  - TailwindCSS v4 CSS-first config with full CallVault color system
  - shadcn/ui initialized (New York style, Tailwind v4 CSS vars)
  - All 15+ dependencies installed (motion, Zustand v5, TanStack Query v5, Supabase JS v2)
  - src-tauri/.gitkeep Tauri placeholder
  - CLAUDE.md with all v2 constraints and architecture decisions
affects:
  - 14-02 (AppShell layout needs this routing + color system)
  - all future 14-foundation plans (build on this scaffold)
  - 15-migration (data layer depends on Supabase client pattern)
  - all v2 phases (repo is the foundation for everything)

tech-stack:
  added:
    - vite@7.3.1
    - react@19.2.4
    - typescript@5.9.3
    - "@tanstack/react-router@1.163.2"
    - "@tanstack/router-plugin@1.163.2"
    - tailwindcss@4.2.1
    - "@tailwindcss/vite@4.2.1"
    - motion@12.34.3
    - zustand@5.0.11
    - "@tanstack/react-query@5.90.21"
    - "@supabase/supabase-js@2.98.0"
    - "@remixicon/react@4.9.0"
    - sonner@2.0.7
    - next-themes@0.4.6
    - clsx@2.1.1
    - tailwind-merge@3.5.0
    - class-variance-authority@0.7.1
    - zod@4.3.6
    - react-error-boundary@6.1.1
    - date-fns@4.1.0
    - driver.js@1.4.0
    - tw-animate-css@1.4.0
  patterns:
    - TanStack Router file-based routing (src/routes/__root.tsx, src/routes/index.tsx)
    - TailwindCSS v4 CSS-first with @theme and @theme inline blocks
    - hsl() wrapped CSS variables (v4 requirement, not raw HSL numbers)
    - QueryClient with staleTime 5min + gcTime 10min + refetchOnWindowFocus false + retry 1
    - declare module '@tanstack/react-router' Register block in main.tsx
    - cn() utility from clsx + tailwind-merge

key-files:
  created:
    - /Users/Naegele/dev/callvault/package.json
    - /Users/Naegele/dev/callvault/vite.config.ts
    - /Users/Naegele/dev/callvault/tsconfig.json
    - /Users/Naegele/dev/callvault/tsconfig.app.json
    - /Users/Naegele/dev/callvault/components.json
    - /Users/Naegele/dev/callvault/src/globals.css
    - /Users/Naegele/dev/callvault/src/main.tsx
    - /Users/Naegele/dev/callvault/src/lib/utils.ts
    - /Users/Naegele/dev/callvault/src/routes/__root.tsx
    - /Users/Naegele/dev/callvault/src/routes/index.tsx
    - /Users/Naegele/dev/callvault/.env
    - /Users/Naegele/dev/callvault/.env.example
    - /Users/Naegele/dev/callvault/.gitignore
    - /Users/Naegele/dev/callvault/CLAUDE.md
    - /Users/Naegele/dev/callvault/src-tauri/.gitkeep
    - /Users/Naegele/dev/callvault/index.html
  modified: []

key-decisions:
  - "Scaffold with pnpm create vite react-swc-ts then layer in TanStack Router + shadcn/ui separately (not create-tsrouter-app)"
  - "shadcn init requires globals.css with @import tailwindcss AND path alias in root tsconfig.json before it can detect TailwindCSS v4"
  - "routeTree.gen.ts is gitignored — regenerated on dev start — avoid CI cold-start issues"
  - "shadcn/ui init uses --template vite --base-color neutral --yes for non-interactive mode"
  - "TanStack Router v1 confirmed working with Vite 7 + React 19 on pnpm"
  - "Zero AI/RAG/embedding code — AI-02 constraint verified by grep"
  - "Zero Google Meet references — FOUND-09 constraint verified by grep"

patterns-established:
  - "Pattern 1: TailwindCSS v4 CSS-first — @theme block for brand tokens, @theme inline block for utility class exposure, hsl() wrapped :root variables"
  - "Pattern 2: TanStack Router file-based — src/routes/__root.tsx for providers, src/routes/index.tsx for root route, routeTree.gen.ts auto-generated"
  - "Pattern 3: QueryClient defaults — staleTime 5min, gcTime 10min, refetchOnWindowFocus false, retry 1"
  - "Pattern 4: Router type registration — declare module '@tanstack/react-router' with Register interface"

duration: 6min
completed: 2026-02-27
---

# Phase 14 Plan 01: Scaffold Callvault Repo — Summary

**Vite 7 + React 19 + TanStack Router v1 repo scaffolded at /dev/callvault with full CallVault color system in TailwindCSS v4 CSS-first format, shadcn/ui initialized, and all 15+ dependencies installed**

## Performance

- **Duration:** 6 min
- **Started:** 2026-02-27T15:13:54Z
- **Completed:** 2026-02-27T15:20:13Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments

- New callvault repo created at `/Users/Naegele/dev/callvault/` as sibling of brain/ (NOT inside it)
- Vite 7.3.1 dev server starts cleanly on port 3000 with TanStack Router plugin generating routeTree.gen.ts
- Full v1 color system ported from brain/src/index.css with all variables converted to hsl() wrapped format (TailwindCSS v4 requirement)
- shadcn/ui initialized with New York style, neutral base, Tailwind v4 CSS variables, and correct @/ path alias
- Zero AI/RAG/embedding code — constraint AI-02 verified clean
- Zero Google Meet references — constraint FOUND-09 verified clean
- No tailwind.config.js — TailwindCSS v4 CSS-first confirmed

## Task Commits

Each task was committed atomically (in /dev/callvault repo):

1. **Task 1: Create callvault repo with full dependency stack** - `f82d5a6` (feat)
2. **Task 2: Port complete color system and configure CLAUDE.md** - `b61ba8d` (feat)

## Files Created/Modified

- `/Users/Naegele/dev/callvault/package.json` - Project manifest with all 15+ core dependencies
- `/Users/Naegele/dev/callvault/vite.config.ts` - Vite 7 with TanStackRouterVite plugin, @tailwindcss/vite, path alias @/ → src/
- `/Users/Naegele/dev/callvault/tsconfig.json` - Root config with path alias for shadcn/ui detection
- `/Users/Naegele/dev/callvault/tsconfig.app.json` - App config with paths: {"@/*": ["./src/*"]} and baseUrl: "."
- `/Users/Naegele/dev/callvault/components.json` - shadcn/ui config (New York, neutral, Tailwind v4 CSS vars, @/ alias)
- `/Users/Naegele/dev/callvault/src/globals.css` - Full color system: @import tailwindcss, @theme, @theme inline, :root, .dark, .light, utility classes
- `/Users/Naegele/dev/callvault/src/main.tsx` - StrictMode + QueryClientProvider + RouterProvider + Register block
- `/Users/Naegele/dev/callvault/src/lib/utils.ts` - cn() helper from clsx + tailwind-merge
- `/Users/Naegele/dev/callvault/src/routes/__root.tsx` - Root route with ThemeProvider + Outlet + Toaster
- `/Users/Naegele/dev/callvault/src/routes/index.tsx` - Placeholder index route
- `/Users/Naegele/dev/callvault/.env` - Supabase URL + publishable key (gitignored)
- `/Users/Naegele/dev/callvault/.env.example` - Placeholder template (committed)
- `/Users/Naegele/dev/callvault/.gitignore` - Includes .env, src/routeTree.gen.ts, .vercel
- `/Users/Naegele/dev/callvault/CLAUDE.md` - v2 development instructions with all constraints
- `/Users/Naegele/dev/callvault/src-tauri/.gitkeep` - Tauri directory placeholder
- `/Users/Naegele/dev/callvault/index.html` - Added Google Fonts: Inter (300-600) + Montserrat (700-800)

## Decisions Made

- **shadcn init requires setup order**: globals.css with `@import "tailwindcss"` must exist AND path alias must be in root tsconfig.json (not just tsconfig.app.json) before shadcn can detect TailwindCSS v4 during init
- **routeTree.gen.ts gitignored**: Auto-generated by TanStack Router plugin on dev start. Adding to .gitignore is correct — forces a `pnpm dev` before TypeScript can compile route types
- **shadcn init non-interactive mode**: `--template vite --base-color neutral --yes` works without prompts; shadcn updated globals.css with its oklch defaults which were then fully replaced with v1 hsl() color system
- **Minimum route structure needed**: TanStack Router plugin requires at least `src/routes/__root.tsx` to generate routeTree.gen.ts. Created `__root.tsx` + `index.tsx` as minimal placeholder routes
- **Color system conversion**: 198 hsl() occurrences in globals.css — complete port of all primary neutrals, vibe orange, button tokens, semantic status colors, Apple design system tokens, premium gradients, dark mode overrides

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shadcn init failed without pre-existing TailwindCSS config**
- **Found during:** Task 1 (shadcn/ui initialization step 5)
- **Issue:** `pnpm dlx shadcn@latest init` reported "No Tailwind CSS configuration found" and "No import alias found in tsconfig.json". Init failed with exit code 1.
- **Fix:** Created minimal `src/globals.css` with `@import "tailwindcss"` first. Added path alias to root `tsconfig.json` (not just tsconfig.app.json — shadcn reads root). Re-ran init successfully.
- **Files modified:** src/globals.css (created), tsconfig.json (updated)
- **Verification:** shadcn init completed successfully on second run, created components.json and src/lib/utils.ts
- **Committed in:** f82d5a6 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Blocking issue with shadcn init resolved inline. No scope creep. All plan requirements met.

## Issues Encountered

- shadcn/ui init requires TailwindCSS v4 globals.css AND root tsconfig.json path alias to be set up BEFORE it can detect the configuration. The plan's step ordering (tsconfig first, then shadcn init) was correct but the globals.css creation step needed to happen before the init. Resolved by creating the minimal globals.css first.

## User Setup Required

None — no external service configuration required for this plan. Supabase credentials already copied from brain/.env.

## Next Phase Readiness

- Callvault repo is scaffolded and ready for feature development
- Dev server starts at localhost:3000 with zero errors
- TanStack Router generates routeTree.gen.ts on dev start
- Full color system available via CSS variables and Tailwind utilities
- All constraints verified: no AI code, no Google Meet, no tailwind.config.js
- Ready for Plan 02 (AppShell layout implementation)

---
*Phase: 14-foundation*
*Completed: 2026-02-27*
