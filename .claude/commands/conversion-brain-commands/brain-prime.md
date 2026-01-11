---
name: prime
description: |
  Prime Claude Code with deep context for a specific part of the CallVault codebase.

  Usage: /prime "<area>" "<special focus>"
  Examples:
  /prime "frontend" "Focus on UI components and React"
  /prime "hooks" "Focus on TanStack Query patterns"
  /prime "backend" "Focus on Edge Functions"
argument-hint: <area> <Specific focus>
---

You're about to work on the CallVault codebase. This is a meeting intelligence platform with React frontend and Supabase Edge Functions backend.

## Today's Focus area

Today we are focusing on: $ARGUMENTS
And pay special attention to: $ARGUMENTS

## Decision

Think hard and make an intelligent decision about which key files you need to read. If you discover something you need to look deeper at or imports from files you need context from, read those as well. The goal is to get key understandings of the codebase so you are ready to make code changes.

## Architecture Overview

### Frontend - React + TypeScript + Vite

```
src/
├── App.tsx                     # Root component with routing
├── main.tsx                    # Entry point
├── pages/                      # Route components (5 pages)
│   ├── Login.tsx
│   ├── Settings.tsx
│   ├── TranscriptsNew.tsx
│   ├── OAuthCallback.tsx
│   └── NotFound.tsx
├── components/                 # UI components (~90 files)
│   ├── ui/                    # Base UI primitives (54 files)
│   ├── transcripts/           # Tab components (10 files)
│   ├── transcript-library/    # Shared components (13 files)
│   └── ...
├── hooks/                      # Custom React hooks (8 files)
│   ├── useMeetingsSync.ts     # Main sync logic
│   ├── useCallAnalytics.ts    # Analytics queries
│   └── ...
├── lib/                        # Utilities (12 files)
│   ├── api-client.ts          # Edge Function caller
│   └── ...
├── contexts/                   # React contexts (3 files)
└── integrations/supabase/      # Supabase client and types
```

### Backend - Supabase Edge Functions

```
supabase/functions/
├── _shared/                    # Shared utilities
├── fetch-meetings/             # Core meeting operations
├── sync-meetings/
├── webhook/
├── process-call-ai/            # AI processing
├── fathom-oauth-url/           # OAuth
├── get-config-status/          # Configuration
├── test-fathom-connection/     # Testing
└── ... (32 functions total)
```

## Key Files to Read for Context

### When working on Frontend UI

Key files to consider:

- `src/App.tsx` - Main app structure and routing
- `src/components/transcripts/TranscriptsTab.tsx` - Main component example
- `BRAND_GUIDELINES.md` - UI design rules
- `src/components/ui/button.tsx` - Component patterns

### When working on Data Fetching

Key files to consider:

- `docs/architecture/DATA_FETCHING_architecture.md` - Complete guide
- `src/lib/api-client.ts` - Edge Function caller
- `src/hooks/useMeetingsSync.ts` - Hook patterns
- `src/components/transcripts/TranscriptsTab.tsx` - Query examples

### When working on Edge Functions

Key files to consider:

- `supabase/functions/fetch-meetings/index.ts` - Standard pattern
- `supabase/functions/_shared/` - Shared utilities
- `src/lib/api-client.ts` - How frontend calls functions

### When working on Styling

Key files to consider:

- `BRAND_GUIDELINES.md` - Complete design system
- `tailwind.config.ts` - Design tokens
- `src/index.css` - Global styles

## Critical Rules for This Codebase

### Data Fetching

- All server state through TanStack Query
- Query keys are hardcoded string arrays: `["category-calls", id]`
- Use kebab-case for multi-word keys
- Invalidate related queries after mutations

### UI/Styling

- Follow BRAND_GUIDELINES.md strictly
- Vibe green only for 5 approved uses
- Montserrat Extra Bold ALL CAPS for headings
- Inter Light/Regular for body text
- 4px spacing grid

### Edge Functions

- Use standard Deno handler pattern
- Include CORS headers
- Check authentication
- Return JSON responses

### API Client

- Use callEdgeFunction from api-client.ts
- Handle ApiResponse with data/error
- Use camelCase function names

## Current Focus Areas

- TanStack Query for all data fetching
- Supabase Edge Functions for backend
- Brand guidelines for all UI work
- TypeScript strict mode

Remember: Check the relevant documentation before making changes. The codebase has specific patterns that should be followed.
