---
name: prime-simple
description: Quick context priming for Conversion Brain development - reads essential files and provides project overview
argument-hint: none
---

## Prime Context for Conversion Brain Development

You need to quickly understand the Conversion Brain codebase. Follow these steps:

### 1. Read Project Documentation

- Read `CLAUDE.md` for development guidelines and patterns
- Read `BRAND_GUIDELINES.md` for UI/design standards
- Read `docs/architecture/architecture.md` for project structure

### 2. Understand Project Structure

Use `tree -L 2` or explore the directory structure to understand the layout:

- `src/` - Frontend React application
- `supabase/functions/` - Backend Edge Functions
- `docs/architecture/` - AI agent reference documentation

### 3. Read Key Frontend Files

Read these essential files in `src/`:

- `App.tsx` - Main application entry and routing
- `lib/api-client.ts` - Edge Function caller
- Make your own decision of how deep to go into other files

### 4. Read Key Backend Files

Read these essential files in `supabase/functions/`:

- `fetch-meetings/index.ts` - Example Edge Function pattern
- `_shared/` - Shared utilities
- Make your own decision of how deep to go into other files

### 5. Review Configuration

- `.env.example` or similar - Required environment variables
- `tailwind.config.ts` - Design tokens
- Make your own decision of how deep to go into other files

### 6. Provide Summary

After reading these files, explain to the user:

1. **Project Purpose**: One sentence about what Conversion Brain does
2. **Architecture**: One sentence about React + TanStack Query + Supabase Edge Functions
3. **Key Patterns**: One sentence about data fetching and UI patterns
4. **Tech Stack**: One sentence about the tech stack

Remember: Focus on the core functionality and patterns that will help you make code changes.
