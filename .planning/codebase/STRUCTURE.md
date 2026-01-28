# Codebase Structure

**Analysis Date:** 2026-01-26

## Directory Layout

```
src/
├── components/         # React components (UI and Feature-specific)
├── contexts/           # React Context providers (Auth, Theme)
├── hooks/              # Custom React hooks
├── integrations/       # External service integrations (Supabase)
├── lib/                # Business logic, utilities, and API functions
├── pages/              # Route-level page components
├── stores/             # Zustand state stores
├── types/              # TypeScript type definitions
├── App.tsx             # Main router and provider setup
└── main.tsx            # Application entry point
```

## Directory Purposes

**src/components:**
- Purpose: Reusable UI elements and feature-specific blocks.
- Contains: `ui` (generic primitives), `[feature-name]` (domain components).
- Key files: `src/components/ui/button.tsx`, `src/components/Layout.tsx`.

**src/lib:**
- Purpose: Core logic decoupled from UI.
- Contains: API helpers, data transformation, validation.
- Key files: `src/lib/utils.ts`, `src/lib/supabase.ts`.

**src/stores:**
- Purpose: Global state management.
- Contains: Zustand store definitions.
- Key files: `src/stores/contentLibraryStore.ts`.

**src/pages:**
- Purpose: High-level views corresponding to routes.
- Contains: Page components that assemble other components.
- Key files: `src/pages/Login.tsx`, `src/pages/ContentHub.tsx`.

## Key File Locations

**Entry Points:**
- `src/main.tsx`: Bootstraps the React application.
- `src/App.tsx`: Defines the routing structure.

**Configuration:**
- `src/integrations/supabase/client.ts`: Supabase client configuration.
- `vite.config.ts`: Build and dev server configuration.

**Core Logic:**
- `src/lib/*.ts`: Domain-specific logic modules (e.g., `content-library.ts`).

**Testing:**
- `src/**/*.test.ts`: Co-located unit tests (implied pattern).
- `e2e/`: Playwright end-to-end tests.

## Naming Conventions

**Files:**
- React Components: `PascalCase.tsx` (e.g., `ContentLibraryPage.tsx`).
- Utilities/Logic: `camelCase.ts` (e.g., `content-library.ts`).
- Stores: `camelCaseStore.ts` (e.g., `contentLibraryStore.ts`).

**Directories:**
- General: `kebab-case` (e.g., `content-library`, `call-detail`).
- `src/components/ui`: Reserved for shadcn/ui components.

## Where to Add New Code

**New Feature:**
1. **State:** Create `src/stores/[feature]Store.ts`.
2. **Logic:** Create `src/lib/[feature].ts` for API/business logic.
3. **Components:** Create `src/components/[feature]/` directory.
4. **Page:** Create `src/pages/[PageName].tsx` and add to `src/App.tsx`.

**New Component/Module:**
- **Shared UI:** Add to `src/components/ui` (if generic) or `src/components/shared`.
- **Feature Component:** Add to `src/components/[feature-name]/`.

**Utilities:**
- **Shared Helpers:** Add to `src/lib/utils.ts` or create new `src/lib/[topic].ts` if complex.

## Special Directories

**src/integrations/supabase:**
- Purpose: Supabase specific configuration and types.
- Generated: Types are often generated here (`types.ts`).

**src/components/ui:**
- Purpose: Base UI components (shadcn/ui).
- Note: Often managed via CLI, modify with care.

---

*Structure analysis: 2026-01-26*
