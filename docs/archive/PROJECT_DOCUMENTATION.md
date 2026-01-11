# CallVault™ - Complete Project Documentation

**Version:** 1.0.0
**Last Updated:** 2025-11-24
**Status:** Production Ready

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Component Architecture](#component-architecture)
6. [API Reference](#api-reference)
7. [Database Schema](#database-schema)
8. [Development Guide](#development-guide)
9. [Deployment](#deployment)
10. [Code Quality](#code-quality)

---

## Project Overview

### What is CallVault?

CallVault is an AI-powered Meeting Intelligence System that automatically transforms meetings into actionable assets. It ingests call transcripts from Fathom (with Zoom and other platforms coming soon), intelligently classifies meetings, and generates marketing content, CRM intelligence, client health insights, and follow-ups.

### Key Features

| Feature | Description | Status |
|---------|-------------|--------|
| **Smart Meeting Classification** | Automatic detection of meeting types (sales, coaching, demo, community, support) | ✅ Live |
| **PROFITS Framework Extraction** | Extracts Pain, Results, Obstacles, Fears, Identity, Triggers, Success | ✅ Live |
| **Automated Follow-Ups** | Context-aware, personalized follow-up email generation | ✅ Live |
| **Content Generation** | Social media posts, blog outlines, testimonials | 🚧 In Progress |
| **Client Intelligence** | Sentiment tracking, engagement, health scores | 🚧 In Progress |
| **Searchable Library** | Organized, tagged, searchable transcript archive | ✅ Live |

### Project Statistics

- **Total Files:** 147 TypeScript/TSX files
- **Components:** 111 React components
- **Edge Functions:** 17 serverless functions
- **Documentation:** 163 markdown files
- **Dependencies:** 44 production, 13 development
- **Lines of Code:** ~50,000 lines

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND LAYER                           │
│  React 18 + TypeScript + Vite (Port 8080)                       │
│  - Pages: TranscriptsNew, Settings, Login                       │
│  - Components: 111 reusable UI components                       │
│  - State: React Query + Context API                             │
└─────────────────────────────────────────────────────────────────┘
                               ↕
┌─────────────────────────────────────────────────────────────────┐
│                       API CLIENT LAYER                           │
│  Centralized API communication (src/lib/api-client.ts)          │
│  - Automatic retry with exponential backoff                     │
│  - Consistent error handling                                    │
│  - Type-safe responses via ApiResponse<T>                       │
└─────────────────────────────────────────────────────────────────┘
                               ↕
┌─────────────────────────────────────────────────────────────────┐
│                     EDGE FUNCTIONS LAYER                         │
│  Supabase Edge Functions (Deno Runtime)                         │
│  - 17 serverless functions                                      │
│  - Webhook processing, OAuth, data sync                         │
│  - Fathom API integration                                       │
└─────────────────────────────────────────────────────────────────┘
                               ↕
┌─────────────────────────────────────────────────────────────────┐
│                       DATABASE LAYER                             │
│  Supabase PostgreSQL + Row Level Security                       │
│  - fathom_calls, fathom_transcripts                            │
│  - user_settings, call_categories                              │
│  - webhook_deliveries, sync_jobs                               │
└─────────────────────────────────────────────────────────────────┘
                               ↕
┌─────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES                           │
│  - Fathom API (meeting data source)                            │
│  - Vercel AI SDK (LLM integration)                             │
│  - Supabase Auth (authentication)                              │
└─────────────────────────────────────────────────────────────────┘
```

### API Communication Flow

```
User Action → Frontend Component → React Hook → API Client
    ↓
API Client → Edge Function (with retry logic)
    ↓
Edge Function → Supabase Database (with RLS)
    ↓
Database → Response → Edge Function
    ↓
Edge Function → API Client → React Hook → Component Update
```

### Authentication Flow

```
1. User Login → Supabase Auth
2. Session Token → Stored in localStorage
3. Protected Routes → Check AuthContext
4. API Requests → Include session token in headers
5. RLS Policies → Validate user_id on all queries
```

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|-----------|---------|---------|
| **Vite** | 5.4.19 | Build tool and dev server |
| **React** | 18.3.1 | UI framework |
| **TypeScript** | 5.8.3 | Type safety |
| **React Router** | 6.30.1 | Client-side routing |
| **React Query** | 5.90.10 | Server state management |
| **Tailwind CSS** | 3.4.18 | Styling framework |

### UI Components

| Library | Purpose |
|---------|---------|
| **Radix UI** | Unstyled accessible components |
| **shadcn-ui** | Pre-built components (Radix + Tailwind) |
| **Remix Icon** | Icon library (3,100+ icons) |
| **Recharts** | Data visualization |
| **Tremor React** | Analytics components |
| **Framer Motion** | Animations |

### Backend

| Technology | Purpose |
|-----------|---------|
| **Supabase** | Backend-as-a-Service |
| **PostgreSQL** | Relational database |
| **Deno** | Edge Functions runtime |
| **Supabase Auth** | Authentication & authorization |

### Developer Tools

| Tool | Purpose |
|------|---------|
| **ESLint** | Code linting |
| **Prettier** | Code formatting (via Tailwind) |
| **TypeScript Compiler** | Type checking |
| **Vitest** | Unit testing |

---

## Project Structure

```
brain/
├── .claude/                  # Claude AI configuration
│   ├── agents/              # Custom agent configurations
│   └── commands/            # Slash command definitions
├── .github/                 # GitHub workflows
├── docs/                    # Documentation
│   ├── adr/                 # Architecture Decision Records (10+)
│   ├── architecture/        # System architecture docs
│   ├── design/              # Brand guidelines & design system
│   ├── fathom-connection/   # Fathom integration guides
│   └── reference/           # Reference documentation
├── PRPs/                    # Project Requirements & Planning
│   ├── reports/             # Analysis reports
│   ├── reviews/             # Code review reports
│   └── templates/           # PRP templates
├── public/                  # Static assets
├── scripts/                 # Build and utility scripts
├── src/                     # Source code
│   ├── assets/              # Images, fonts
│   ├── components/          # React components (111 files)
│   │   ├── ui/              # shadcn-ui base components (48)
│   │   ├── transcripts/     # Transcript-specific (8)
│   │   ├── transcript-library/  # Library features (15)
│   │   ├── call-detail/     # Call detail views (6)
│   │   ├── settings/        # Settings pages (5)
│   │   └── [other]/         # Various feature components
│   ├── contexts/            # React Context providers (3)
│   │   ├── AuthContext.tsx
│   │   ├── ThemeContext.tsx
│   │   └── PaneContext.tsx
│   ├── hooks/               # Custom React hooks (8)
│   ├── integrations/        # External service integrations
│   │   └── supabase/        # Supabase client & types
│   ├── lib/                 # Utility libraries
│   │   ├── api-client.ts    # Centralized API communication
│   │   ├── logger.ts        # Logging utility
│   │   ├── fathom.ts        # Fathom API helpers
│   │   └── [others]         # Various utilities
│   ├── pages/               # Route components (7)
│   │   ├── TranscriptsNew.tsx  # Main transcript library
│   │   ├── Settings.tsx        # Settings dashboard
│   │   ├── Login.tsx           # Authentication
│   │   └── [others]
│   ├── App.tsx              # Root application component
│   └── main.tsx             # Application entry point
├── supabase/
│   ├── functions/           # Edge Functions (17)
│   │   ├── _shared/         # Shared utilities (CORS, etc.)
│   │   ├── fetch-meetings/  # Fetch meetings from Fathom
│   │   ├── sync-meetings/   # Bulk sync meetings
│   │   ├── webhook/         # Webhook handler
│   │   ├── *-oauth-*/       # OAuth flow functions
│   │   └── [others]/        # Various API endpoints
│   └── migrations/          # Database migration SQL files (40+)
├── CLAUDE.md                # Claude development instructions (810 lines)
├── WARP.md                  # AI assistant development guide
├── README.md                # Project overview
├── CLEANUP_REPORT.md        # Code cleanup analysis
├── package.json             # Dependencies & scripts
├── tsconfig.json            # TypeScript configuration
├── tailwind.config.ts       # Tailwind CSS configuration
└── vite.config.ts           # Vite configuration
```

---

## Component Architecture

### Component Organization

Components are organized by feature and responsibility:

```
components/
├── ui/                      # Base UI primitives (shadcn-ui)
│   ├── button.tsx           # Button variants
│   ├── dialog.tsx           # Modal dialogs
│   ├── tabs.tsx             # Tab navigation
│   └── [48 more]...
├── transcripts/             # Transcript management
│   ├── TranscriptsTab.tsx   # Main transcript view (670 lines)
│   ├── SyncTab.tsx          # Sync interface (728 lines)
│   ├── SyncFilters.tsx      # Filtering controls
│   └── [5 more]...
├── transcript-library/      # Library features
│   ├── FilterBar.tsx        # Advanced filtering (270 lines)
│   ├── BulkActionToolbar.tsx  # Bulk operations
│   ├── DownloadPopover.tsx  # Export functionality
│   └── [12 more]...
├── call-detail/             # Call detail views
│   ├── CallDetailDialog.tsx # Main dialog (800 lines)
│   ├── CallTranscriptTab.tsx  # Transcript view
│   ├── CallOverviewTab.tsx  # Overview summary
│   └── [3 more]...
├── settings/                # Settings pages
│   ├── AccountTab.tsx       # Account settings (508 lines)
│   ├── AdminTab.tsx         # Admin dashboard (506 lines)
│   ├── FathomTab.tsx        # Fathom integration
│   └── [2 more]...
└── [other]/                 # Various features
    ├── WebhookAnalytics.tsx
    ├── WebhookDeliveryViewer.tsx
    ├── ManualCategorizeDialog.tsx
    └── [20+ more]...
```

### Key Components

#### 1. TranscriptsTab (670 lines)

**Location:** `src/components/transcripts/TranscriptsTab.tsx`
**Purpose:** Main transcript library interface with filtering, sorting, bulk actions

**Features:**

- Search and filter transcripts
- Bulk selection and actions
- Category management
- Export functionality
- Integration with SyncTab

#### 2. CallDetailDialog (800 lines)

**Location:** `src/components/CallDetailDialog.tsx`
**Purpose:** Comprehensive call detail view with transcript editing

**Features:**

- Full transcript display with timestamps
- Speaker editing and attribution
- Transcript trimming/deletion
- Resync from Fathom
- Export to multiple formats (TXT, MD, PDF, DOCX)

#### 3. SyncTab (728 lines)

**Location:** `src/components/transcripts/SyncTab.tsx`
**Purpose:** Meeting sync interface with Fathom integration

**Features:**

- Fetch meetings from Fathom
- Bulk sync with category pre-assignment
- Date range filtering
- Progress tracking
- Sync job monitoring

### Component Patterns

#### 1. Container/Presenter Pattern

```typescript
// Container (logic)
export function TranscriptsTab() {
  const { data, isLoading } = useQuery(...);
  const mutation = useMutation(...);

  return <TranscriptsView data={data} onAction={mutation.mutate} />;
}

// Presenter (UI)
export function TranscriptsView({ data, onAction }) {
  return <div>{/* Pure UI rendering */}</div>;
}
```

#### 2. Custom Hooks for Logic

```typescript
// hooks/useMeetingsSync.ts
export function useMeetingsSync() {
  const { data, error } = useQuery(['meetings'], fetchMeetings);
  const syncMutation = useMutation(syncMeetings);

  return { meetings: data, sync: syncMutation.mutate, error };
}
```

#### 3. Context for Global State

```typescript
// contexts/AuthContext.tsx
export const AuthContext = createContext<AuthState>({
  user: null,
  signIn: async () => {},
  signOut: async () => {}
});
```

---

## API Reference

### Edge Functions

All Edge Functions follow the naming convention: `kebab-case`

#### Authentication & OAuth

| Function | Purpose | Method |
|----------|---------|--------|
| `fathom-oauth-url` | Generate OAuth URL with PKCE | POST |
| `fathom-oauth-callback` | Handle OAuth callback, exchange code for token | POST |
| `fathom-oauth-refresh` | Refresh expired OAuth token | POST |
| `save-fathom-key` | Save Fathom API key (alternative to OAuth) | POST |
| `save-host-email` | Save user's host email for filtering | POST |
| `save-webhook-secret` | Save webhook secret for validation | POST |

#### Meeting Data

| Function | Purpose | Method |
|----------|---------|--------|
| `fetch-meetings` | Fetch meetings from Fathom API | POST |
| `fetch-single-meeting` | Fetch single meeting with full transcript | POST |
| `sync-meetings` | Bulk sync meetings to database | POST |
| `resync-all-calls` | Resync all existing calls from Fathom | POST |
| `delete-all-calls` | Delete all calls for a user | POST |

#### Webhooks

| Function | Purpose | Method |
|----------|---------|--------|
| `webhook` | Process incoming Fathom webhooks | POST |
| `create-fathom-webhook` | Register webhook with Fathom | POST |

#### Configuration & Testing

| Function | Purpose | Method |
|----------|---------|--------|
| `get-config-status` | Get user configuration status | GET |
| `test-fathom-connection` | Test Fathom API connection | POST |
| `test-secrets` | Test environment secrets | GET |
| `test-env-vars` | Test environment variables | GET |

### Frontend API Client

**Location:** `src/lib/api-client.ts`

All frontend functions follow the naming convention: `camelCase`

```typescript
// Example API client functions
export const fetchMeetings = async (params: FetchParams): Promise<ApiResponse<Meeting[]>>
export const syncMeetings = async (ids: number[]): Promise<ApiResponse<SyncResult>>
export const deleteCalls = async (ids: string[]): Promise<ApiResponse<void>>
export const completeFathomOAuth = async (code: string, state: string): Promise<ApiResponse<OAuthResult>>
```

#### API Response Type

```typescript
interface ApiResponse<T> {
  data?: T;
  error?: string;
}
```

### Naming Conventions Summary

| Pattern | Convention | Example |
|---------|------------|---------|
| Edge Function folders | kebab-case | `fetch-meetings/` |
| Frontend functions | camelCase | `fetchMeetings()` |
| React hooks | use + camelCase | `useMeetingsSync()` |
| Types/Interfaces | PascalCase | `Meeting`, `ApiResponse` |
| Database fields | snake_case | `recording_id` |
| Query keys | kebab-case arrays | `["call-transcripts", id]` |

---

## Database Schema

### Core Tables

#### `fathom_calls`

Stores meeting metadata from Fathom

```sql
CREATE TABLE fathom_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  recording_id INTEGER UNIQUE NOT NULL,
  title TEXT,
  summary TEXT,
  url TEXT,
  share_url TEXT,
  recording_start_time TIMESTAMPTZ,
  recording_end_time TIMESTAMPTZ,
  recorded_by_email TEXT,
  full_transcript TEXT,  -- Optimized: full transcript in single field
  calendar_invitees JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ,
  title_edited_by_user BOOLEAN DEFAULT FALSE,
  summary_edited_by_user BOOLEAN DEFAULT FALSE
);
```

#### `fathom_transcripts`

Stores individual transcript segments

```sql
CREATE TABLE fathom_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recording_id INTEGER REFERENCES fathom_calls(recording_id) ON DELETE CASCADE,
  speaker_name TEXT NOT NULL,
  speaker_email TEXT,
  text TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  edited_text TEXT,  -- User edits
  edited_speaker_name TEXT,
  edited_speaker_email TEXT,
  is_deleted BOOLEAN DEFAULT FALSE,  -- Soft delete for trimming
  edited_at TIMESTAMPTZ,
  edited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `user_settings`

User-specific configuration

```sql
CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  fathom_api_key TEXT,  -- Alternative to OAuth
  oauth_access_token TEXT,
  oauth_refresh_token TEXT,
  oauth_expires_at TIMESTAMPTZ,
  oauth_token_type TEXT DEFAULT 'Bearer',
  webhook_secret TEXT,
  host_email TEXT,  -- For filtering meetings
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `call_categories`

User-defined meeting categories

```sql
CREATE TABLE call_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  icon TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `call_category_assignments`

Many-to-many relationship between calls and categories

```sql
CREATE TABLE call_category_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_recording_id INTEGER REFERENCES fathom_calls(recording_id) ON DELETE CASCADE,
  category_id UUID REFERENCES call_categories(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(call_recording_id, category_id)
);
```

### Webhook & Sync Tables

#### `webhook_deliveries`

Tracks incoming webhook deliveries

```sql
CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id TEXT NOT NULL,  -- From X-Webhook-ID header
  recording_id INTEGER,
  status TEXT NOT NULL,  -- 'success', 'duplicate', 'failed'
  payload JSONB,
  signature_valid BOOLEAN,
  error_message TEXT,
  processed_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `sync_jobs`

Tracks bulk sync operations

```sql
CREATE TABLE sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,  -- 'pending', 'processing', 'completed', 'failed'
  type TEXT DEFAULT 'sync',
  recording_ids INTEGER[],
  progress_current INTEGER DEFAULT 0,
  progress_total INTEGER DEFAULT 0,
  synced_ids INTEGER[],
  failed_ids INTEGER[],
  error TEXT,
  metadata JSONB,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Row Level Security (RLS)

All tables have RLS policies that restrict access to authenticated users' own data:

```sql
-- Example RLS policy
CREATE POLICY "Users can only view their own calls"
ON fathom_calls FOR SELECT
USING (auth.uid() = user_id);
```

---

## Development Guide

### Prerequisites

- **Node.js** 18+ and npm
- **Supabase** account (for backend services)
- **Fathom** API access (for meeting ingestion)

### Local Development Setup

```bash
# 1. Clone the repository
git clone <YOUR_GIT_URL>
cd brain

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env and add:
# VITE_SUPABASE_URL=your_supabase_project_url
# VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key

# 4. Start development server (runs on http://localhost:8080)
npm run dev
```

### Available Commands

```bash
# Development
npm run dev                 # Start dev server on http://localhost:8080
npm run build              # Production build
npm run build:dev          # Development build (with source maps)
npm run preview            # Preview production build

# Code Quality
npm run lint               # Run ESLint
npm run type-check         # Run TypeScript compiler (no emit)

# Testing
npx vitest                 # Run tests once
npx vitest --watch         # Run tests in watch mode
```

### Development Workflow

#### 1. Before Starting

- Read `CLAUDE.md` for comprehensive development standards
- Review `docs/design/brand-guidelines-v3.3.md` for UI work
- Check `docs/architecture/api-naming-conventions.md` for naming

#### 2. Creating Features

```bash
# 1. Create feature branch
git checkout -b feature/your-feature-name

# 2. Implement feature following conventions
# - Use TodoWrite to track multi-step tasks
# - Read existing patterns before coding
# - Follow brand guidelines for UI

# 3. Test thoroughly
npm run type-check
npm run lint

# 4. Commit with descriptive message
git commit -m "feat: add [feature] with [details]"
```

#### 3. Before PR

```bash
# Run code review
/code-review

# Run security review if touching auth/data
/security-review

# Run design review if UI changes
/design-review
```

### Key Development Patterns

#### 1. Using React Query

```typescript
// Fetch data with caching
const { data, isLoading, error } = useQuery({
  queryKey: ['calls-with-transcripts'],
  queryFn: async () => {
    const { data, error } = await supabase
      .from('fathom_calls')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  },
  staleTime: 1000 * 60,  // 1 minute
  gcTime: 1000 * 60 * 5   // 5 minutes (renamed from cacheTime)
});

// Mutate data with invalidation
const mutation = useMutation({
  mutationFn: async (callId: string) => {
    const { error } = await supabase
      .from('fathom_calls')
      .delete()
      .eq('id', callId);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['calls-with-transcripts'] });
    toast.success('Call deleted');
  },
  onError: (error) => {
    logger.error('Delete error', error);
    toast.error('Failed to delete call');
  }
});
```

#### 2. Using Logger Utility

```typescript
import { logger } from '@/lib/logger';

// In development: logs to console with timestamp
// In production: no output (prevents sensitive data exposure)

logger.info('User logged in', { userId: user.id });
logger.error('API call failed', error);
```

#### 3. API Client Usage

```typescript
import { fetchMeetings } from '@/lib/api-client';

const { data, error } = await fetchMeetings({
  dateFrom: new Date('2025-01-01'),
  dateTo: new Date('2025-12-31')
});

if (error) {
  // Automatic retry already handled by api-client
  toast.error(error);
  return;
}

// Use data
setMeetings(data);
```

### Environment Variables

#### Frontend (.env)

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
```

#### Edge Functions (Supabase Dashboard → Edge Functions → Secrets)

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
```

---

## Deployment

### Vercel Deployment (Recommended)

1. **Connect Repository**
   - Go to [vercel.com](https://vercel.com)
   - Import your Git repository
   - Vercel will detect Vite configuration automatically

2. **Configure Environment Variables**
   - Add `VITE_SUPABASE_URL`
   - Add `VITE_SUPABASE_PUBLISHABLE_KEY`

3. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy automatically
   - Every push to `main` triggers a new deployment

### Build Configuration

The project includes a `vercel.json` with optimized settings:

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "outputDirectory": "dist"
}
```

### Production Checklist

- [ ] All environment variables set in deployment platform
- [ ] Supabase Edge Functions deployed
- [ ] Database migrations applied
- [ ] RLS policies verified
- [ ] CORS settings configured for production domain
- [ ] Webhook endpoints registered with Fathom
- [ ] Error tracking configured (optional: Sentry)

---

## Code Quality

### Automated Reviews

When working with Claude, use these commands:

| Command | Purpose | When to Use |
|---------|---------|-------------|
| `/code-review` | Comprehensive code review | After completing a feature |
| `/security-review` | Security-focused analysis | Before PR with auth/data changes |
| `/design-review` | UI/UX validation with Playwright | After UI changes |

### Code Standards

#### 1. TypeScript

- **Strict mode enabled**
- Use explicit types, avoid `any`
- Prefer interfaces over types for objects
- Use `const` assertions for literal types

#### 2. React

- **Functional components only** (no class components)
- Use hooks for state and side effects
- Memoize expensive computations with `useMemo`
- Memoize callbacks with `useCallback`
- Extract complex logic into custom hooks

#### 3. Naming Conventions

```typescript
// Components: PascalCase
export function TranscriptsTab() {}

// Hooks: camelCase with "use" prefix
export function useMeetingsSync() {}

// Functions: camelCase
export async function fetchMeetings() {}

// Types/Interfaces: PascalCase
export interface Meeting {}
export type ApiResponse<T> = {}

// Constants: SCREAMING_SNAKE_CASE
export const MAX_RETRIES = 3;

// Files: kebab-case.tsx or kebab-case.ts
// transcripts-tab.tsx, api-client.ts
```

#### 4. File Organization

```typescript
// 1. Imports (grouped)
import { useState } from 'react';  // External
import { Button } from '@/components/ui/button';  // Internal
import { logger } from '@/lib/logger';  // Utilities

// 2. Types/Interfaces
interface MyComponentProps {
  title: string;
}

// 3. Component
export function MyComponent({ title }: MyComponentProps) {
  // State
  const [count, setCount] = useState(0);

  // Queries
  const { data } = useQuery(...);

  // Effects
  useEffect(() => {}, []);

  // Handlers
  const handleClick = () => {};

  // Render
  return <div>{title}</div>;
}
```

### Testing Guidelines

```typescript
// Unit tests with Vitest
import { describe, it, expect } from 'vitest';

describe('fetchMeetings', () => {
  it('should fetch meetings successfully', async () => {
    const result = await fetchMeetings({ limit: 10 });
    expect(result.data).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it('should handle errors gracefully', async () => {
    const result = await fetchMeetings({ invalid: true });
    expect(result.error).toBeDefined();
  });
});
```

---

## Additional Resources

### Documentation

- **CLAUDE.md** (810 lines) - Comprehensive Claude-specific instructions
- **WARP.md** - AI assistant development guide
- **docs/design/** - Brand guidelines and design principles
- **docs/architecture/** - System architecture and API conventions
- **docs/adr/** - Architecture Decision Records
- **docs/reference/** - Reference documentation

### Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `CLAUDE.md` | Claude development instructions | 810 |
| `WARP.md` | AI assistant guide | 400+ |
| `brand-guidelines-v3.3.md` | Complete design system | 1000+ |
| `api-naming-conventions.md` | Naming standards | 200+ |
| `CLEANUP_REPORT.md` | Code quality analysis | 270 |

### External Links

- [Supabase Documentation](https://supabase.com/docs)
- [React Query Documentation](https://tanstack.com/query/latest)
- [Radix UI Documentation](https://www.radix-ui.com/)
- [Remix Icon Library](https://remixicon.com/)
- [Fathom API Documentation](https://docs.fathom.video/)
- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)

---

## Change Log

### 2025-11-24 - v1.0.0

- Initial comprehensive documentation created
- Cleanup: Replaced 43 console statements with logger utility
- Cleanup: Removed unused `@radix-ui/react-menubar` dependency
- Type-check validation passed
- Node modules refreshed (617 packages)

---

**Generated:** 2025-11-24
**Maintained by:** Claude Code
**Status:** Production Ready ✅
