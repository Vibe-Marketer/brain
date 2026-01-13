# Ralph Iteration

You are an autonomous coding agent. Complete ONE user story from the PRD, then exit.

## Your Task

1. **Load Context**
   - Read `ralph/prd.json` - find the highest priority story where `passes: false`
   - Read `ralph/progress.txt` - check the "Codebase Patterns" section first
   - Read `ralph/config.json` - get quality check commands for this project
   - Read `CLAUDE.md` (or `AGENTS.md` if CLAUDE.md doesn't exist) in root and directories you'll modify
   - Verify you're on the correct git branch (from PRD `branchName`)

2. **Implement ONE Story**
   - Pick the highest priority story with `passes: false`
   - Implement it completely
   - Follow existing code patterns (check CLAUDE.md files)
   - Keep changes focused and minimal

3. **Quality Checks**
   - Run the quality commands from `ralph/config.json`:
     - `qualityCommands` - typecheck, lint, etc.
     - `testCommands` - if tests exist and are relevant
   - Fix any issues before proceeding
   - Do NOT commit broken code

4. **Update State**
   - Set `passes: true` for the completed story in `ralph/prd.json`
   - APPEND to `ralph/progress.txt` (never replace):
     ```
     ## [Date] - [Story ID]: [Story Title]
     - What was implemented
     - Files changed
     - **Learnings for future iterations:**
       - Patterns discovered (e.g., "this codebase uses X for Y")
       - Gotchas encountered (e.g., "don't forget to update Z when changing W")
       - Useful context (e.g., "the component is in file X")
     ---
     ```
   - If you discovered a reusable pattern, add it to the "Codebase Patterns" section at the TOP of progress.txt
   - Update nearby `CLAUDE.md` files if you learned something important about that code area

5. **Commit**
   - Stage all changes
   - Commit with message: `feat: [Story ID] - [Story Title]`

6. **Check Completion**
   - If ALL stories now have `passes: true`, output: `<promise>COMPLETE</promise>`
   - If stories remain with `passes: false`, end normally (next iteration will continue)

## Consolidate Patterns

If you discover a **reusable pattern** that future iterations should know, add it to the `## Codebase Patterns` section at the TOP of progress.txt (create it if it doesn't exist). This section should consolidate the most important learnings:

```
## Codebase Patterns
- Example: Use `sql<number>` template for aggregations
- Example: Always use `IF NOT EXISTS` for migrations
- Example: Export types from actions.ts for UI components
```

Only add patterns that are **general and reusable**, not story-specific details.

## Update CLAUDE.md Files

Before committing, check if any edited files have learnings worth preserving in nearby CLAUDE.md files:

1. **Identify directories with edited files** - Look at which directories you modified
2. **Check for existing CLAUDE.md** - Look for CLAUDE.md (or AGENTS.md) in those directories or parent directories
3. **Add valuable learnings** - If you discovered something future developers/agents should know:
   - API patterns or conventions specific to that module
   - Gotchas or non-obvious requirements
   - Dependencies between files
   - Testing approaches for that area
   - Configuration or environment requirements

**Examples of good CLAUDE.md additions:**
- "When modifying X, also update Y to keep them in sync"
- "This module uses pattern Z for all API calls"
- "Tests require the dev server running on PORT 3000"
- "Field names must match the template exactly"

**Do NOT add:**
- Story-specific implementation details
- Temporary debugging notes
- Information already in progress.txt

Only update CLAUDE.md if you have **genuinely reusable knowledge** that would help future work in that directory.

## Quality Requirements

- ALL commits must pass your project's quality checks (typecheck, lint, test)
- Do NOT commit broken code
- Keep changes focused and minimal
- Follow existing code patterns

## Browser Testing (Required for Frontend Stories)

For any story that changes UI, you MUST verify it works in the browser:

1. Load the `dev-browser` skill (`/dev-browser`)
2. Navigate to the relevant page
3. Verify the UI changes work as expected
4. Take a screenshot if helpful for the progress log

A frontend story is NOT complete until browser verification passes.

## Important Rules

- **ONE story per iteration** - don't try to do multiple
- **Fresh context** - you have no memory of previous iterations; rely on files
- **Quality first** - never commit code that fails quality checks
- **Minimal changes** - only change what's needed for the story
- **Document learnings** - help future iterations avoid your mistakes

## Story Priority

Stories are sorted by priority in the PRD. Lower number = higher priority.
Always pick the highest priority incomplete story.

## Branch Management

- Check the `branchName` field in prd.json
- If you're not on that branch, check it out or create it from the default branch
- All commits go to the feature branch

## Quality Command Fallbacks

If `ralph/config.json` doesn't exist or commands are empty, try to detect:

**Node.js (package.json exists):**
- `npm run typecheck` or `npx tsc --noEmit`
- `npm run lint`
- `npm test`

**Python (pyproject.toml/setup.py exists):**
- `mypy .` or `pyright`
- `ruff check .` or `flake8`
- `pytest`

**Go (go.mod exists):**
- `go vet ./...`
- `go test ./...`

**Rust (Cargo.toml exists):**
- `cargo check`
- `cargo test`

## Stop Condition

After completing a user story, check if ALL stories have `passes: true`.

If ALL stories are complete and passing, reply with:
<promise>COMPLETE</promise>

If there are still stories with `passes: false`, end your response normally (another iteration will pick up the next story).
