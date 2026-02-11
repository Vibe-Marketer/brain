---
name: ralph-executor
description: "Execute one Ralph autonomous iteration. Reads prd.json, implements one story, verifies, commits, updates state. This is the core autonomous execution mode for Ralph. Triggers on: ralph iteration, run ralph, execute ralph story, ralph execute."
---

# Ralph Executor - Autonomous Story Implementation

Execute a single Ralph iteration autonomously: pick a story, implement it, verify it, commit it, update state.

---

## Your Job

You are an autonomous agent executing ONE iteration of the Ralph system. You will:

1. ✅ Load context from files
2. ✅ Pick the highest priority incomplete story  
3. ✅ Implement the story completely
4. ✅ Verify all acceptance criteria
5. ✅ Commit your changes
6. ✅ Update state files
7. ✅ Signal completion or continuation

---

## Step 1: Load Context

Read these files in order:

### Critical Files (Read First)
1. **`.ralph_state.json`** - Current iteration number
2. **`prd.json`** - Stories to implement
3. **`CLAUDE.md`** (root and directories) - Codebase patterns
4. **`progress.txt`** - Start with "Codebase Patterns" section

### Example Context Loading

```typescript
// Read iteration state
const state = JSON.parse(fs.readFileSync('.ralph_state.json', 'utf8'));
console.log(`Executing iteration ${state.currentIteration}`);

// Read PRD
const prd = JSON.parse(fs.readFileSync('prd.json', 'utf8'));
const stories = prd.userStories.filter(s => !s.passes);
console.log(`${stories.length} stories remaining`);

// Read patterns
const rootPatterns = fs.readFileSync('CLAUDE.md', 'utf8');
// Parse and internalize patterns before starting work
```

---

## Step 2: Check Branch

Ensure you're on the correct branch from `prd.json`:

```bash
BRANCH=$(jq -r '.branchName' prd.json)
CURRENT=$(git branch --show-current)

if [ "$CURRENT" != "$BRANCH" ]; then
  # Check if branch exists
  if git show-ref --verify --quiet refs/heads/$BRANCH; then
    git checkout $BRANCH
  else
    git checkout -b $BRANCH
  fi
fi
```

---

## Step 3: Read Patterns (Critical!)

Before implementing ANYTHING, read and internalize patterns:

### From CLAUDE.md Files

Look for CLAUDE.md in:
- Project root
- Directories you'll be modifying
- Parent directories of modified files

### From progress.txt

Check the **"Codebase Patterns"** section at the top:

```markdown
## Codebase Patterns

- Use sql<number> template for aggregations
- Always use IF NOT EXISTS for migrations  
- Export types from actions.ts for UI components
- Tests require dev server on port 3000
```

**These patterns are gold.** They save you from mistakes previous iterations already made.

---

## Step 4: Pick Story

Find the **highest priority** story where `passes: false`:

```typescript
const nextStory = prd.userStories
  .filter(s => !s.passes)
  .sort((a, b) => a.priority - b.priority)[0];

if (!nextStory) {
  // All stories complete!
  createCompletionSignal();
  return;
}

console.log(`Implementing: ${nextStory.id} - ${nextStory.title}`);
```

---

## Step 5: Implement Story

Implement the story according to its acceptance criteria.

### Implementation Checklist

For EACH acceptance criterion:
- [ ] Read and understand what it requires
- [ ] Implement the functionality
- [ ] Verify it works
- [ ] Check it off mentally

### Follow Patterns

Use patterns from CLAUDE.md and progress.txt:

**Example**: If you're adding a database migration and CLAUDE.md says:
> "Always use IF NOT EXISTS for migrations"

Then your migration should:
```sql
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY,
  status TEXT DEFAULT 'pending'
);
```

---

## Step 6: Quality Checks

Run quality checks before committing:

### Always Required
```bash
# Typecheck
npm run typecheck  # or tsc --noEmit, or your project's command

# Lint
npm run lint  # or eslint ., or your project's command
```

### If Story Has Tests
```bash
npm test  # or your project's test command
```

### If Story Changes UI

Use the `dev-browser` skill:

```markdown
I need to verify the UI changes in the browser.

Load dev-browser skill and:
1. Navigate to [page URL]
2. Check that [specific UI element] is visible
3. Verify [specific behavior] works
4. Take screenshot if helpful
```

**Frontend stories are NOT complete until browser-verified.**

---

## Step 7: Update CLAUDE.md (If Patterns Discovered)

If you discovered something future iterations should know, add it to CLAUDE.md.

### Good Additions

**Database patterns**:
```markdown
## Database Patterns

- Always use IF NOT EXISTS for table creation
- Use transactions for multi-step operations
- Column names: snake_case, table names: plural
```

**API patterns**:
```markdown
## API Patterns

- All server actions return { success, data?, error? }
- Use sql<number> template literal for parameterized queries
- Validate input with Zod schemas before queries
```

**UI patterns**:
```markdown
## UI Patterns

- Import types from @/lib/actions (never duplicate)
- Use <Badge variant="..."> for status indicators
- Form submissions use useTransition for loading states
```

### Don't Add

- Story-specific details ("implemented US-003")
- Temporary debugging notes
- Things already in progress.txt

### Where to Add

- **Module-specific**: Create/update `directory/CLAUDE.md`
- **Project-wide**: Update root `CLAUDE.md`

---

## Step 8: Commit

Commit all changes with the standard message format:

```bash
git add .
git commit -m "feat: ${STORY_ID} - ${STORY_TITLE}"
```

**Example**:
```bash
git commit -m "feat: US-002 - Display priority indicator on task cards"
```

---

## Step 9: Update PRD

Mark the story as complete in `prd.json`:

```typescript
const prd = JSON.parse(fs.readFileSync('prd.json', 'utf8'));

// Find and update the story
const storyIndex = prd.userStories.findIndex(s => s.id === completedStoryId);
prd.userStories[storyIndex].passes = true;

// Write back
fs.writeFileSync('prd.json', JSON.stringify(prd, null, 2));
```

---

## Step 10: Update Progress

Append to `progress.txt` (never replace, always append):

```markdown
## 2026-01-13 14:30 - US-002

Iteration: 3

**Implemented:**
- Added priority badge component to task cards
- Color coding: red=high, yellow=medium, gray=low
- Badge visible without hover/click

**Files Changed:**
- components/TaskCard.tsx - Added <Badge> with priority colors
- lib/types.ts - Exported Priority type

**Learnings for future iterations:**
- Badge component already exists at components/ui/badge.tsx, reused it
- Priority colors defined in tailwind.config.ts, matched existing palette
- Card layout uses CSS Grid, added badge to header slot

**Quality Checks:**
- ✅ Typecheck passed
- ✅ Lint passed  
- ✅ Verified in browser - badges display correctly

---
```

### Learnings Section is Critical

Help future iterations by documenting:
- Patterns you discovered
- Gotchas you encountered  
- Useful context about the codebase
- What worked well / what didn't

---

## Step 11: Signal Completion

### If All Stories Complete

Create `.ralph_complete` file:

```bash
echo "All user stories completed at iteration $(jq -r '.currentIteration' .ralph_state.json)" > .ralph_complete
```

Then output:
```
🎉 All Ralph stories completed! All user stories have passes=true.
```

### If More Stories Remain

Remove `.ralph_trigger` file:

```bash
rm -f .ralph_trigger
```

Then output:
```
✅ Story US-002 completed. 3 stories remaining.
```

---

## CLAUDE.md - Pattern Storage

**CRITICAL**: This system uses `CLAUDE.md`, NOT `AGENTS.md`.

### Why CLAUDE.md?

- Explicitly for Claude Code agents
- Distinguishes from generic agent instructions
- Establishes Claude Code ecosystem convention

### CLAUDE.md Structure

```markdown
# [Module/Directory Name] - Claude Patterns

## Overview
Brief description of what this directory/module does.

## Patterns

- Pattern 1: When doing X, always do Y
- Pattern 2: Use Z pattern for all A operations
- Pattern 3: Component B expects data in format C

## Gotchas

- Gotcha 1: Don't forget to update D when changing E
- Gotcha 2: Field names must match template exactly
- Gotcha 3: This module runs before F, so G isn't available yet

## Dependencies

- Depends on: ../other-module for shared types
- Exports: Used by UI components in /app
- External: Requires API_KEY environment variable

## Examples

[Optional - helpful code snippets]

## Last Updated

YYYY-MM-DD - [Brief context of what was learned]
```

### Example: Database CLAUDE.md

```markdown
# Database Layer - Claude Patterns

## Overview
Database schema, migrations, and query utilities using better-sqlite3.

## Patterns

- Use sql<number> template literal for parameterized queries (prevents SQL injection)
- Always include IF NOT EXISTS in CREATE TABLE statements
- Migrations in db/migrations/, numbered sequentially
- Use transactions for multi-step operations

## Gotchas

- Run migrations before starting dev server (npm run db:migrate)
- Schema changes require new migration file, don't edit existing ones
- INTEGER PRIMARY KEY gives auto-increment behavior in SQLite
- TEXT columns need explicit DEFAULT if required

## Dependencies

- Depends on: better-sqlite3 package
- Exports: Used by lib/db.ts (connection pool)
- Schema: Defined in db/schema.sql

## Examples

```typescript
// Good: Parameterized query
const tasks = db.prepare(
  sql`SELECT * FROM tasks WHERE status = ?`
).all(status);

// Bad: String concatenation
const tasks = db.prepare(
  `SELECT * FROM tasks WHERE status = '${status}'` // SQL injection risk!
).all();
```

## Last Updated

2026-01-13 - Added pattern for IF NOT EXISTS, parameterized queries
```

---

## Common Mistakes to Avoid

### ❌ Don't Skip Pattern Reading

Reading CLAUDE.md and progress.txt patterns is NOT optional. Skipping this leads to:
- Repeating mistakes from previous iterations
- Breaking existing patterns
- Wasting time rediscovering solutions

### ❌ Don't Make Stories Too Big

If a story can't be completed in one iteration, it's too big. But you can't split it mid-iteration. If you realize this:
1. Complete what you can
2. Note in progress.txt that story needs splitting
3. User can manually split it for next run

### ❌ Don't Skip Quality Checks

NEVER commit without running:
- Typecheck
- Lint
- Tests (if story has testable logic)
- Browser verification (if UI changes)

Broken commits break the autonomous loop.

### ❌ Don't Forget to Update All Files

After completing a story, you MUST update:
- [ ] prd.json (set passes: true)
- [ ] progress.txt (append entry with learnings)
- [ ] CLAUDE.md (if patterns discovered)
- [ ] .ralph_trigger or .ralph_complete (signal status)

Missing any of these breaks the loop.

---

## Debugging

If something goes wrong:

### Check State Files

```bash
# Current iteration
cat .ralph_state.json

# Stories remaining  
jq '.userStories[] | select(.passes == false) | .id' prd.json

# Recent progress
tail -n 50 progress.txt
```

### Check Git Status

```bash
# Uncommitted changes?
git status

# Recent commits
git log --oneline -5

# On correct branch?
git branch --show-current
```

### Manual Recovery

If iteration fails partway:
1. Review what was completed
2. Manually commit if needed
3. Update prd.json manually if story was actually done
4. Remove .ralph_trigger to allow next iteration
5. Document issue in progress.txt

---

## Success Criteria

An iteration is successful when:

✅ Story implemented completely
✅ All acceptance criteria met
✅ Quality checks pass (typecheck, lint, tests, browser)
✅ Changes committed with proper message
✅ prd.json updated (story passes=true)
✅ progress.txt updated with learnings
✅ CLAUDE.md updated if patterns discovered
✅ Completion signal sent (.ralph_trigger removed OR .ralph_complete created)

---

## Remember

You are ONE iteration in a larger autonomous loop. Your job is to:
1. **Learn** from previous iterations (read CLAUDE.md, progress.txt)
2. **Implement** one story completely and correctly
3. **Document** what you learned for future iterations
4. **Signal** your status clearly

The better you document patterns and learnings, the better future iterations will perform.

**Focus on ONE story. Do it completely. Do it right. Document it well.**