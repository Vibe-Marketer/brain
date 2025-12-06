# CallVault Architecture

## Overview

CallVault is a meeting intelligence platform that syncs with Fathom to process call transcripts, categorize meetings, and provide analytics. The application follows a client-server architecture with a React frontend and Supabase Edge Functions backend.

## Tech Stack

### Frontend
- **React** 18.3.1 - UI framework
- **TypeScript** 5.8.3 - Type safety
- **Vite** 5.4.19 - Build tool and dev server
- **TanStack Query** 5.83.0 - Server state management
- **TanStack Table** 8.21.3 - Table management
- **Tailwind CSS** 3.4.17 - Styling
- **Tremor** 3.18.7 - Charts and analytics
- **Radix UI** - Accessible primitives (dialog, dropdown, tabs, etc.)
- **Remix Icon** 4.7.0 - Icon system
- **React Router DOM** - Client-side routing
- **React Hook Form** 7.61.1 - Form handling

### Backend
- **Supabase Edge Functions** - Serverless Deno runtime
- **Supabase Database** - PostgreSQL
- **Supabase Auth** - Authentication

### External Integrations
- **Fathom API** - Meeting data source
- **OpenAI API** - AI processing for transcripts

## Directory Structure

### Top-Level Layout
```
conversion-brain/
├── src/                    # Frontend React application
├── supabase/              # Backend Edge Functions
│   └── functions/         # 32 serverless functions
├── docs/                  # Documentation
│   ├── adr/              # Architecture Decision Records
│   ├── ai_docs/          # AI agent reference docs
│   └── claude-code-workflows/  # Code review workflows
├── docs/              # Design guidelines and references
├── public/               # Static assets
├── .github/              # GitHub config and Copilot instructions
├── .lovable/             # Lovable AI config
├── .roo/                 # Roo AI config
└── PRPs/                 # Product Requirements Proposals
```

### Frontend Structure (`src/`)
```
src/
├── App.tsx               # Root component with routing
├── main.tsx              # Entry point
├── index.css             # Global styles and Tailwind
├── vite-env.d.ts         # Vite type declarations
│
├── pages/                # Route components (5 pages)
│   ├── Login.tsx         # Authentication
│   ├── Settings.tsx      # Configuration UI
│   ├── TranscriptsNew.tsx # Main transcript view
│   ├── OAuthCallback.tsx # OAuth flow handler
│   └── NotFound.tsx      # 404 page
│
├── components/           # UI components (90 files)
│   ├── ui/              # Base UI primitives (54 files)
│   │   ├── button.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   └── ...
│   ├── transcripts/     # Tab components (10 files)
│   │   ├── TranscriptsTab.tsx
│   │   ├── SyncTab.tsx
│   │   ├── AnalyticsTab.tsx
│   │   └── ...
│   ├── transcript-library/  # Shared transcript components (13 files)
│   │   ├── TranscriptTable.tsx
│   │   ├── TremorFilterBar.tsx
│   │   ├── BulkActionToolbarEnhanced.tsx
│   │   └── ...
│   ├── Layout.tsx       # App shell
│   ├── ProtectedRoute.tsx
│   ├── CallDetailDialog.tsx
│   └── ...
│
├── hooks/               # Custom React hooks (8 files)
│   ├── useMeetingsSync.ts    # Main sync logic
│   ├── useCallAnalytics.ts   # Analytics queries
│   ├── useCategorySync.ts    # Category management
│   ├── useTableSort.ts       # Table sorting
│   ├── useDragAndDrop.ts     # DnD functionality
│   ├── useVibeGreenValidator.ts  # Brand validation
│   ├── use-toast.ts          # Toast notifications
│   └── use-mobile.tsx        # Mobile detection
│
├── lib/                 # Utilities (12 files)
│   ├── api-client.ts    # Edge Function caller
│   ├── query-config.ts  # TanStack Query keys/defaults
│   ├── filter-utils.ts  # Filtering logic
│   ├── export-utils.ts  # Export functionality
│   ├── fathom.ts        # Fathom API helpers
│   ├── logger.ts        # Logging utility
│   ├── validations.ts   # Form validations
│   ├── utils.ts         # General utilities (cn, etc.)
│   └── __tests__/       # Unit tests
│
├── contexts/            # React contexts (3 files)
│   ├── AuthContext.tsx  # Authentication state
│   ├── ThemeContext.tsx # Dark/light mode
│   └── PaneContext.tsx  # Pane system state
│
├── integrations/        # External service clients
│   └── supabase/
│       ├── client.ts    # Supabase client init
│       └── types.ts     # Generated database types
│
└── assets/              # Static assets
    └── icons/           # SVG icons
```

### Backend Structure (`supabase/functions/`)
```
supabase/functions/
├── _shared/             # Shared utilities across functions
│
├── Core Meeting Operations (6)
│   ├── fetch-meetings/
│   ├── fetch-single-meeting/
│   ├── sync-meetings/
│   ├── webhook/
│   ├── resync-all-calls/
│   └── delete-all-calls/
│
├── AI Processing (5)
│   ├── process-call-ai/
│   ├── process-ai-jobs/
│   ├── ai-analyze-transcripts/
│   ├── auto-tag-call/
│   └── generate-call-title/
│
├── OAuth/Auth (3)
│   ├── fathom-oauth-url/
│   ├── fathom-oauth-callback/
│   └── fathom-oauth-refresh/
│
├── Configuration (5)
│   ├── get-config-status/
│   ├── save-fathom-key/
│   ├── save-host-email/
│   ├── save-webhook-secret/
│   └── create-fathom-webhook/
│
├── Testing (6)
│   ├── test-fathom-connection/
│   ├── test-oauth-connection/
│   ├── test-webhook/
│   ├── test-webhook-endpoint/
│   ├── test-webhook-connection/
│   └── test-webhook-signature/
│
├── Data Operations (3)
│   ├── delete-account/
│   ├── enrich-speaker-emails/
│   └── test-env-vars/
│
└── Delivery/Sharing (4)
    ├── deliver-via-email/
    ├── deliver-to-slack/
    ├── create-share-link/
    └── upload-knowledge-file/
```

## Core Architecture Patterns

### Data Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌──────────┐
│   React UI  │ ──▶ │ TanStack     │ ──▶ │ Supabase Edge   │ ──▶ │ Supabase │
│  Component  │     │ Query Hook   │     │ Function        │     │ Database │
└─────────────┘     └──────────────┘     └─────────────────┘     └──────────┘
       ▲                   │                      │
       │                   │                      │
       └───────────────────┴──────────────────────┘
                    Response Flow
```

1. **UI Action**: User interacts with component
2. **Query/Mutation**: TanStack Query hook calls api-client
3. **Edge Function**: Supabase function processes request
4. **Database**: PostgreSQL handles data persistence
5. **Response**: Data flows back through the stack

### State Management

- **Server State**: TanStack Query manages all server data
- **UI State**: React hooks and contexts (no Redux/Zustand)
- **Auth State**: `AuthContext` with Supabase Auth
- **Theme State**: `ThemeContext` with next-themes

### Query Configuration
**Reference**: `src/lib/query-config.ts`

```typescript
export const queryKeys = {
  meetings: {
    all: ['meetings'] as const,
    lists: () => [...queryKeys.meetings.all, 'list'] as const,
    detail: (id: number) => [...queryKeys.meetings.details(), id] as const,
  },
  categories: { /* ... */ },
  syncJobs: { /* ... */ },
};

export const queryDefaults = {
  static: { staleTime: 5 * 60 * 1000 },    // 5 min (categories)
  dynamic: { staleTime: 30 * 1000 },        // 30s (meetings)
  realtime: { staleTime: 0 },               // Always fresh
  userSpecific: { staleTime: 2 * 60 * 1000 }, // 2 min
};
```

### API Client Pattern
**Reference**: `src/lib/api-client.ts`

```typescript
export async function callEdgeFunction<T>(
  functionName: string,
  body?: any,
  options?: { retry?: boolean; maxRetries?: number }
): Promise<ApiResponse<T>> {
  const { data, error } = await supabase.functions.invoke(functionName, { body });
  // Error handling, retry logic
  return { data };
}

// Example usage
export async function fetchMeetings(params) {
  return callEdgeFunction('fetch-meetings', params);
}
```

### Edge Function Pattern
**Reference**: `supabase/functions/*/index.ts`

```typescript
Deno.serve(async (req) => {
  // CORS handling
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Main logic
    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
```

## Application Routes

| Route | Component | Protection | Purpose |
|-------|-----------|------------|---------|
| `/` | TranscriptsNew | Protected | Main transcript view |
| `/settings` | Settings | Protected | Configuration |
| `/login` | Login | Public | Authentication |
| `/oauth/callback` | OAuthCallback | Public | OAuth flow |
| `*` | NotFound | Public | 404 handling |

## Component Organization

### Folder Separation Logic

**`src/components/transcripts/`** - Tab-level page components
- Complete tab views (TranscriptsTab, SyncTab, AnalyticsTab)
- Tab-specific child components (StatItem, DonutChartCard)
- Direct children of the main page

**`src/components/transcript-library/`** - Reusable components
- Shared across multiple tabs (TranscriptTable, BulkActionToolbarEnhanced)
- Dialogs (CategoryManagementDialog, ResyncConfirmDialog)
- Filter components (TremorFilterBar, FilterPill)

**`src/components/ui/`** - Base UI primitives
- Radix-based components (dialog, dropdown-menu)
- Custom styled components (button, badge)
- shadcn/ui pattern

## Configuration

### Environment Variables

**Client-side (VITE_)**:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
VITE_SUPABASE_PROJECT_ID=your_project_id
```

**Server-side (Edge Functions)**:
```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
```

**User-configured (stored in database)**:
- Fathom API Key (user_settings table)
- Webhook Secret (app_config table)
- Host Email (app_config table)

### Build Configuration

**Vite** (`vite.config.ts`):
- React SWC plugin for fast builds
- Path alias `@/` → `src/`

**TypeScript** (`tsconfig.app.json`):
- Strict mode enabled
- Path mapping for `@/`

**Tailwind** (`tailwind.config.ts`):
- Custom design tokens
- Tremor integration
- Dark mode support

## Testing

### Test Location
```
src/lib/__tests__/
├── filter-utils.test.ts
└── ai-agent-system.test.ts
```

### Test Framework
- **Vitest** - Test runner (configured in `vitest.config.ts`)
- Tests co-located with code in `__tests__` folders

### Running Tests
```bash
npm run test
```

## Architecture Decision Records

### Location
`docs/adr/`

### Current ADRs
- `adr-001-vercel-ai-sdk.md` - AI SDK choice
- `adr-002-remix-icon.md` - Icon system choice

### When to Create ADR
- Database schema changes
- Major dependency changes
- Architecture pattern decisions
- Integration choices

### ADR Process
1. Copy `docs/adr/adr-template.md`
2. Fill in Context, Decision, Consequences
3. Save as `adr-XXX-title.md`
4. Update `docs/adr/README.md`

## Key Architectural Decisions

### No WebSockets
HTTP polling with TanStack Query's `refetchInterval` instead of real-time subscriptions. Simpler architecture, sufficient for current needs.

### Query-First State
TanStack Query is the single source of truth for server state. No separate state management library needed.

### Direct Database Values
No translation layers. Database values (e.g., `"todo"`, `"doing"`) used directly in UI.

### Supabase Edge Functions
All backend logic in Deno-based Edge Functions. No traditional server. Benefits:
- Auto-scaling
- No infrastructure management
- TypeScript/Deno runtime
- Built-in Supabase client

### Component Library
Radix UI primitives + custom styling (shadcn pattern). Not using a full component library like Material UI.

## Deployment

### Development
```bash
# Frontend
npm run dev

# Edge Functions (local)
supabase functions serve
```

### Production
- Frontend: Lovable cloud deployment
- Backend: Supabase managed Edge Functions
- Database: Supabase managed PostgreSQL

## Performance Optimizations

### Query Deduplication
Same query key = single request. TanStack Query handles automatically.

### Smart Caching
Different stale times per data type:
- Static data (categories): 5 minutes
- Dynamic data (meetings): 30 seconds
- Real-time data (sync jobs): 0 (always fresh)

### Retry Logic
Exponential backoff in api-client with configurable max retries.

## Security

### Authentication
- Supabase Auth with email/password
- Protected routes via `ProtectedRoute` component
- Session management in `AuthContext`

### API Security
- Row Level Security (RLS) in Supabase
- Service role key only in Edge Functions
- Publishable key in client (safe)

### Secrets
- Never commit `.env` files
- User secrets stored in database
- Server secrets in Supabase dashboard

## Code Quality

### Linting
- ESLint with React hooks plugin
- TypeScript strict mode

### Code Review Workflows
- `/code-review` - Comprehensive review
- `/security-review` - Security analysis
- `/design-review` - UI/UX validation

### Documentation
- `CLAUDE.md` - AI agent instructions
- `docs/architecture/` - Codebase conventions
- `docs/` - Design guidelines

## Quick Reference Tables

### Layer Summary

| Layer | Location | Technology | Purpose |
|-------|----------|------------|---------|
| UI | `src/pages/`, `src/components/` | React, Tailwind | User interface |
| State | `src/hooks/`, `src/contexts/` | TanStack Query | Data management |
| API Client | `src/lib/api-client.ts` | Fetch | Function caller |
| Backend | `supabase/functions/` | Deno | Business logic |
| Database | Supabase | PostgreSQL | Persistence |
| Auth | Supabase Auth | JWT | Authentication |

### File Counts

| Category | Count |
|----------|-------|
| Pages | 5 |
| Components (total) | 90 |
| UI primitives | 54 |
| Hooks | 8 |
| Lib utilities | 12 |
| Edge Functions | 32 |
| Contexts | 3 |

### Key Files

| Purpose | File |
|---------|------|
| App entry | `src/App.tsx` |
| API client | `src/lib/api-client.ts` |
| Query config | `src/lib/query-config.ts` |
| Auth context | `src/contexts/AuthContext.tsx` |
| Supabase client | `src/integrations/supabase/client.ts` |
| DB types | `src/integrations/supabase/types.ts` |

## Known Patterns and Conventions

### Naming
- See `docs/architecture/api-naming-conventions.md` for complete reference

### Component Patterns
- Functional components only
- Custom hooks for reusable logic
- Props destructuring with TypeScript interfaces

### Import Patterns
```typescript
// Use @ alias
import { Button } from "@/components/ui/button";
import { useMeetingsSync } from "@/hooks/useMeetingsSync";
import { supabase } from "@/integrations/supabase/client";
```

## Future Considerations

- Server-Sent Events for real-time updates
- Code splitting for large components
- E2E testing with Playwright
- GraphQL for selective field queries

## See Also

- **API Conventions**: `docs/architecture/api-naming-conventions.md`
- **Brand Guidelines**: `docs/design/brand-guidelines-v3.3.md`
- **Design Principles**: `docs/design/design-principles-conversion-brain.md`
- **Data Fetching**: `docs/architecture/DATA_FETCHING_architecture.md`
