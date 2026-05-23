# CallVault™

A transcript infrastructure app that connects recording sources, normalizes calls into one organization-scoped library, and exposes that library through search, routing rules, exports, and MCP.

## What CallVault Does

CallVault pulls recordings and transcripts from connected sources, keeps each organization’s data isolated, and gives users a searchable call library with routing, sharing, exports, and controlled AI actions on top.

### Import Sources

- **Fathom** — OAuth/API-key connection with sync and webhook support
- **Zoom** — OAuth connection with sync and webhook support
- **Fireflies** — API-key connection with signed webhook support
- **Plaud** — OAuth connection and sync support
- **YouTube** — Import public videos by URL; transcript is fetched and stored
- **File Upload** — Drop an audio or video file directly for transcription

### Core Features

**Transcript Library**
The main dashboard shows all imported calls in one place — searchable, filterable, and sortable.

**Call Detail View**
Each call has a full detail page with:
- Generated summary
- Full transcript
- Action items
- Source metadata and outbound recording links where available
- Source-specific rendering for YouTube and uploaded/pasted transcripts

**Controlled AI Actions** (Supabase Edge Functions)

- `summarize-call` — Generates call summaries
- `generate-ai-titles` — Creates descriptive titles from transcript content
- `auto-tag-calls` — Automatically tags calls based on content
- `generate-text` — Generic prompt-to-text utility used by re-engagement email generation
- `split-recording` — Splits long recordings into segments

**Sorting & Tagging**
Organize your library with manual and automated tagging. Routing rules let you auto-assign calls to workspaces or categories based on configurable conditions.

**Analytics**
Call-level and aggregate analytics across your library.

**Sharing**
- Share individual calls via a public token-based link (`/s/:token`)
- Calls shared with you redirect into the main call library
- Copy calls to other organizations

**Global Search**
Full-text search across all calls and transcripts.

**Organizations & Workspaces**
Multi-organization support with invite flows, role-based access (admin/team/member), and workspace management.

**Billing**
Subscription management via Polar.sh (checkout, customer state, webhook processing).

**MCP Server**
A Model Context Protocol server endpoint is available for AI tool integrations.

---

## Technology Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Vite |
| UI | shadcn/ui (Radix UI + Tailwind CSS) |
| State | TanStack Query, Zustand, React Context |
| Backend | Supabase (PostgreSQL, Auth, Edge Functions) |
| Edge Functions | Deno runtime |
| AI calls | Vercel AI SDK / OpenRouter inside Edge Functions |
| Billing | Polar.sh |
| Icons | Remix Icon (`@remixicon/react`) |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase project
- Source credentials for the connectors you are testing
- Supabase service-role credentials for local Edge Function work

### Installation

```bash
git clone <YOUR_GIT_URL>
cd brain
npm install
```

Copy `.env.example` to `.env` and fill in your values.

```bash
npm run dev
# Runs on http://localhost:3001
```

### Environment Variables

**Frontend** (Vite):

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
```

**Edge Functions** (Deno):

```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_DB_URL=your_postgresql_connection_string
```

---

## Development

### Available Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run build:dev    # Dev build
npm run lint         # Lint
npm run type-check   # TypeScript check
npm run preview      # Preview production build
npx vitest           # Run tests
npx vitest --watch   # Tests in watch mode
```

### Project Structure

```
brain/
├── src/
│   ├── pages/              # Route-level components
│   ├── components/         # Reusable UI components
│   │   └── ui/             # shadcn-ui primitives
│   ├── hooks/              # Custom React hooks
│   ├── contexts/           # AuthContext, ThemeContext
│   ├── services/           # Data access layer
│   ├── stores/             # Zustand/panel stores
│   ├── lib/                # Utilities, query config
│   └── integrations/       # Supabase client
├── supabase/
│   ├── functions/          # Deno Edge Functions
│   └── migrations/         # SQL migrations
├── docs/
│   ├── design/             # Brand guidelines
│   ├── architecture/       # API conventions and subsystem contracts
│   ├── adr/                # Architecture Decision Records
│   └── archive/            # Historical docs moved out of active surface
└── CLAUDE.md               # Dev guide for AI assistants
```

---

## Architecture

### Data Flow

```
Frontend → Supabase Edge Function → Supabase Database
```

### Authentication

- Supabase Auth for app sign-in; source OAuth flows are handled by Edge Functions
- `AuthContext` manages session state
- `ProtectedRoute` guards all authenticated routes
- Session persisted via `localStorage`

### State Management

- **React Query** for server state (5min stale time, 10min GC)
- React Context for global UI state (auth, theme, panels)
- Custom hooks encapsulate all query/mutation logic

### Webhook Processing

Fathom and Zoom webhooks are handled by dedicated Edge Functions:
- Signature verification for security
- Idempotency via `processed_webhooks` table
- Async processing (early return pattern)
- Upsert with `onConflict: 'recording_id'`

---

## Design System

Read `docs/design/brand-guidelines-v4.4.md` before any UI work.

Key rules:
- **Vibe Green (#D9FC67)**: Tab underlines, indicators, focus states, progress bars only
- **Buttons**: Use existing UI variants; do not invent one-off button systems
- **Typography**: Montserrat Extra Bold ALL CAPS for headings; Inter for body
- **Icons**: Remix Icon exclusively, `-line` variants preferred
- **Layout**: 4-pane shell; detail pane shrinks content instead of overlaying it

### Naming Conventions

| Pattern | Convention | Example |
|---|---|---|
| Edge Functions | kebab-case | `fetch-meetings/` |
| Frontend functions | camelCase | `fetchMeetings()` |
| React hooks | use + camelCase | `useMeetingsSync()` |
| Types/Interfaces | PascalCase | `Meeting`, `ApiResponse` |
| Database fields | snake_case | `recording_id` |
| Query keys | kebab-case arrays | `["call-analytics", id]` |

---

## Code Quality

When working with Claude:

- `/code-review` — Full review before PRs
- `/security-review` — Security-focused analysis
- `/design-review` — UI/UX validation with Playwright

**Recommended workflow:**
1. Complete code → `/code-review`
2. Before PR → `/security-review`
3. UI changes → `/design-review`

---

## Contributing

1. Read `CLAUDE.md` for development standards
2. Review `docs/design/brand-guidelines-v4.4.md` for UI work
3. Check `docs/architecture/api-naming-conventions.md` for naming

**Workflow:**
1. Branch from `main`
2. Follow brand and naming conventions
3. Write tests for new features
4. Run quality checks before PR
5. Update docs as needed

For significant technical decisions, create an ADR in `docs/adr/` using the template at `docs/adr/adr-template.md`.

---

## Deployment

- **Vercel** (recommended) — Connect repo for automatic deployments with edge function support
- **Custom** — `npm run build` → serve `dist/`

---

## License

[Add your license here]

---

**Built with React + Vite + Supabase**
