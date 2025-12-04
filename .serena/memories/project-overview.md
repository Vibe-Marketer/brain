# Conversion Brain - Project Overview

## Purpose
Conversion Brain is a meeting intelligence and transcript management application. It integrates with Fathom to sync, process, and analyze meeting recordings and transcripts. Features include:
- Meeting sync and transcript management
- AI-powered transcript analysis and tagging
- RAG-based chat with meeting content
- Category/folder organization
- Multi-provider AI model support via OpenRouter

## Tech Stack
- **Frontend**: React 18 + TypeScript + Vite (port 8080)
- **UI**: Radix UI primitives + Tailwind CSS + shadcn/ui patterns
- **State/Data**: TanStack Query (React Query)
- **AI SDK**: Vercel AI SDK v5 (`ai`, `@ai-sdk/react`, `@ai-sdk/openai`)
- **Backend**: Supabase Edge Functions (Deno)
- **Database**: Supabase (PostgreSQL)
- **Icons**: Remix Icon (`@remixicon/react`)
- **Charts**: Recharts + Tremor

## AI/LLM Configuration
- **All models route through OpenRouter** (OpenAI-compatible API)
- **Default model**: `z-ai/glm-4.6`
- **Embeddings**: OpenAI direct (`text-embedding-3-small`) - OpenRouter doesn't support embeddings
- **Supported providers**: OpenAI, Anthropic, Google, xAI, Meta, DeepSeek, Mistral, 300+ more

## Key Directories
```
src/
├── components/     # React components (UI, settings, transcripts, chat, etc.)
├── pages/          # Route pages (Login, Settings, Chat, TranscriptsNew, Categorization)
├── hooks/          # Custom React hooks
├── lib/            # Utilities (api-client, filter-utils, export-utils, etc.)
├── contexts/       # React contexts
├── integrations/   # External integrations (Supabase client/types)
├── types/          # TypeScript type definitions
├── assets/         # Static assets

supabase/
├── functions/      # Edge Functions (29 functions, kebab-case folders)
├── migrations/     # Database migrations
├── config.toml     # Supabase config

docs/
├── design/         # Brand guidelines, design tokens, component specs
├── architecture/   # API conventions, ADRs
├── adr/            # Architecture Decision Records
```

## Important Documentation
- `CLAUDE.md` - Development instructions and conventions
- `docs/design/brand-guidelines-v3.3.md` - UI/design system (MUST READ before UI work)
- `docs/architecture/api-naming-conventions.md` - Naming conventions
- `docs/adr/` - Architecture Decision Records
