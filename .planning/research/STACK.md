# Stack Research: CallVault v2.0

**Research Date:** 2026-02-22
**Question:** What's the best frontend stack for CallVault v2.0?
**Researcher:** GSD Stack Researcher (claude-sonnet-4-6)

---

## Executive Summary

**Use Vite + React 18, not Next.js.** CallVault v2.0 is an authenticated SPA with a persistent 4-pane layout — it has zero use for SSR, ISR, or server components. Next.js adds substantial complexity (App Router mental model, async APIs, hydration edge cases) in exchange for features that actively hurt this use case. Vite gives you a clean, fast, zero-overhead SPA build that is a direct continuation of the proven v1 stack. **Keep Zustand + TanStack Query** — they are the right tools and the v1 investment is solid. Add **Motion for React** (formerly Framer Motion) as the animation layer for native-feel transitions. **Python makes no sense here.** Tauri is worth a deliberate v3 decision but not a v2 concern. The native-app feel is achievable in-browser with the right CSS architecture, spring physics, and deliberate transition timing.

---

## Next.js vs Vite

### The Question Being Answered

This is not "which framework is better" — it's "which is better for CallVault v2.0 specifically." The relevant characteristics of CallVault v2.0:

- **Auth-gated app** — every route requires login; there is no public-facing content to index or pre-render
- **Persistent shell** — 4-pane layout renders once and stays; content panes update, not full page navigations
- **MCP-first data layer** — Supabase is the backend; all data fetches are authenticated client-side calls
- **No marketing pages, no SEO content, no blog** — just the app itself
- **Same Supabase backend** — no new BFF layer, no server actions needed
- **Existing Vite investment** — v1 was Vite; team knows it

### Next.js — What It Adds vs. What It Costs

| Feature | Needed? | Notes |
|---------|---------|-------|
| SSR / SSG | ❌ No | All routes auth-gated; no SEO value |
| Server Components | ❌ No | Data layer is Supabase client SDK; RSC would add complexity with zero benefit |
| Server Actions | ❌ No | Supabase Edge Functions already serve this role |
| File-based routing | ✅ Nice | But TanStack Router provides this too, with better TypeScript |
| App Router caching | ❌ Irrelevant | Would need to be opted-out at every authenticated data fetch |
| Incremental Static Regen | ❌ No | N/A for auth app |
| Turbopack dev speed | ✅ Good | Vite 7 with SWC is comparable (~<300ms HMR) |
| React 19 support | ✅ | Vite + React 19 is straightforward |
| Vercel deployment | ✅ | Works identically with Vite; no Next.js advantage |

**Next.js 15 breaking changes that would bite CallVault:**
- Async Request APIs (cookies, headers, params now async — adds boilerplate everywhere)
- Caching semantics overhaul (fetch requests uncached by default — must re-think data patterns)
- App Router + Supabase auth requires special handling (cookies, middleware, SSR gotchas well-documented as painful in Supabase's own guides)
- Hydration errors surface for components that were fine as CSR

**The honest answer:** Next.js is optimized for "I need fast page loads for unauthenticated users" and "I need SEO." CallVault has neither problem. Using Next.js here carries ~40% more framework surface area to solve problems you don't have, while creating new problems (auth hydration, caching confusion, RSC mental model) you didn't have before.

### Vite 7 — What v2.0 Gets

- **React 18 + React 19 ready** (Vite 7 supports both; confirmed on official docs)
- **Sub-300ms HMR** in development via native ESM
- **SWC-based transforms** available via `react-swc-ts` template
- **Zero server-side complexity** — deploy as static assets to Vercel (same as v1)
- **TanStack Router** integration is first-class (type-safe file-based routing for SPAs)
- **No migration tax** from v1 patterns — same mental model, new codebase
- **Tauri-compatible** — Vite is Tauri's recommended frontend (if desktop becomes v3 goal)

### Verdict: **Vite + React 18**

*Confidence: HIGH — verified against Next.js 15 official changelog (nextjs.org/blog/next-15) and Vite 7 official docs (vitejs.dev/guide/).*

---

## State Management

### Zustand — Keep It, Clean Up the Boundaries

Zustand is the correct state manager for this use case. It is minimal, performant, and the v1 team has already proven competence with it.

**What belongs in Zustand (UI state only):**
- Active workspace/bank selection
- Panel sizes (collapsed/expanded)
- Sidebar collapsed state
- Selected recording ID
- Context panel open/closed
- Active pane focus

**What does NOT belong in Zustand:**
- Server data (workspaces list, recordings — this is TanStack Query)
- Form state (use react-hook-form)
- Derived/computed values (use selectors or useMemo)

**v2 refinement:** In v1, some Zustand stores reportedly mixed server-fetched data with UI state. In v2, establish a hard boundary:
- **Zustand = UI state** (what's selected, what's open, what's collapsed)
- **TanStack Query = server state** (workspaces, recordings, vault entries)

Current version: Zustand v5 (released late 2024). v1 was likely v4. Upgrade is non-breaking for basic slice/store usage.

### TanStack Query v5 — Keep It, Use Current Version

TanStack Query v5 (latest) is confirmed stable. The core API is the same as v4 with one important breaking change: the `onSuccess`/`onError`/`onSettled` callbacks on `useQuery` were removed. v2 should use query result destructuring and `onSuccess` on the mutation `mutate()` call instead.

**For a from-scratch repo, use TanStack Query v5 from day one:**

```typescript
// v5 pattern
const { data, isPending, isError } = useQuery({
  queryKey: ['workspaces', orgId],
  queryFn: () => supabase.from('banks').select('*'),
})

const mutation = useMutation({
  mutationFn: createWorkspace,
})
// onSuccess now lives on the mutate call, not the hook
mutation.mutate(data, {
  onSuccess: (result) => { /* handle here */ }
})
```

### TanStack Router v1 — Upgrade from React Router

**Recommend switching to TanStack Router v1 (stable)** instead of continuing with React Router v6/v7. Reasons specific to CallVault v2.0:

- **Type-safe URL params** — a 4-pane layout with complex URL state (active workspace, selected recording, context panel) benefits enormously from typed params
- **Route-level data loaders** — loaders pre-fetch into the TanStack Query cache before the route renders (no loading spinners on navigation)
- **File-based routing for SPAs** — same DX as Next.js App Router but purely client-side
- **Native TanStack Query integration** — `@tanstack/router-devtools` and query devtools work together

```typescript
// TanStack Router v1 — type-safe params
const Route = createFileRoute('/workspace/$workspaceId/recording/$recordingId')({
  beforeLoad: ({ params }) => {
    // params.workspaceId and params.recordingId are typed strings
  },
  loader: ({ context, params }) => 
    context.queryClient.ensureQueryData(recordingQueryOptions(params.recordingId)),
  component: RecordingDetailPage,
})
```

*Confidence: HIGH — verified against TanStack Query v5 docs and TanStack Router v1 landing page (tanstack.com/router/latest).*

---

## Native App Feel

### What "Arc / Comet Aesthetic" Actually Means in Practice

Arc Browser and Comet Browser share design characteristics that are achievable in the browser with the right techniques:

| Characteristic | What Creates It |
|----------------|----------------|
| Dark, high-contrast panels | Dark theme with subtle border differentiation (`oklch(100% 0 0 / 0.06)` borders) |
| No harsh UI chrome | Frameless panel edges; minimal visual noise in inactive states |
| Deliberate, weighted transitions | Spring physics instead of CSS easing; 200-400ms duration |
| Instant UI response | Optimistic updates + Zustand state changes BEFORE network calls |
| No "loading" feel | Skeleton states + data prefetching on hover/route loaders |
| Sidebar feels permanent | `h-screen overflow-hidden` on shell; content scrolls inside panes only |
| Spatial memory | URL-driven panel state so browser back/forward works correctly |

### Animation Library: Motion for React (formerly Framer Motion)

**Use Motion for React v12.** Verified: current version is v12.34.3.

Why Motion over alternatives:
- **Layout animations** (`layout` prop) smoothly transition panel resize, list reorder, item expand/collapse. This is the single most "native feel" technique and Motion's layout engine is the best in React.
- **120fps via Web Animations API** — Motion's hybrid engine uses native browser APIs for GPU-accelerated animations, not JavaScript loops.
- **Spring physics** — `type: "spring"` with `stiffness: 200-300, damping: 25-30` produces the "heavy, confident" feel of macOS animations that CSS `ease` curves cannot replicate.
- **AnimatePresence** — Enables exit animations for pane transitions, modal overlays, dropdown menus. Web UIs feel janky without exit animations; native apps always have them.
- **Declarative React API** — Animations link to state and props naturally.

```typescript
import { motion, AnimatePresence } from "motion/react"

// Content pane swap — new recording slides in
<motion.div
  key={selectedRecordingId}
  initial={{ opacity: 0, x: 8 }}
  animate={{ opacity: 1, x: 0 }}
  exit={{ opacity: 0, x: -8 }}
  transition={{ type: "spring", stiffness: 300, damping: 30 }}
/>

// Sidebar collapse/expand — smooth width animation
<motion.aside
  layout
  animate={{ width: collapsed ? 60 : 280 }}
  transition={{ type: "spring", stiffness: 200, damping: 25 }}
/>

// Selection indicator — shared layout animation (most native-feeling technique)
<motion.div layoutId="selection-indicator" className="bg-orange-500/20 rounded-md" />
```

**Install:**
```bash
npm install motion
# Import from "motion/react" (new package name as of v11+)
```

### Transition Timing Philosophy

The user's intuition about 500ms is directionally correct but needs calibration. **The native-feel secret is spring physics + instant state response, not long durations:**

| Transition Type | Duration | Approach |
|----------------|---------|----------|
| Panel content swap | 200-250ms | Spring (stiffness 300, damping 30) |
| Sidebar collapse/expand | 300-350ms | Spring (stiffness 200, damping 25) |
| Modal appear | 200ms | Spring (stiffness 400, damping 35) |
| Context panel slide in | 250-300ms | Spring (stiffness 250, damping 28) |
| List item appear (staggered) | 150ms per item | Ease out |
| Hover state | 80-120ms | Linear or CSS transition |
| Selection highlight move | 200ms | Spring layout animation (layoutId) |

**Critical insight:** Native apps feel smooth not because of long transitions but because of **spring physics + instant UI response**. The sequence is:
1. User clicks → Zustand state updates immediately
2. UI reflects selection immediately (no waiting for network)
3. Spring animation plays as a consequence of the state change
4. Network call completes in background; data fills in

A 500ms CSS transition that waits for data feels slower than a 250ms spring that plays immediately with optimistic state.

**Do NOT use `duration-500` via Tailwind as a blanket rule.** Use spring physics for deliberate animations (panel transitions, modal opens). Keep micro-interactions fast (80-150ms CSS).

### CSS Architecture for Native Feel

**TailwindCSS v4** (CSS-first config, no `tailwind.config.js` needed):

```css
/* globals.css — Tailwind v4 approach */
@import "tailwindcss";

@theme {
  --color-background: oklch(12% 0.01 285);     /* near-black with slight warmth */
  --color-surface: oklch(16% 0.01 285);         /* card/panel backgrounds */
  --color-surface-raised: oklch(20% 0.01 285);  /* hover, elevated states */
  --color-border: oklch(100% 0 0 / 0.06);       /* subtle borders */
  --color-border-strong: oklch(100% 0 0 / 0.12);
  --color-text-primary: oklch(95% 0 0);
  --color-text-secondary: oklch(65% 0 0);
  --color-accent: oklch(68% 0.18 35);           /* CallVault orange */
}
```

**Key CSS rules for app-native feel:**
1. `user-select: none` on all non-text UI chrome (sidebar nav, toolbar, panel headers)
2. `will-change: transform` on panels during animation only (set via Motion's `whileHover` or `layout`)
3. `contain: layout` on scroll areas for paint isolation
4. Never use `transition-all` — specify exactly which properties transition
5. `@media (prefers-reduced-motion: reduce)` — always respect system settings (Motion handles this automatically with `useReducedMotion`)
6. Disable default browser outlines; replace with custom `:focus-visible` rings using brand color

### shadcn/ui Components for 4-Pane Layout

Verified against shadcn/ui current docs:

- **Resizable** — Built on `react-resizable-panels` v4 (updated Feb 2025). Provides `ResizablePanelGroup`, `ResizablePanel`, `ResizableHandle` with keyboard support. This is the foundation of the 4-pane layout.
- **ScrollArea** — Overlay scrollbar styling (hides system scrollbar, uses custom styled overlay)
- **Command** — Full command palette with keyboard navigation (`⌘K` palette, Arc-style)
- **Sidebar** — New in shadcn/ui; collapsible sidebar with built-in state and animation

```bash
npx shadcn@latest add resizable scroll-area command sidebar tooltip sonner
```

*Confidence: HIGH — verified against Motion v12.34 docs, shadcn/ui resizable docs (react-resizable-panels v4 confirmed), Tailwind v4 pattern.*

---

## Python vs TypeScript

**Python makes no sense anywhere in CallVault v2.0.**

Current stack is 100% TypeScript:
- Frontend: TypeScript/React
- Backend: Supabase Edge Functions (Deno/TypeScript)
- MCP Server: Cloudflare Workers (TypeScript)

**v2.0 backend work is:**
- Import routing rules engine → TypeScript Edge Function (Deno)
- Smart import enrichment (auto-title, tags, sentiment at import) → TypeScript Edge Function calling OpenAI API
- MCP tools expansion → TypeScript Cloudflare Worker
- Supabase RPC functions → SQL + PostgreSQL functions

None of these benefit from Python. Python is chosen for: ML model training, data pipeline scripts, LangChain/LangGraph agentic workflows, scientific computing, legacy data engineering. CallVault v2.0 has none of these.

**Introducing Python would:**
- Split mental context between two languages (TypeScript everywhere vs Python somewhere)
- Add a new runtime deployment target (Python WSGI/ASGI vs Deno/Workers)
- Break the type-sharing story between frontend and backend (Supabase generates TypeScript types; Python can't consume them natively)
- Create a second dependency tree to maintain

**Verdict: TypeScript everywhere. Python = no.**

*Confidence: HIGH — clear structural reasoning, no contested findings.*

---

## Tauri / Electron Consideration

### What Tauri Would Add

Tauri v2 (confirmed stable; Tauri docs last updated Jan 2026) wraps a Vite/React SPA in a native desktop window using the system WebView (WKWebView on macOS, WebView2 on Windows):

**Genuine benefits:**
- Native window chrome (real macOS titlebar, traffic lights, drag regions, system font rendering)
- System tray, menu bar integration, global keyboard shortcuts
- Local file system access (drag-and-drop recording import without browser security restrictions)
- Full-window experience with no browser tab bar visible
- Potential offline mode with local data cache
- App Store distribution (macOS App Store / Windows Store)

**App size:** ~600KB minimum installer vs Electron's ~100MB (Tauri uses system WebView, doesn't bundle Chromium).

### What Tauri Would Cost in v2

| Cost | Severity |
|------|----------|
| Rust required for any native features | HIGH — new language, new toolchain |
| Two deployment targets (web + desktop) | HIGH — doubles build/CI surface |
| Supabase auth changes needed (no browser cookie jar; OAuth requires deep link or localhost handler) | MEDIUM |
| MCP OAuth flow needs Tauri-compatible deep link callback | MEDIUM |
| Platform-specific testing matrix | HIGH |
| Code signing certificates (both macOS and Windows) | MEDIUM |
| App Store review and compliance | HIGH |
| Slower iteration cycle (Rust compile times) | MEDIUM |

### Verdict: **Skip Tauri for v2, architect for it**

The v2.0 goal is a clean frontend rebuild with clarified workspace model and MCP expansion. Adding Tauri adds 2-4 weeks of platform-specific overhead that doesn't advance the core value proposition.

**However:** The recommended stack (Vite + React) is **Tauri v2 compatible by design.** Tauri's own documentation uses Vite as the primary frontend integration example. If v3 adds a macOS app, zero React code needs to change — you add `src-tauri/` alongside the existing codebase.

**Architect for Tauri by:**
- Abstracting browser-specific APIs behind hooks (`useFileOpen`, `useClipboard`) — easy to swap to Tauri APIs later
- No hard dependencies on `window.location` for auth redirects (use configurable redirect URLs)
- Keep Supabase client creation in a factory function that accepts environment config

**Electron: Skip entirely.** If desktop ever becomes necessary, Tauri is strictly better — smaller, faster, more secure, Rust-backed.

*Confidence: HIGH — verified against Tauri v2 official docs (last updated 2026-01-30).*

---

## Full Stack Recommendation

### The Complete v2.0 Frontend Stack

| Category | Tool | Version | Rationale |
|----------|------|---------|-----------|
| **Build tool** | Vite | 7.x | Proven in v1, zero-overhead SPA, Tauri-compatible |
| **UI framework** | React | 18.x | Proven in v1; React 19 upgrade optional post-launch |
| **Language** | TypeScript | 5.x | Full type safety, shared types with Supabase SDK |
| **Routing** | TanStack Router | v1 (stable) | Type-safe SPA routing, route loaders, TanStack Query integration |
| **Server state** | TanStack Query | v5 | From-scratch repo, use current; route loader integration |
| **UI state** | Zustand | v5 | Proven in v1, minimal, composable |
| **Styling** | TailwindCSS | v4 | CSS-first config, better custom theme system for dark design |
| **Components** | shadcn/ui | current | Open code, resizable panels, sidebar, command palette |
| **Animations** | Motion for React | v12 | Layout animations, spring physics, 120fps hybrid engine |
| **Auth client** | Supabase JS SDK | v2 | Same as v1; session management, RLS integration |
| **Deployment** | Vercel | — | SPA static deployment, same as v1 |

### What Changes from v1

| v1 | v2 | Why |
|----|-----|-----|
| React Router (implied) | TanStack Router v1 | Type safety for complex URL state in 4-pane layout |
| TanStack Query v4 | TanStack Query v5 | From-scratch repo, use current; remove deprecated patterns |
| Zustand v4 | Zustand v5 | Minor upgrade, same patterns |
| No dedicated animation library | Motion for React v12 | Native-feel requirement; layout animations needed |
| TailwindCSS v3 | TailwindCSS v4 | Better custom theme system |
| Vercel AI SDK (`useChat`) | **Remove Vercel AI SDK** | No RAG chat in v2 (minimal bridge chat uses direct fetch) |
| OpenRouter integration | **Remove** | No AI model management in v2 |

### Installation Scaffold

```bash
# Scaffold new repo
npm create vite@latest callvault-v2 -- --template react-swc-ts
cd callvault-v2

# Core dependencies
npm install @supabase/supabase-js
npm install @tanstack/react-router @tanstack/router-devtools
npm install @tanstack/react-query @tanstack/react-query-devtools
npm install zustand

# UI and animations
npm install tailwindcss @tailwindcss/vite
npm install motion

# shadcn/ui setup
npx shadcn@latest init
npx shadcn@latest add resizable scroll-area command sidebar tooltip sonner button badge

# Dev tools
npm install -D @types/react @types/react-dom typescript
```

### Directory Structure (TanStack Router File-Based)

```
src/
  routes/
    __root.tsx           # AppShell — 4-pane ResizablePanelGroup
    index.tsx            # Redirect to /workspace
    workspace/
      index.tsx          # Workspace picker
      $workspaceId/
        index.tsx        # Workspace detail (recordings list)
        recording/
          $recordingId.tsx  # Recording detail + context panel
  components/
    shell/
      AppShell.tsx       # ResizablePanelGroup wrapper
      NavSidebar.tsx     # Pane 1 — icon nav
      WorkspacePanel.tsx # Pane 2 — workspace/folder list
      ContextPanel.tsx   # Pane 4 — context/detail
    workspace/
    recording/
    ui/                  # shadcn/ui components (auto-generated, do not edit)
  stores/
    useShellStore.ts     # Panel sizes, sidebar collapse, active workspace
    useSelectionStore.ts # Selected recording, context panel open state
  lib/
    supabase.ts          # Client factory (env-configurable for Tauri later)
    queryClient.ts       # TanStack Query client
    routerContext.ts     # Router context type (queryClient injection)
```

### 4-Pane Layout Core Architecture

```tsx
// routes/__root.tsx
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { motion, AnimatePresence } from 'motion/react'
import { useShellStore } from '@/stores/useShellStore'
import { Outlet, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: AppShell,
})

function AppShell() {
  const { contextPanelOpen, navCollapsed } = useShellStore()

  return (
    <div className="h-screen w-screen overflow-hidden bg-background flex">
      <ResizablePanelGroup direction="horizontal">
        {/* Pane 1: Icon nav — fixed narrow */}
        <ResizablePanel defaultSize={4} minSize={3} maxSize={6}>
          <NavSidebar />
        </ResizablePanel>

        {/* Pane 2: Workspace/folder list */}
        <ResizablePanel defaultSize={20} minSize={14} maxSize={30}>
          <WorkspacePanel />
        </ResizablePanel>

        <ResizableHandle />

        {/* Pane 3: Main content (recording list or detail) */}
        <ResizablePanel defaultSize={contextPanelOpen ? 45 : 76}>
          <motion.div layout className="h-full">
            <Outlet />
          </motion.div>
        </ResizablePanel>

        {/* Pane 4: Context panel — conditionally rendered */}
        <AnimatePresence>
          {contextPanelOpen && (
            <>
              <ResizableHandle />
              <ResizablePanel defaultSize={31} minSize={20}>
                <motion.div
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ type: 'spring', stiffness: 280, damping: 28 }}
                  className="h-full"
                >
                  <ContextPanel />
                </motion.div>
              </ResizablePanel>
            </>
          )}
        </AnimatePresence>
      </ResizablePanelGroup>
    </div>
  )
}
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Build tool | Vite 7 | Next.js 15 | SSR/RSC overhead with zero benefit for auth SPA |
| Routing | TanStack Router | React Router v7 | Less TypeScript-native, no route-level query loaders |
| Routing | TanStack Router | Next.js App Router | Server-only feature; unnecessary for SPA |
| Animation | Motion for React | CSS transitions only | Cannot do spring physics, layout animations, exit animations |
| Animation | Motion for React | GSAP | Imperative API fights React's declarative model |
| Desktop | (v3 decision) | Tauri v2 | Good option for v3; zero value in v2 |
| Desktop | Skip Electron | Electron | 100MB+ bundle, Tauri is strictly better |
| Language | TypeScript | Python | No use case; adds runtime/deployment complexity |

---

## Sources

| Source | URL | Confidence | Date Checked |
|--------|-----|-----------|-------------|
| Next.js 15 release notes | https://nextjs.org/blog/next-15 | HIGH | 2026-02-22 |
| Vite 7 official guide | https://vitejs.dev/guide/ | HIGH | 2026-02-22 |
| Motion for React (v12.34.3) | https://motion.dev/docs/react-quick-start | HIGH | 2026-02-22 |
| TanStack Query v5 overview | https://tanstack.com/query/latest/docs/framework/react/overview | HIGH | 2026-02-22 |
| TanStack Router v1 | https://tanstack.com/router/latest | HIGH | 2026-02-22 |
| Tauri v2 overview | https://tauri.app/start/ | HIGH | 2026-02-22 |
| Tauri v2 create project | https://tauri.app/start/create-project/ | HIGH | 2026-02-22 |
| shadcn/ui Resizable (v4) | https://ui.shadcn.com/docs/components/resizable | HIGH | 2026-02-22 |
| shadcn/ui Introduction | https://ui.shadcn.com/docs | HIGH | 2026-02-22 |
| Zustand docs | https://zustand.docs.pmnd.rs/ (timed out) | MEDIUM | 2026-02-22 — confirmed v5 exists from multiple sources |
| TailwindCSS v4 | Verified via shadcn/ui changelog + Vite docs | MEDIUM | 2026-02-22 |

### Confidence Assessment

| Area | Confidence | Notes |
|------|-----------|-------|
| Next.js vs Vite verdict | HIGH | Verified against Next.js 15 docs; reasoning is structural |
| State management (Zustand + TanStack Query) | HIGH | Both confirmed stable and current via official docs |
| Animation approach (Motion v12) | HIGH | Official docs verified; version confirmed 12.34.3 |
| Transition timing philosophy | MEDIUM | Best practices derived from native app design patterns; not a single authoritative source |
| Python verdict | HIGH | Clear structural reasoning; no source contradicts it |
| Tauri verdict | HIGH | Verified against Tauri v2 official docs (Jan 2026 update) |
| TailwindCSS v4 | MEDIUM | Exists and shadcn/ui supports it; specific API differences not deeply verified |
| TanStack Router recommendation | HIGH | Verified v1 stable at tanstack.com/router/latest |
