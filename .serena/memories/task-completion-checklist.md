# Task Completion Checklist - Conversion Brain

## Before Marking Task Complete

### Code Quality Checks
- [ ] Run `npm run type-check` - No TypeScript errors
- [ ] Run `npm run lint` - No ESLint errors/warnings (or acceptable)
- [ ] Run `npx vitest` - Tests pass (if applicable)

### For UI/Frontend Changes
- [ ] Read relevant section of `docs/design/brand-guidelines-v3.3.md` BEFORE implementing
- [ ] Verify design compliance with brand guidelines
- [ ] Navigate to changed pages with Playwright (`http://localhost:8080`)
- [ ] Take screenshot to verify visual appearance
- [ ] Check browser console for errors (`mcp__playwright__browser_console_messages`)
- [ ] Test in both light and dark modes (if theme-aware)

### For API/Backend Changes
- [ ] Follow naming conventions (kebab-case folders, camelCase functions)
- [ ] Update `src/lib/api-client.ts` if adding new endpoints
- [ ] Test Edge Function locally with `npx supabase functions serve`
- [ ] Deploy with `npx supabase functions deploy <name>`

### For New Features
- [ ] Add to appropriate location per project structure
- [ ] Follow existing patterns (check similar implementations first)
- [ ] No security vulnerabilities (OWASP top 10)
- [ ] Avoid over-engineering (only what's requested)

### Documentation
- [ ] Update brand guidelines version if modifying (3 places + changelog)
- [ ] Create ADR if significant architectural decision
- [ ] Keep code comments minimal (only for non-obvious logic)

## Review Commands
```bash
# Code review
/code-review            # or Task(subagent_type="pragmatic-code-review")

# Security review
/security-review        # For auth/input handling/secrets

# Design review
/design-review          # For significant UI changes
```

## Post-Completion
- [ ] Mark todo as completed IMMEDIATELY (don't batch)
- [ ] Move to next task (mark in_progress)
- [ ] Only ONE task in_progress at a time
