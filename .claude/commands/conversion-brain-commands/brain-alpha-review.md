---
description: Perform comprehensive code review for Conversion Brain, saves report to `code-review.md`
argument-hint: <PR number, branch name, file path, or leave empty for staged changes>
allowed-tools: Bash(*), Read, Grep, LS, Write
thinking: auto
---

# Code Review for Conversion Brain

**Review scope**: $ARGUMENTS

I'll perform a comprehensive code review and generate a report saved to the root of this directory as `code-review[n].md`. Check if other reviews exist before you create the file and increment n as needed.

## Context

You're reviewing code for Conversion Brain, which uses:

- **Frontend**: React + TypeScript + Vite + TailwindCSS + TanStack Query
- **Backend**: Supabase Edge Functions (Deno runtime)
- **Database**: Supabase PostgreSQL
- **Testing**: Vitest
- **Code Quality**: ESLint, TypeScript strict mode

## What to Review

Determine what needs reviewing:

- If no arguments: Review staged changes (`git diff --staged`)
- If PR number: Review pull request (`gh pr view`)
- If branch name: Compare with main (`git diff main...branch`)
- If file path: Review specific files
- If directory: Review all changes in that area

## Review Focus

### TypeScript/React Quality

Look for:

- **TypeScript types** properly defined, avoid `any`
- **TanStack Query patterns** following DATA_FETCHING_architecture.md:

  ```typescript
  // Query key convention (kebab-case string arrays)
  queryKey: ["entity-name", param1, param2]

  // Proper cache invalidation
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["affected-query"] });
  }
  ```

- **Component structure** following existing patterns
- **Brand guideline compliance** per BRAND_GUIDELINES.md

### Edge Function Quality

Look for:

- **Standard Deno handler pattern**:

  ```typescript
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    // ...
  });
  ```

- **Error handling** with proper status codes and messages
- **Authentication checks** using Supabase auth
- **CORS headers** properly included

### API Client Pattern

Check for:

- **Using callEdgeFunction** from `src/lib/api-client.ts`
- **Proper error handling** with ApiResponse type
- **Retry logic** when appropriate

### Security Considerations

Check for:

- Input validation
- SQL injection vulnerabilities (use Supabase client properly)
- No hardcoded secrets or API keys
- Proper authentication checks
- Row Level Security (RLS) awareness

### Brand Guidelines Compliance

Verify:

- Vibe green only used for 5 approved patterns
- Button variants (primary/hollow/destructive/link only)
- Typography (Montserrat headings, Inter body)
- Layout rules (90% no cards, proper gutters)

## Review Process

1. **Understand the changes** - What problem is being solved?
2. **Check functionality** - Does it do what it's supposed to?
3. **Review code quality** - Is it maintainable and follows standards?
4. **Consider performance** - Any N+1 queries or inefficient patterns?
5. **Verify tests** - Are changes properly tested?
6. **Check documentation** - Are complex parts documented?

## Key Areas to Check

**Frontend files:**

- `src/components/` - React components
- `src/hooks/` - Custom hooks
- `src/lib/` - Utilities and API client

**Backend files:**

- `supabase/functions/` - Edge Functions

**Configuration:**

- `.env` changes - Security implications
- `package.json` - Dependency changes

## Report Format

Generate a `code-review.md` with:

```markdown
# Code Review

**Date**: [Today's date]
**Scope**: [What was reviewed]
**Overall Assessment**: [Pass/Needs Work/Critical Issues]

## Summary

[Brief overview of changes and general quality]

## Issues Found

### Critical (Must Fix)

- [Issue description with file:line reference and suggested fix]

### Important (Should Fix)

- [Issue description with file:line reference]

### Suggestions (Consider)

- [Minor improvements or style issues]

## What Works Well

- [Positive aspects of the code]

## Security Review

[Any security concerns or confirmations]

## Brand Guidelines Compliance

[Any brand guideline violations]

## Test Coverage

- Current coverage: [if available]
- Missing tests for: [list areas]

## Recommendations

[Specific actionable next steps]
```

## Helpful Commands

```bash
# Check what changed
git diff --staged
git diff main...HEAD
gh pr view $PR_NUMBER --json files

# Run quality checks
npm run lint
npm run type-check

# Run tests
npm run test
```

Remember: Focus on impact and maintainability. Good code review helps the team ship better code, not just find problems. Be constructive and specific with feedback.
