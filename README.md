# CallVault™

A call recording intelligence platform that imports, transcribes, organizes, and analyzes calls from multiple sources — with AI-powered summaries, tagging, content generation, and team sharing built in.

## What CallVault Does

CallVault pulls in call recordings and transcripts from connected sources, processes them with AI, and gives your team a searchable, organized library with smart automation on top.

### Import Sources

- **Fathom** — OAuth connection with background sync and webhook support
- **Zoom** — OAuth connection with background sync and webhook support (beta)
- **YouTube** — Import any video by URL; transcript is fetched and stored
- **File Upload** — Drop an audio or video file directly for transcription

### Core Features

**Transcript Library**
The main dashboard shows all imported calls in one place — searchable, filterable, and sortable.

**Call Detail View**
Each call has a full detail page with:
- AI-generated summary
- Full transcript
- Insights extraction
- Action items
- YouTube calls show thumbnail, video metadata (views, likes, duration), and description

**AI Processing** (Supabase Edge Functions)
- `summarize-call` — Generates call summaries
- `generate-ai-titles` — Creates descriptive titles from transcript content
- `auto-tag-calls` — Automatically tags calls based on content
- `generate-content` — Generates social posts, blog outlines, and other content from calls
- `generate-meta-summary` — Produces meta-level summaries across calls
- `manager-notes` — Generates manager-level notes from call content
- `split-recording` — Splits long recordings into segments

**Sorting & Tagging**
Organize your library with manual and automated tagging. Routing rules let you auto-assign calls to workspaces or categories based on configurable conditions.

**Analytics**
Call-level and aggregate analytics across your library.

**Sharing**
- Share individual calls via a public token-based link (`/s/:token`)
- View calls shared with you in a dedicated "Shared With Me" section
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
| State | React Query (@tanstack/react-query), React Context |
| Backend | Supabase (PostgreSQL, Auth, Edge Functions) |
| Edge Functions | Deno runtime |
| AI | Vercel AI SDK |
| Billing | Polar.sh |
| Icons | Remix Icon (`@remixicon/react`) |
| Deployment | Vercel |

---

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase project
- Fathom API credentials (for Fathom sync)
- Zoom OAuth app credentials (for Zoom sync, beta)

### Installation

```bash
git clone <YOUR_GIT_URL>
cd brain
npm install
```

Copy `.env.example` to `.env` and fill in your values.

```bash
npm run dev
# Runs on http://localhost:8080
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
│   ├── architecture/       # API conventions, diagrams
│   ├── adr/                # Architecture Decision Records
│   └── reference/          # Reference docs
└── CLAUDE.md               # Dev guide for AI assistants
```

---

## Architecture

### Data Flow

```
Frontend → Supabase Edge Function → Supabase Database
```

### Authentication

- Supabase Auth (email/password + OAuth for Fathom and Zoom)
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

Read `docs/design/brand-guidelines-v4.1.md` before any UI work.

Key rules:
- **Vibe Green (#D9FC67)**: Tab underlines, indicators, focus states, progress bars only
- **Buttons**: 4 variants — default (slate gradient), hollow (bordered), destructive (red), link (text-only)
- **Typography**: Montserrat Extra Bold ALL CAPS for headings; Inter for body
- **Icons**: Remix Icon exclusively, `-line` variants preferred
- **Layout**: No card containers — white background + thin borders

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
2. Review `docs/design/brand-guidelines-v4.1.md` for UI work
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
