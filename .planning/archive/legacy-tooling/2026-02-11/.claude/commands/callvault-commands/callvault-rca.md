---
description: Generate Root Cause Analysis report for CallVault issues
argument-hint: <issue description or error message>
allowed-tools: Bash(*), Read, Grep, LS, Write
thinking: auto
---

# Root Cause Analysis for CallVault

**Issue to investigate**: $ARGUMENTS

Investigate this issue systematically and generate an RCA report saved to `RCA.md` in the project root.

## Context About CallVault

You're working with CallVault, a meeting intelligence platform:

- **Frontend**: React + TypeScript + Vite + TanStack Query
- **Backend**: Supabase Edge Functions (Deno runtime)
- **Database**: Supabase PostgreSQL
- **External**: Fathom API integration

## Investigation Approach

### 1. Initial Assessment

First, understand what's broken:

- What exactly is the symptom?
- Which layer is affected (frontend, backend, database)?
- When did it start happening?
- Is it reproducible?

### 2. System Health Check

Check if services are working properly:

- Frontend dev server running
- Supabase connection working
- Edge Functions deployed
- Fathom API connection

### 3. Error Analysis

Look for these error patterns:

**Frontend errors:**
- React component errors
- TanStack Query failures
- API client errors
- Console errors

**Backend errors:**
- Edge Function failures
- Database query errors
- Authentication issues
- External API failures

### 4. Targeted Investigation

Based on the issue type, investigate specific areas:

**For UI issues**: Check React components, CSS, brand guidelines
**For Data issues**: Check TanStack Query hooks, cache invalidation
**For API issues**: Check api-client.ts, Edge Functions
**For Auth issues**: Check AuthContext, Supabase auth
**For Database issues**: Check Supabase queries, RLS policies

### 5. Root Cause Identification

- Follow error stack traces to the source
- Check if errors are being handled correctly
- Look for recent code changes (`git log`)
- Identify any dependency issues

### 6. Impact Analysis

Determine the scope:

- Which features are affected?
- Is there data loss or corruption?
- What's the user impact?

## Key Places to Look

**Configuration files:**

- `.env` - Environment variables
- `vite.config.ts` - Build configuration
- `tailwind.config.ts` - Styling

**Entry points:**

- `src/App.tsx` - Main React app
- `src/lib/api-client.ts` - API client
- `supabase/functions/*/index.ts` - Edge Functions

**Common problem areas:**

- `src/hooks/useMeetingsSync.ts` - Sync logic
- `src/contexts/AuthContext.tsx` - Authentication
- `src/integrations/supabase/client.ts` - Database client

## Report Structure

Generate an RCA.md report with:

```markdown
# Root Cause Analysis

**Date**: [Today's date]
**Issue**: [Brief description]
**Severity**: [Critical/High/Medium/Low]

## Summary

[One paragraph overview of the issue and its root cause]

## Investigation

### Symptoms

- [What was observed]

### Diagnostics Performed

- [Checks run]
- [Logs examined]
- [Code reviewed]

### Root Cause

[Detailed explanation of why this happened]

## Impact

- **Areas Affected**: [List]
- **User Impact**: [Description]
- **Duration**: [Time period]

## Resolution

### Immediate Fix

[What needs to be done right now]

### Long-term Prevention

[How to prevent this in the future]

## Evidence

[Key logs, error messages, or code snippets that led to the diagnosis]

## Lessons Learned

[What we learned from this incident]
```

## Helpful Commands

```bash
# Check frontend
npm run dev
npm run lint
npm run type-check

# Check build
npm run build

# View git history
git log --oneline -20
git diff HEAD~5

# Check environment
cat .env
```

Remember: Focus on understanding the root cause, not just symptoms. The goal is to create a clear, actionable report that helps prevent similar issues in the future.
