# Phase 14: Foundation - Research

**Researched:** 2026-02-27
**Domain:** New Vite+React frontend repo with Supabase auth, 4-pane AppShell, TanStack Router, Motion, TailwindCSS v4
**Confidence:** HIGH (core stack verified across multiple sources; some discretion areas MEDIUM)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**AppShell layout:**
- Replicate v1's 4-pane model exactly — this is proven and the user likes it
- Pane 1: NavRail sidebar (220px expanded / 72px collapsed), collapsible via toggle
- Pane 2: Secondary panel (280px, collapsible to 0) — e.g., folder sidebar, can be closed entirely
- Pane 3: Main content area (flex-1) — call list and primary content lives here
- Pane 4: Detail panel (360px desktop / 320px tablet), slides in from right when needed
- Fixed proportions — no user-resizable dividers
- 4th pane hidden when nothing is selected — main content pane expands to fill
- All transitions 500ms ease-in-out, rounded-2xl panes, 12px gaps between panes
- Reference: current v1 app + Microsoft Loop (newest iteration)

**Responsive behavior:**
- Mobile: stack and navigate — panes become full-screen views with back button navigation (like a native mobile app)
- Tablet: auto-collapse sidebar to 72px icon rail
- Foundation must ship with mobile responsive layout, not desktop-only

**Navigation structure:**
- Workspace-first sidebar: org switcher at top, workspace switcher below, then "All Calls" + folder tree, then imports/settings at bottom
- Org and workspace switching via dropdown menus (not overlay panels)
- Keep v1's nav item order and grouping — just apply new naming (Organization/Workspace/Folder)

**Visual direction:**
- Visual evolution of v1 — cleaner, more polished, no emojis anywhere
- Base the visual identity on the ACTUAL current app appearance, not the brand-guidelines-v4.2 document (which may be stale/inaccurate)
- Both light mode and dark mode ship from day 1 — both polished. User primarily uses light mode.
- Match v1's compact density — the current density IS compact and the user likes it
- Keep all existing visual elements (rounded panes, shadows, spring animations, current color palette) — just execute them with more polish

**First-run experience:**
- Existing v1 users: guided tour (5-7 steps) covering layout, naming changes (Bank->Org, Vault->Workspace, Hub->Folder), and key new features
- Tour is skippable but encouraged — skip option exists but is subtle, not prominently displayed
- Brand-new users (never used v1): separate onboarding flow focused on getting started — create workspace, connect first import source
- Two distinct paths: "returning user" tour vs "new user" onboarding

### Claude's Discretion
- Exact spring animation stiffness/damping values (roadmap suggests 200-300/25-30 range)
- Specific sidebar icon set and styling
- Tour/onboarding implementation approach (library vs custom)
- Exact pane shadow depths and border treatments during polish
- Loading states and skeleton screens during route transitions

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Summary

Phase 14 creates a brand-new Vite 7 + React 19 + TypeScript + TanStack Router repo that points at the existing Supabase backend. The v1 codebase (at `/Users/Naegele/dev/brain`) serves as the visual and architectural reference — the AppShell, color system, CSS variables, Zustand stores, and Supabase auth patterns are all directly portable with adaptation for the new routing layer. The new repo lives at `/Users/Naegele/dev/callvault/` as a sibling, not inside `brain/`.

The stack decision resolves to: Vite 7 + React 19 (stable since December 2024, now at 19.2) + TanStack Router v1 (file-based) + TailwindCSS v4 (CSS-first, no config file) + shadcn/ui (officially supports TanStack Router) + Motion (`motion/react` package) + Zustand v5 + TanStack Query v5 + Supabase JS v2. The key constraint FOUND-02 requires this stack to be validated via research before repo creation — this document IS that validation.

The largest migration deltas from v1 to v2 are: (1) React Router DOM → TanStack Router (routing system and link components change); (2) TailwindCSS v3 → v4 (CSS-first config, `@theme {}` in globals.css, no `tailwind.config.js`); (3) `framer-motion` → `motion` package with import from `motion/react`; (4) mobile-first pane navigation replacing the v1 overlay approach on mobile. Everything else — Supabase client, Zustand stores, TanStack Query hooks, Radix UI primitives, Remix Icons, Sonner toasts, design tokens — transfers directly.

**Primary recommendation:** Scaffold with `pnpm create vite` using React+TypeScript template, then layer in TanStack Router, shadcn/ui (via `pnpm dlx shadcn@latest init`), and the remaining libraries. Do NOT use `create-tsrouter-app` as it targets a different project structure. Copy the full CSS variable system from `brain/src/index.css` verbatim (it is the source of truth).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vite | ^7.0 | Build tool and dev server | 31M weekly downloads, Rolldown-ready, fastest HMR, baseline-widely-available default target |
| React | ^19.2 | UI framework | Stable since Dec 2024; required by latest shadcn/ui canary; React Compiler reduces memo boilerplate |
| TypeScript | ^5.8 | Type safety | Same as v1; TanStack Router requires TS for type-safe routes |
| TanStack Router | ^1.x | Type-safe file-based routing | Only React router with full TypeScript-first design; replaces React Router DOM |
| TailwindCSS | ^4.x | CSS utility framework | CSS-first config, no tailwind.config.js, `@theme {}` in globals.css |
| shadcn/ui | latest | Accessible UI component system | Official TanStack Router integration documented; Tailwind v4 support since Feb 2025 |
| Motion (`motion`) | ^12.x | Spring animations for AppShell pane transitions | v1 already uses framer-motion v12; `motion/react` is the new import path |
| Zustand | ^5.x | Client/UI state | Hard boundary: UI state only (pane open/close, sidebar collapsed, etc.) |
| TanStack Query | ^5.x | Server state | Hard boundary: all Supabase data fetching |
| @supabase/supabase-js | ^2.x | Auth + database client | Same Supabase project, same env vars; copy from brain/.env.local |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vitejs/plugin-react-swc | ^4.2 | SWC-based React transform | Faster dev builds than Babel; same as v1 |
| @tanstack/router-plugin | ^1.x | File-based route code generation | Required for `src/routes/` file-based routing |
| @remixicon/react | ^4.x | Icon set | Mandatory per v1 CLAUDE.md — no other icon libraries |
| sonner | ^1.x | Toast notifications | Same as v1; minimal API |
| next-themes | ^0.3 | Dark/light mode | Same as v1; ThemeProvider wraps app root |
| tw-animate-css | latest | Animation utilities | Replaces `tailwindcss-animate` in Tailwind v4 / shadcn v4 setup |
| clsx + tailwind-merge | latest | Class merging utility | Same as v1 — the `cn()` helper |
| class-variance-authority | ^0.7 | Variant component styling | Same as v1 — used in all shadcn/ui button/variant components |
| zod | ^3.x | Input validation | Same as v1 — auth forms, user inputs |
| react-error-boundary | ^6.x | Error containment | Same as v1 |
| driver.js | latest | Product tour and onboarding | MIT license, framework-agnostic, no React dep, 20k GitHub stars |
| date-fns | ^3.x | Date formatting | Same as v1 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| TanStack Router | React Router v7 | React Router v7 is more familiar but lacks compile-time type safety; TanStack Router generates typed route helpers. CONTEXT.md locks TanStack Router. |
| React 19 | React 18 | React 18 has fewer peer dep issues historically, but shadcn/ui CLI now defaults to React 19; Radix UI resolved all compatibility issues by early 2025. React 19.2 is stable and battle-tested. |
| driver.js (tour) | React Joyride | Joyride is React-specific and heavier; driver.js is MIT, framework-agnostic, 44k npm daily downloads, easier custom styling for brand-match |
| driver.js (tour) | Custom tour | Custom tour is weeks of work to match accessibility; driver.js provides focus management, keyboard navigation, backdrop for free |
| motion package | framer-motion package | `framer-motion` still works but `motion` is the new canonical package with `motion/react` import; v1 already has framer-motion@12 which is the same codebase |

**Installation:**
```bash
# Scaffold new Vite React TypeScript project
pnpm create vite callvault --template react-swc-ts
cd callvault

# Core dependencies
pnpm install @tanstack/react-router @tanstack/router-plugin

# TailwindCSS v4
pnpm install tailwindcss @tailwindcss/vite

# Initialize shadcn/ui (prompts for config)
pnpm dlx shadcn@latest init

# Animation
pnpm install motion

# State management
pnpm install zustand @tanstack/react-query

# Supabase
pnpm install @supabase/supabase-js

# Icons + UI utilities
pnpm install @remixicon/react sonner next-themes
pnpm install clsx tailwind-merge class-variance-authority zod

# Error handling + dates
pnpm install react-error-boundary date-fns

# Tour/onboarding
pnpm install driver.js

# Animation utilities
pnpm install tw-animate-css
```

---

## Architecture Patterns

### Recommended Project Structure
```
callvault/
├── src/
│   ├── routes/              # TanStack Router file-based routes
│   │   ├── __root.tsx       # Root route — QueryClient, ThemeProvider, AuthProvider
│   │   ├── index.tsx        # / — Calls list (protected)
│   │   ├── login.tsx        # /login — Auth page
│   │   ├── settings/
│   │   │   ├── index.tsx    # /settings
│   │   │   └── $category.tsx # /settings/$category
│   │   ├── workspaces/
│   │   │   ├── index.tsx    # /workspaces
│   │   │   └── $workspaceId.tsx
│   │   ├── folders/
│   │   │   └── $folderId.tsx
│   │   ├── calls/
│   │   │   └── $callId.tsx  # /calls/$callId detail
│   │   ├── import/
│   │   │   └── index.tsx    # /import hub
│   │   ├── sharing/
│   │   │   └── index.tsx    # /sharing (shared-with-me)
│   │   ├── s/
│   │   │   └── $token.tsx   # /s/$token — public shared call view
│   │   └── oauth/
│   │       └── callback.tsx # /oauth/callback — Supabase PKCE exchange
│   ├── components/
│   │   ├── layout/          # AppShell, SidebarToggle, DetailPaneOutlet
│   │   ├── ui/              # shadcn/ui primitives + sidebar-nav
│   │   ├── panels/          # Detail panel content
│   │   ├── panes/           # Secondary pane content
│   │   └── shared/          # Cross-domain shared components
│   ├── hooks/               # Custom hooks (useAuth, useBreakpoint, useFileOpen, useClipboard)
│   ├── stores/              # Zustand stores (panelStore, preferencesStore, etc.)
│   ├── lib/                 # supabase client, utils.ts (cn), query-config.ts
│   ├── types/               # TypeScript type definitions
│   ├── routeTree.gen.ts     # AUTO-GENERATED by TanStack Router plugin — do not edit
│   ├── main.tsx             # React DOM render
│   └── globals.css          # TailwindCSS v4 @theme, CSS variables (copied from v1 index.css)
├── src-tauri/
│   └── .gitkeep             # Tauri placeholder — day 1
├── public/                  # Static assets
├── vite.config.ts           # Vite 7 config with TanStack Router plugin
├── components.json          # shadcn/ui config
├── tsconfig.json
└── package.json
```

### Pattern 1: TanStack Router File-Based Route Setup

**What:** Declare routes as files in `src/routes/`. The `@tanstack/router-plugin` Vite plugin auto-generates `routeTree.gen.ts`.
**When to use:** All routing in the new app.

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: { port: 3000 },
})
```

```typescript
// src/main.tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
)
```

```typescript
// src/routes/__root.tsx
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { ThemeProvider } from 'next-themes'
import { AuthProvider } from '@/hooks/useAuth'
import { Toaster } from 'sonner'

export const Route = createRootRoute({
  component: () => (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AuthProvider>
        <Outlet />
        <Toaster />
      </AuthProvider>
    </ThemeProvider>
  ),
})
```

```typescript
// src/routes/index.tsx — Protected route example
import { createFileRoute, redirect } from '@tanstack/react-router'
import { AppShell } from '@/components/layout/AppShell'
import { CallsListPane } from '@/components/panes/CallsListPane'

export const Route = createFileRoute('/')({
  beforeLoad: ({ context }) => {
    // Redirect to login if not authenticated
    if (!context.auth?.session) {
      throw redirect({ to: '/login' })
    }
  },
  component: IndexPage,
})

function IndexPage() {
  return (
    <AppShell
      config={{ secondaryPane: <FolderSidebarPane />, showDetailPane: true }}
    >
      <CallsListPane />
    </AppShell>
  )
}
```

### Pattern 2: TailwindCSS v4 CSS-First Configuration

**What:** All design tokens live in `src/globals.css` under `@theme {}`. No `tailwind.config.js`.
**When to use:** Always — this is v4's only config mechanism.

```css
/* src/globals.css */
@import "tailwindcss";
@import "tw-animate-css";

@theme {
  /* Vibe orange */
  --color-vibe-orange: hsl(32 100% 50%);
  --color-vibe-orange-dark: hsl(14 100% 50%);
  --color-vibe-orange-light: hsl(55 100% 50%);

  /* Fonts */
  --font-montserrat: "Montserrat", sans-serif;
  --font-inter: "Inter", sans-serif;

  /* Custom spacing */
  --spacing-pane-gap: 12px;
  --radius-pane: 1rem; /* rounded-2xl */
}

/* Semantic color tokens — applied in :root and .dark */
:root {
  --viewport: hsl(0 0% 99%);
  --background: hsl(0 0% 100%);
  --card: hsl(0 0% 100%);
  --foreground: hsl(0 0% 9%);
  --border: hsl(0 0% 90%);
  --ring: hsl(32 100% 50%);
  /* ... full system copied from brain/src/index.css */
}

.dark {
  --viewport: hsl(0 0% 9%);
  --background: hsl(0 0% 13%);
  --card: hsl(0 0% 13%);
  --foreground: hsl(0 0% 98%);
  --border: hsl(0 0% 23%);
  /* ... */
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-border: var(--border);
  --color-ring: var(--ring);
}
```

**Critical difference from v3:** shadcn/ui v4 expects CSS variables wrapped in `hsl()` at the `:root` level, and then referenced via `@theme inline` — NOT the raw HSL numbers without `hsl()` that v3 used.

### Pattern 3: Motion Spring Animations (AppShell Pane Transitions)

**What:** Use `motion` package (`motion/react` import path) for pane layout animations with spring physics.
**When to use:** All pane expand/collapse transitions, sidebar toggle.

The v1 app uses `transition-all duration-500 ease-in-out` CSS transitions. v2 can optionally upgrade these to Motion spring animations for more natural feel (Claude's discretion on stiffness/damping).

```typescript
// Source: motion.dev/docs + v1 framer-motion@12 patterns
import { motion, AnimatePresence } from 'motion/react'

// AppShell sidebar pane — spring animation
<motion.nav
  initial={false}
  animate={{ width: isSidebarExpanded ? 220 : 72 }}
  transition={{
    type: 'spring',
    stiffness: 260,   // Recommended: 200-300 range per roadmap
    damping: 28,      // Recommended: 25-30 range per roadmap
  }}
  className="relative flex-shrink-0 bg-card rounded-2xl border border-border/60 shadow-sm flex flex-col py-2 h-full z-10"
>
  <SidebarNav isCollapsed={!isSidebarExpanded} />
</motion.nav>

// Detail pane — slide in from right
<AnimatePresence>
  {showDetailPane && (
    <motion.div
      key="detail-pane"
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: isTablet ? 320 : 360, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      className="flex-shrink-0 bg-card rounded-2xl border border-border shadow-sm flex flex-col h-full"
    >
      {detailContent}
    </motion.div>
  )}
</AnimatePresence>
```

### Pattern 4: Supabase Auth with PKCE for New Domain

**What:** Supabase auth requires the new domain's callback URL to be in the redirect allowlist BEFORE any user access.
**When to use:** FOUND-07 — this is a prerequisite safety check, not a code pattern.

```typescript
// src/lib/supabase.ts — same pattern as v1
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'  // copy from v1

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
})
```

```typescript
// src/routes/oauth/callback.tsx — PKCE code exchange
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/oauth/callback')({
  component: OAuthCallback,
})

function OAuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    // Supabase automatically handles PKCE exchange via onAuthStateChange
    // Just redirect to home after auth completes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        navigate({ to: '/' })
      }
    })
    return () => subscription.unsubscribe()
  }, [navigate])

  return <div>Completing sign in...</div>
}
```

### Pattern 5: Zustand v5 Store (UI State Only)

**What:** Zustand v5 uses `create<T>()()` double-invocation for TypeScript. `useSyncExternalStore` internally. Hard boundary: UI state ONLY.
**When to use:** Panel open/close, sidebar collapsed state, pane state.

```typescript
// src/stores/panelStore.ts — identical pattern to v1
import { create } from 'zustand'

export type PanelType = 'call-detail' | 'folder-detail' | 'settings-help' | null

interface PanelState {
  isPanelOpen: boolean
  panelType: PanelType
  panelData: unknown
  openPanel: (type: PanelType, data?: unknown) => void
  closePanel: () => void
}

export const usePanelStore = create<PanelState>()((set) => ({
  isPanelOpen: false,
  panelType: null,
  panelData: null,
  openPanel: (type, data = null) => set({ isPanelOpen: true, panelType: type, panelData: data }),
  closePanel: () => set({ isPanelOpen: false, panelType: null, panelData: null }),
}))
```

### Pattern 6: Browser API Abstraction (Tauri Compatibility)

**What:** Wrap any browser-specific API behind a custom hook. The hook returns a no-op or browser-appropriate implementation. When Tauri arrives, only the hook implementation changes.
**When to use:** File open dialogs, clipboard, system file access.

```typescript
// src/hooks/useClipboard.ts
export function useClipboard() {
  const copy = async (text: string) => {
    // Future: check for Tauri context and invoke Tauri clipboard plugin
    await navigator.clipboard.writeText(text)
  }
  return { copy }
}

// src/hooks/useFileOpen.ts
export function useFileOpen() {
  const openFile = async (accept?: string): Promise<File | null> => {
    // Future: check for Tauri context and invoke Tauri file dialog
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      if (accept) input.accept = accept
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0] ?? null
        resolve(file)
      }
      input.click()
    })
  }
  return { openFile }
}
```

### Pattern 7: Driver.js Tour — Two Paths (Returning vs New User)

**What:** Use driver.js to implement the guided tour (returning v1 users) and onboarding flow (new users). Differentiate based on a Supabase `user_profiles` flag.
**When to use:** First-run experience on app shell render.

```typescript
// src/hooks/useTour.ts
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

export function useReturningUserTour() {
  const startTour = () => {
    const driverObj = driver({
      showProgress: true,
      allowClose: true,
      progressText: '{{current}} of {{total}}',
      steps: [
        {
          element: '[data-tour="sidebar"]',
          popover: {
            title: 'Your Organizations',
            description: 'Banks are now Organizations. Switch between them from here.',
            side: 'right',
          },
        },
        {
          element: '[data-tour="workspace-switcher"]',
          popover: {
            title: 'Workspaces',
            description: 'Vaults are now Workspaces.',
            side: 'right',
          },
        },
        // ... 5-7 steps total
      ],
    })
    driverObj.drive()
  }
  return { startTour }
}
```

### AppShell Mobile Navigation Pattern

**What:** On mobile (<768px), panes become full-screen views accessible via bottom navigation or swipe. No overlapping panes.
**When to use:** All AppShell renders on mobile viewport.

V1 already implements a mobile overlay approach (sliding drawer from left). V2 requirement is stricter: **native mobile app feel with back-button navigation**. This means the routing layer drives mobile navigation, not overlay state.

```typescript
// Mobile: route to dedicated views instead of showing panes as overlays
// /          → Calls list (Pane 3 content, full screen)
// /nav       → Navigation drawer (Pane 1 content, full screen)
// /folders   → Folder sidebar (Pane 2 content, full screen)
// Pane 4 opens as a push route: /calls/$callId

// Use TanStack Router's nested routes for mobile navigation stack
```

### Anti-Patterns to Avoid

- **Using React Router DOM:** v2 uses TanStack Router exclusively. Do not mix.
- **Creating tailwind.config.js:** TailwindCSS v4 is CSS-only — config in `@theme {}` in globals.css.
- **Using HSL without `hsl()` wrapper in CSS vars:** shadcn/ui v4 expects `--background: hsl(0 0% 100%)` not `--background: 0 0% 100%`.
- **Using `tailwindcss-animate`:** Replaced by `tw-animate-css` in shadcn/ui + Tailwind v4.
- **Importing from `framer-motion`:** New import path is `motion/react`. Both work (same package), but use `motion` for v2.
- **Placing AI code in v2 repo:** FOUND-02 / AI-02 hard constraint — zero AI/RAG/embedding code.
- **V1 route paths:** `/bank/`, `/vault/`, `/hub/` must 404 or redirect in v2.
- **Editing `routeTree.gen.ts`:** This file is auto-generated by the TanStack Router plugin. Never edit manually.
- **Using `create<T>` without double invocation in Zustand v5:** TypeScript requires `create<T>()()`.
- **Forgetting `src-tauri/.gitkeep`:** Must be created on day 1 per spec.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Route type safety | Custom typed navigation helpers | TanStack Router's generated `routeTree.gen.ts` + `Link` component | Route types are automatically generated; manual types drift |
| Product tour | Custom step-by-step overlay system | driver.js | Focus management, keyboard nav, backdrop, scroll-into-view — 6 months of work for accessibility alone |
| Dark mode | Manual localStorage + class toggling | next-themes | Handles FOUC (flash of unstyled content), system preference, cross-tab sync |
| UI component accessibility | Custom dialog/popover/select from scratch | shadcn/ui (Radix primitives) | ARIA attributes, focus trapping, keyboard navigation all handled |
| Animation spring physics | Custom CSS keyframes with easing | Motion (`motion/react`) | Real spring physics responds to interruption; CSS easing cannot |
| Toast notifications | Custom notification system | Sonner | Stacking, queuing, auto-dismiss, types — same as v1 |
| Auth state management | Custom auth context with token refresh | Supabase JS client | PKCE, token refresh, session persistence, `onAuthStateChange` all built-in |
| pane width CSS transitions | requestAnimationFrame width interpolation | CSS `transition-all duration-500` or Motion | CSS transitions are GPU-accelerated; hand-rolled JS is not |

**Key insight:** Every item in this list represents a category where edge cases (accessibility, timing, browser quirks) make the custom solution 10-50x more work than the library. The v1 codebase already validated these choices in production.

---

## Common Pitfalls

### Pitfall 1: Supabase Redirect Domain Not Allowlisted

**What goes wrong:** User clicks "Sign in with Google" → Google redirects to new domain → Supabase rejects with `redirect_uri_mismatch` error. All users are locked out.
**Why it happens:** Supabase auth validates redirect URLs against an allowlist. New Vercel domain is not on the list until manually added.
**How to avoid:** FOUND-07 — add new Vercel domain to Supabase URL Configuration allowlist BEFORE any user accesses the app. Also update Google OAuth console "Authorized redirect URIs" to include the Supabase project callback URL for the new origin.
**Warning signs:** Auth errors immediately after first deployment. "Invalid redirect URL" in browser console.

### Pitfall 2: TailwindCSS v4 CSS Variable Format Mismatch

**What goes wrong:** shadcn/ui components don't pick up theme colors. Everything renders with default Tailwind colors.
**Why it happens:** TailwindCSS v4 + shadcn/ui requires CSS variables in `hsl()` format at `:root` level, THEN re-exposed via `@theme inline`. The v1 app uses raw HSL numbers (`--background: 0 0% 100%`) — valid for v3 but NOT v4.
**How to avoid:** When copying `brain/src/index.css` to `src/globals.css`, wrap all values: `--background: hsl(0 0% 100%)`. Add `@theme inline { --color-background: var(--background); }` block after.
**Warning signs:** Colors render as black/white defaults; components have no brand colors.

### Pitfall 3: routeTree.gen.ts Not Generated / Stale

**What goes wrong:** TypeScript errors on all route-related code. `Route` imports fail.
**Why it happens:** `routeTree.gen.ts` is only generated during `vite dev` or `vite build` when the router plugin runs. It doesn't exist after `git clone` until dev server starts.
**How to avoid:** Run `pnpm dev` before attempting to build. Add `routeTree.gen.ts` to `.gitignore` OR commit it (both are valid; committing means CI doesn't need a pre-build step). Add a note in CLAUDE.md.
**Warning signs:** Fresh clone, TypeScript compiler immediately errors on route imports.

### Pitfall 4: Zustand v5 TypeScript Double Invocation

**What goes wrong:** TypeScript error: "Expected 1 arguments, but got 0" or middleware type inference fails.
**Why it happens:** Zustand v5 changed the TypeScript API to `create<T>()()` (curried) for proper type inference with middleware.
**How to avoid:** Always use `create<StateType>()((set, get) => ({ ... }))` — double invocation.
**Warning signs:** TypeScript errors specifically on `create()` calls when adding middleware.

### Pitfall 5: Mobile Pane Navigation vs Overlay Approach

**What goes wrong:** On mobile, the app feels like a website with drawer overlays rather than a native mobile app with back navigation.
**Why it happens:** V1 uses CSS overlay approach (drawer slides over content). V2 requirement is stack navigation (each pane is its own full-screen route on mobile).
**How to avoid:** Design the mobile routing architecture first. On mobile (<768px): use TanStack Router's route stack so "back" button works naturally. Pane 1 content → `/nav` route, Pane 2 content → `/folders` route, Pane 4 content → `/calls/$callId` route.
**Warning signs:** Testing on iPhone and the back button does nothing / wrong thing.

### Pitfall 6: Google Meet OAuth Scope Creep

**What goes wrong:** Google OAuth console shows existing Meet scopes; developer copies them to new project.
**Why it happens:** FOUND-09 — Google Meet integration is explicitly removed from v2. Copying the existing Google OAuth config from v1 would include Meet scopes.
**How to avoid:** Create a new Google OAuth client for v2. Do NOT copy OAuth scopes from v1. Start from zero scope set (only basic profile/email for Supabase Google auth).
**Warning signs:** Google OAuth consent screen mentions "View and manage your meetings."

### Pitfall 7: Fathom Analytics Site Key Not Updated

**What goes wrong:** Analytics data from v2 flows into v1's Fathom site, or analytics doesn't load.
**Why it happens:** FOUND-08 — Fathom site config references the old domain. A new Vercel project means a new domain.
**How to avoid:** Create a new Fathom site for the callvault.vercel.app domain (or the custom domain when it's ready). Add new `VITE_FATHOM_SITE_ID` env var to Vercel project.
**Warning signs:** Fathom dashboard shows the same domain tracking both v1 and v2, or 404 on Fathom script.

### Pitfall 8: React 19 + Radix UI Peer Dependency Conflicts at Install Time

**What goes wrong:** `pnpm install` shows peer dependency warnings or errors for Radix UI packages expecting React 18.
**Why it happens:** Radix UI resolved most React 19 compat issues by early 2025, but older installed versions may still flag this.
**How to avoid:** Use `--legacy-peer-deps` flag if needed during install. Verify installed Radix packages are latest versions (shadcn/ui CLI handles this automatically).
**Warning signs:** `WARN unresolved peer dependency react@^18` during pnpm install.

---

## Code Examples

Verified patterns from official sources and v1 analysis:

### Supabase Google Sign-In (Port from v1)
```typescript
// Source: v1 brain/src/pages/Login.tsx + Supabase docs
const handleGoogleSignIn = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/oauth/callback`,
    },
  })
  if (error) toast.error(error.message)
}
```

### AppShell — Direct Port from v1 (Adapted for TanStack Router)
```typescript
// Source: brain/src/components/layout/AppShell.tsx — adapt for v2
// Key changes: remove react-router-dom imports, use useBreakpointFlags from own hook
// Pane widths, transition durations, gap values — ALL identical to v1

export function AppShell({ children, config = {} }: AppShellProps) {
  const { isMobile, isTablet } = useBreakpointFlags()
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(!isTablet)
  const [isSecondaryOpen, setIsSecondaryOpen] = useState(true)

  return (
    <div className="h-full flex gap-3 overflow-hidden p-1">
      {/* PANE 1: NavRail — 220px / 72px */}
      {!isMobile && (
        <motion.nav
          animate={{ width: isSidebarExpanded ? 220 : 72 }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          className="relative flex-shrink-0 bg-card rounded-2xl border border-border/60 shadow-sm flex flex-col py-2 h-full z-10"
        >
          <SidebarToggle isExpanded={isSidebarExpanded} onToggle={() => setIsSidebarExpanded(v => !v)} />
          <SidebarNav isCollapsed={!isSidebarExpanded} />
        </motion.nav>
      )}
      {/* PANE 2: Secondary — 280px */}
      {/* PANE 3: Main Content — flex-1 */}
      {/* PANE 4: Detail — 360px / 320px tablet */}
    </div>
  )
}
```

### TanStack Router Auth Guard
```typescript
// Source: TanStack Router docs — beforeLoad redirect pattern
// src/routes/_authenticated.tsx — layout route for protected pages
import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'
import { supabase } from '@/lib/supabase'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      throw redirect({ to: '/login' })
    }
  },
  component: () => <Outlet />,
})
// Protected pages nest under this: src/routes/_authenticated/index.tsx
```

### shadcn/ui Link with TanStack Router
```typescript
// Source: TanStack Router docs — createLink pattern for shadcn/ui Button
import { createLink } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

const LinkButton = createLink(Button)

// Usage
<LinkButton to="/settings" variant="ghost">Settings</LinkButton>
```

### Color System Copy Instruction
```css
/* The COMPLETE color system from brain/src/index.css must be copied verbatim.
   Adapt for TailwindCSS v4 format:
   1. Wrap all HSL values in hsl(): --background: hsl(0 0% 100%)
   2. Remove the @tailwind base/components/utilities directives
   3. Add @import "tailwindcss" at top
   4. Add @import "tw-animate-css" for animation utilities
   5. Move all token definitions into :root and .dark blocks
   6. Add @theme inline block after for Tailwind utility class exposure
*/
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `framer-motion` package | `motion` package with `motion/react` import | 2024 | Same library, new canonical name; old package still works as alias |
| TailwindCSS `tailwind.config.js` | `@theme {}` in globals.css | TailwindCSS v4 (Jan 2025) | No JS config file; all design tokens in CSS |
| `tailwindcss-animate` | `tw-animate-css` | shadcn/ui v4 (Mar 2025) | Drop `@plugin 'tailwindcss-animate'`; add `@import 'tw-animate-css'` |
| React Router DOM | TanStack Router | Project decision (v2) | Type-safe routes, file-based routing, `beforeLoad` auth guards |
| CSS variable format `0 0% 100%` | `hsl(0 0% 100%)` | shadcn/ui + Tailwind v4 | Breaking change in how CSS vars are formatted |
| `@vitejs/plugin-react-swc` (repo archived Jul 2025) | Same package, moved to `vitejs/vite-plugin-react` monorepo | Jul 2025 | No API change; `npm install @vitejs/plugin-react-swc` still works |
| React 18 | React 19.2 (stable Oct 2025) | Dec 2024 stable, 19.2 Oct 2025 | `forwardRef` deprecated (Radix/shadcn handled); React Compiler available |
| Vite 5 | Vite 7 | Jun 2025 | Requires Node 20.19+; `baseline-widely-available` default target |

**Deprecated/outdated in v2:**
- `tailwindcss-animate`: Use `tw-animate-css` instead
- `react-router-dom`: Replaced by TanStack Router
- Google Meet OAuth scopes: FOUND-09 — explicitly removed
- `/bank/`, `/vault/`, `/hub/` route paths: Must 404 or redirect in v2
- v1's `Layout.tsx` `usesCustomLayout` pattern: Not needed; AppShell is the only layout in v2

---

## Open Questions

1. **Custom domain for v2 at launch**
   - What we know: New Vercel project will get a `.vercel.app` subdomain initially
   - What's unclear: Whether a custom domain (callvault.ai or similar) launches with v2, which affects Supabase URL configuration and Fathom setup
   - Recommendation: Plan for `.vercel.app` domain first; document custom domain as a separate post-launch task (FOUND-07 applies to whatever domain ships)

2. **Zoom OAuth callback URL for new domain**
   - What we know: FOUND-08 requires Zoom OAuth app to be audited for callback URLs
   - What's unclear: Whether v2 ships with Zoom integration active from day 1, or if import hub routes exist as stubs only
   - Recommendation: Wire the import routes as placeholder pages in Foundation; Zoom OAuth config update is a verification task, not a code task

3. **Supabase types.ts currency**
   - What we know: `brain/src/integrations/supabase/types.ts` reflects the current database schema
   - What's unclear: Whether schema has changed since that file was last generated; it's auto-generated via Supabase CLI
   - Recommendation: Re-generate types before coding (`supabase gen types typescript`) to ensure currency; copy the fresh output to `callvault/src/types/supabase.ts`

4. **Driver.js CSS styling compatibility with shadcn/ui themes**
   - What we know: Driver.js ships its own `driver.css` which will conflict with dark mode
   - What's unclear: How much CSS override work is needed to make driver.js tooltips match the CallVault design system
   - Recommendation: Import `driver.js/dist/driver.css` and then override with CSS custom properties to match brand colors; this is expected work, not a blocker

5. **React 19 + React Compiler opt-in**
   - What we know: React 19 ships with the React Compiler as an optional Babel plugin
   - What's unclear: Whether to enable the React Compiler in v2 from day 1 (eliminates most useMemo/useCallback)
   - Recommendation: Start without the React Compiler (not required); add it in a later phase as an optimization. Reduces initial setup complexity.

---

## Sources

### Primary (HIGH confidence)
- [vite.dev/blog/announcing-vite7](https://vite.dev/blog/announcing-vite7) — Vite 7 release notes: Node requirements, browser target, Rolldown
- [react.dev/versions](https://react.dev/versions) + [react.dev/blog/2024/12/05/react-19](https://react.dev/blog/2024/12/05/react-19) — React 19 stable release timeline
- [ui.shadcn.com/docs/tailwind-v4](https://ui.shadcn.com/docs/tailwind-v4) — shadcn/ui TailwindCSS v4 migration: CSS variable format, tw-animate-css
- [ui.shadcn.com/docs/installation/tanstack-router](https://ui.shadcn.com/docs/installation/tanstack-router) — Official shadcn/ui + TanStack Router integration
- [tanstack.com/router/v1/docs](https://tanstack.com/router/v1/docs/framework/react/installation/with-vite) — TanStack Router Vite setup
- `brain/src/components/layout/AppShell.tsx` — Direct source for pane widths, transition values, responsive behavior
- `brain/src/index.css` — Authoritative color system and CSS variable definitions
- `brain/src/integrations/supabase/client.ts` — Supabase client config pattern
- `brain/src/stores/panelStore.ts`, `preferencesStore.ts` — Zustand v5 store patterns

### Secondary (MEDIUM confidence)
- [motion.dev](https://motion.dev/docs/react-installation) — Motion package installation and `motion/react` import path
- [driverjs.com](https://driverjs.com) — Driver.js MIT license, React integration, step API
- [supabase.com/docs/guides/auth/redirect-urls](https://supabase.com/docs/guides/auth/redirect-urls) — Redirect allowlist configuration
- [github.com/vitejs/vite-plugin-react](https://github.com/vitejs/vite-plugin-react/tree/main/packages/plugin-react-swc) — SWC plugin moved to monorepo (Jul 2025)

### Tertiary (LOW confidence)
- WebSearch results on React 19 Radix UI peer dependency issues — multiple sources agree issues are resolved as of early 2025, but needs verification during actual install
- WebSearch on Driver.js + dark mode CSS override complexity — community reports it's workable, but specific effort unknown until attempted

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against official docs, multiple sources, current npm versions
- Architecture: HIGH — directly derived from v1 codebase analysis (live working code) + TanStack Router official docs
- Pitfalls: HIGH — most pitfalls verified from official migration guides (shadcn/ui v4, Supabase redirect docs); FOUND-07/08/09 are explicit requirements from the roadmap
- Tour/onboarding: MEDIUM — Driver.js is well-documented but dark mode integration effort is estimated, not verified
- Mobile stack navigation: MEDIUM — requirement is clear; exact TanStack Router route structure for mobile-first pane navigation needs design before task decomposition

**Research date:** 2026-02-27
**Valid until:** 2026-03-29 (30 days — stack is stable; Tailwind v4 and React 19 are mature releases)
