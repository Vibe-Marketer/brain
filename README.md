# CallVault™

**Every Call Becomes a Conversion Asset.**

CallVault is an AI-powered Meeting Intelligence System that automatically transforms your meetings—sales, coaching, demos, support—into actionable marketing content, CRM intelligence, client health insights, and ready-to-use follow-ups.

## What is CallVault?

CallVault automatically turns all your meetings into actionable assets. It ingests call transcripts from Fathom (and soon Zoom and other platforms), intelligently classifies meetings, extracts key insights using the **PROFITS framework**, and generates:

- ✅ Personalized follow-up emails
- ✅ Social media posts (LinkedIn, Facebook, X)
- ✅ Blog outlines and case studies
- ✅ Client health scores and engagement alerts
- ✅ Searchable quote library with sentiment analysis

### The PROFITS Framework

Every meeting is analyzed to extract the most valuable insights:

- **P**ain: What struggles were mentioned?
- **R**esults: What outcomes do they want?
- **O**bstacles: What's blocking progress?
- **F**ears: What concerns are holding them back?
- **I**dentity: How do they describe themselves?
- **T**riggers: What motivated them to act?
- **S**uccess: What wins were celebrated?

## Key Features

### 🎯 Smart Meeting Classification

Automatically detects meeting types (sales, coaching, demo, community, support) using AI and contextual cues.

### 💡 Intelligent Extraction

Identifies and scores key quotes, pain points, goals, objections, and success stories from every conversation.

### 📧 Automated Follow-Ups

Generates context-aware, personalized follow-up emails ready to send after every meeting.

### 📱 Content Generation

Creates social media posts, blog outlines, testimonials, and marketing content in your brand voice.

### 📊 Client Intelligence

Tracks sentiment, engagement levels, and health scores to alert you about at-risk clients or testimonial opportunities.

### 🔍 Searchable Library

All transcripts, quotes, and insights are organized, tagged, and searchable in one centralized dashboard.

## Technology Stack

- **Frontend**: Vite, React 18, TypeScript, React Router v6
- **UI Framework**: shadcn-ui (Radix UI + Tailwind CSS)
- **State Management**: React Query (@tanstack/react-query), React Context
- **Backend**: Supabase (PostgreSQL Database, Auth, Edge Functions)
- **Runtime**: Deno (for Edge Functions)
- **AI/LLM**: Vercel AI SDK (for intelligent processing)
- **Icons**: Remix Icon
- **Charts**: Recharts, Tremor React

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account (for backend services)
- Fathom API access (for meeting ingestion)

### Installation

```bash
# Clone the repository
git clone <YOUR_GIT_URL>
cd brain

# Install dependencies
npm install

# Set up environment variables
# Copy .env.example to .env and fill in your values:
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_PUBLISHABLE_KEY

# Start the development server (runs on http://localhost:8080)
npm run dev
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

## Development

### Available Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Build for development
npm run build:dev

# Lint code
npm run lint

# Type checking
npm run type-check

# Preview production build
npm run preview

# Run tests
npx vitest

# Run tests in watch mode
npx vitest --watch
```

### Project Structure

```
brain/
├── src/
│   ├── pages/              # Route components (TranscriptsNew, Settings, Login)
│   ├── components/         # Reusable React components
│   │   └── ui/            # shadcn-ui components
│   ├── hooks/             # Custom React hooks (useMeetingsSync, useCallAnalytics)
│   ├── contexts/          # React Context providers (ThemeContext, AuthContext)
│   ├── lib/               # Utilities (api-client, fathom, logger)
│   └── integrations/      # Supabase client configuration
├── supabase/
│   ├── functions/         # Deno Edge Functions
│   │   ├── fetch-meetings/
│   │   ├── sync-meetings/
│   │   ├── webhook/
│   │   └── ...
│   └── migrations/        # SQL migration files
├── docs/
│   ├── design/            # Brand guidelines & design principles
│   ├── architecture/      # API naming conventions
│   ├── adr/              # Architecture Decision Records
│   └── reference/         # Reference documentation
└── WARP.md               # Development guide for AI assistants
```

## Architecture

### API Communication Flow

```
Frontend → API Client (src/lib/api-client.ts) → Edge Function → Supabase Database
```

The centralized API client provides:

- Automatic retry logic with exponential backoff
- Consistent error handling
- Type-safe responses via `ApiResponse<T>`

### Authentication

- Supabase Auth with email/password or OAuth (Fathom)
- `AuthContext` manages authentication state
- `ProtectedRoute` guards authenticated routes
- Session persistence via browser `localStorage`

### State Management

- **React Query** for server state (1min stale time, 5min garbage collection)
- Custom hooks encapsulate query logic
- React Context for global UI state (theme, auth)

### Webhook Processing

The `webhook/` Edge Function:

- Verifies signatures for security
- Checks idempotency via `processed_webhooks` table
- Processes asynchronously (returns early)
- Uses upsert pattern with `onConflict: 'recording_id'`

## Design System

### Brand Guidelines

**Before any UI work, read**: `docs/design/brand-guidelines-v3.3.md`

Key rules:

- **Vibe Green (#D9FC67)**: Only for tab underlines, indicators, focus states, progress bars
- **4 Button Variants**: default (slate gradient), hollow (bordered), destructive (red), link (text-only)
- **Typography**: Montserrat Extra Bold ALL CAPS for headings, Inter for body text
- **Icons**: Remix Icon exclusively (`@remixicon/react`), `-line` variants preferred
- **Layout**: 90% rule - no card containers, use white background + thin borders

### API Naming Conventions

| Pattern | Convention | Example |
|---------|------------|----------|
| Edge Functions | kebab-case | `fetch-meetings/` |
| Frontend functions | camelCase | `fetchMeetings()` |
| React hooks | use + camelCase | `useMeetingsSync()` |
| Types/Interfaces | PascalCase | `Meeting`, `ApiResponse` |
| Database fields | snake_case | `recording_id` |
| Query keys | kebab-case arrays | `["call-analytics", id]` |

## Code Quality

### Available Review Commands

When working with Claude:

- `/code-review` - Comprehensive code review before PRs
- `/security-review` - Security-focused analysis
- `/design-review` - UI/UX validation with Playwright

### Recommended Workflow

1. After completing code → `/code-review`
2. Before PR → `/security-review`
3. UI changes → `/design-review`

## Documentation

- **WARP.md**: Development guide for AI coding assistants
- **CLAUDE.md**: Comprehensive Claude-specific instructions (810 lines)
- **docs/design/**: Brand guidelines and design principles
- **docs/architecture/**: API naming conventions
- **docs/adr/**: Architecture Decision Records
- **docs/reference/**: Reference documentation including "What is CallVault"

## Contributing

### Before Starting

1. Read `WARP.md` for development setup
2. Review `docs/design/brand-guidelines-v3.3.md` for UI work
3. Check `docs/architecture/api-naming-conventions.md` for naming standards

### Development Workflow

1. Create feature branch from `main`
2. Follow brand guidelines and naming conventions
3. Write tests for new functionality
4. Run code quality checks before PR
5. Update documentation as needed

### Architecture Decision Records

For significant technical decisions:

1. Copy `docs/adr/adr-template.md`
2. Fill in Context, Decision, Consequences
3. Save as `docs/adr/adr-XXX-short-title.md`
4. Update `docs/adr/README.md`

## Deployment

This project can be deployed via:

- **Vercel** (Recommended): Connect your Git repository for automatic deployments with edge functions
- **Netlify**: Connect your Git repository for automatic deployments
- **Custom**: Build with `npm run build` and serve the `dist/` directory

## Support

For detailed development guidance:

- Read `WARP.md` for AI assistant instructions
- Check `CLAUDE.md` for comprehensive development standards
- Review documentation in `docs/` directory

## License

[Add your license here]

---

**Built with React + Vite + Supabase**
