---
name: brain-onboarding
description: |
  Onboard new developers to the CallVault codebase with a comprehensive overview and first contribution guidance.

  Usage: /brain-onboarding
argument-hint: none
---

You are helping a new developer get up and running with the CallVault project! Your goal is to provide them with a personalized onboarding experience.

## What is CallVault?

CallVault is a meeting intelligence platform that syncs with Fathom to process call transcripts, categorize meetings, and provide analytics. It helps users organize and analyze their sales calls.

## Quick Architecture Overview

This is a **client-server architecture** with:

1. **Frontend** - React + TypeScript + Vite + TailwindCSS
2. **State Management** - TanStack Query for server state
3. **Backend** - Supabase Edge Functions (Deno runtime)
4. **Database** - Supabase PostgreSQL with RLS

All data fetching goes through TanStack Query hooks, with mutations calling Supabase Edge Functions via a centralized API client.

## Getting Started - Your First 30 Minutes

### Prerequisites Check

You'll need:

- Node.js 18+
- Supabase account
- Git and basic command line knowledge

### Setup

First, read the README.md file to understand the setup process, then guide the user through these steps:

1. Clone the repository
2. Install dependencies with `npm install`
3. Set up environment variables
4. Run the development server with `npm run dev`
5. Verify the app loads correctly

## Understanding the Codebase

### Decision Time

Ask the user to choose their focus area. Present these options clearly and wait for their response:

"Which area of CallVault would you like to explore first?"

1. **UI Components (React)** - If you enjoy UI/UX work
2. **Data Fetching (TanStack Query)** - If you like state management patterns
3. **Backend (Edge Functions)** - If you prefer serverless functions
4. **Styling (Tailwind)** - If you're interested in design systems

### Your Onboarding Analysis

Based on the user's choice, perform a deep analysis of that area following the instructions below for their specific choice.

## Report Structure

Your report to the user should include:

1. **Area Overview**: Architecture explanation and key files
2. **Key Files Walkthrough**: Purpose of main files and their relationships
3. **Suggested First Contribution**: A specific, small improvement with exact location
4. **Implementation Guide**: Step-by-step instructions to make the change
5. **Testing Instructions**: How to verify their change works correctly

**If the user chose UI Components:**

- Start with `src/components/transcripts/TranscriptsTab.tsx`
- Look at `src/components/ui/` for base primitives
- Read `BRAND_GUIDELINES.md` for design rules
- Identify a UI improvement the user can easily make
- Give the user an overview of the component architecture

**If the user chose Data Fetching:**

- Start with `src/hooks/useMeetingsSync.ts`
- Read `docs/architecture/DATA_FETCHING_architecture.md`
- Look at query patterns in `src/components/transcripts/TranscriptsTab.tsx`
- Identify a data fetching improvement opportunity
- Give the user an overview of TanStack Query patterns

**If the user chose Backend:**

- Start with `supabase/functions/fetch-meetings/index.ts`
- Read `src/lib/api-client.ts` for the calling pattern
- Look at `supabase/functions/_shared/` for utilities
- Identify an Edge Function improvement
- Give the user an overview of the Edge Function pattern

**If the user chose Styling:**

- Start with `BRAND_GUIDELINES.md`
- Look at `tailwind.config.ts` for design tokens
- Review `src/components/ui/` for styled components
- Identify a styling inconsistency to fix
- Give the user an overview of the design system

## How to Find Contribution Opportunities

When analyzing the user's chosen area, look for:

- TODO or FIXME comments in the code
- Missing error handling or validation
- UI components that could be more user-friendly
- API endpoints missing useful filters or data
- Areas with minimal or no test coverage
- Brand guideline violations

## What to Include in Your Report

After analyzing their chosen area, provide the user with:

1. Key development patterns they should know:
   - TanStack Query for all server state
   - Brand guidelines for all UI work
   - Edge Function patterns for backend
   - TypeScript strict mode

2. Specific contribution suggestion with:
   - Exact file and line numbers to modify
   - Current behavior vs improved behavior
   - Step-by-step implementation guide
   - Testing instructions

3. Common gotchas for their area:
   - Cache invalidation patterns
   - Brand guideline requirements
   - Authentication checks

Remember to encourage the user to start small and iterate.
