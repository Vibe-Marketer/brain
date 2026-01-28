# Architecture

**Analysis Date:** 2026-01-26

## Pattern Overview

**Overall:** Client-Server Architecture (BaaS)
This application follows a modern React architecture using Supabase as a Backend-as-a-Service (BaaS). The frontend handles all presentation and state management, communicating directly with Supabase for data persistence and authentication.

**Key Characteristics:**
- **Store-Driven State:** Logic is centralized in Zustand stores, keeping components clean.
- **Service Layer Abstraction:** API interactions are encapsulated in `src/lib`, separating business logic from UI.
- **Optimistic Updates:** Stores implement optimistic updates for immediate UI feedback.

## Layers

**UI Layer:**
- Purpose: Presentation and user interaction
- Location: `src/components`, `src/pages`
- Contains: React components, hooks
- Depends on: Stores (`src/stores`), Contexts (`src/contexts`)
- Used by: End users

**State Management Layer:**
- Purpose: Global state and business logic coordination
- Location: `src/stores`
- Contains: Zustand stores (state, actions, selectors)
- Depends on: Service Layer (`src/lib`)
- Used by: UI Layer

**Service/Logic Layer:**
- Purpose: Business logic, API calls, and data transformations
- Location: `src/lib`
- Contains: Utility functions, API clients, type definitions
- Depends on: Data Layer (`src/integrations/supabase`)
- Used by: State Management Layer

**Data Layer:**
- Purpose: Data persistence, authentication, and real-time subscriptions
- Location: `src/integrations/supabase`
- Contains: Supabase client, generated types
- Depends on: External Supabase API
- Used by: Service Layer

## Data Flow

**Standard Operation:**

1. **Trigger:** User interacts with UI (e.g., clicks "Save").
2. **Action:** Component calls a Store Action (e.g., `store.saveContentItem`).
3. **Logic:** Store Action calls a Service Function (e.g., `saveContent` in `src/lib`).
4. **Network:** Service Function calls Supabase Client.
5. **State Update:** Store updates state (often optimistically before network call completes).
6. **Render:** Components subscribed to the store re-render with new state.

**State Management:**
- **Zustand** is the primary state manager for feature-specific data (e.g., `contentLibraryStore.ts`).
- **React Query** (`@tanstack/react-query`) is used for some server-state caching and synchronization.
- **Context API** is used for global app-wide concerns like Auth (`AuthContext`) and Theme (`ThemeContext`).

## Key Abstractions

**Stores:**
- Purpose: Encapsulate feature state and actions
- Examples: `src/stores/contentLibraryStore.ts`, `src/stores/transcriptStore.ts`
- Pattern: Zustand `create` with typed State and Actions interfaces.

**Service Modules:**
- Purpose: Group related business logic and API operations
- Examples: `src/lib/content-library.ts`, `src/lib/auth-utils.ts`
- Pattern: Exported async functions returning `{ data, error }` objects.

**Components:**
- Purpose: Reusable UI elements
- Examples: `src/components/ui` (shadcn/ui), `src/components/content-library`
- Pattern: Functional components with typed props.

## Entry Points

**Application Root:**
- Location: `src/main.tsx`
- Triggers: Browser page load
- Responsibilities: Mounts React root, initializes Sentry.

**Router:**
- Location: `src/App.tsx`
- Triggers: URL changes
- Responsibilities: Defines routes, wraps app in providers (QueryClient, Auth, Theme).

## Error Handling

**Strategy:** Centralized error reporting via Sentry, local error state in stores.

**Patterns:**
- **Result Objects:** Service functions return `{ data, error }` tuples instead of throwing (mostly).
- **Store Error State:** Stores maintain `error` string/object to display UI feedback.
- **Error Boundaries:** `src/components/ErrorBoundary` wraps the app to catch render crashes.

## Cross-Cutting Concerns

**Logging:**
- Approach: Custom logger module `src/lib/logger` wrapping console and Sentry.

**Validation:**
- Approach: Manual validation in Service Layer (e.g., checking length limits) or Zod schemas.

**Authentication:**
- Approach: Supabase Auth managed via `src/contexts/AuthContext`.
- Protection: `ProtectedRoute` component wraps private routes in `src/App.tsx`.

---

*Architecture analysis: 2026-01-26*
