---
name: ralph
description: "Autonomous feature development. Say 'ralph [feature]' to spec, plan, and implement a feature autonomously. Runs: spec → PRD → implementation loop."
---

# Ralph - Autonomous Feature Development

When you say "ralph [feature]", this skill:
1. **Spec** - Clarifies requirements by asking targeted questions
2. **PRD** - Creates user stories from the spec
3. **Loop** - Implements each story autonomously

## Full Workflow

### Phase 1: Setup (Auto)

Check if Ralph is set up:
```bash
ls ralph/config.json 2>/dev/null || (cd ralph && ./setup.sh)
```

### Phase 2: Spec

Run the spec skill to clarify requirements:

1. Read relevant codebase files
2. Ask 2-4 clarifying questions using AskUserQuestion tool
3. Create `specs/spec-{NNN}-{feature-name}.md` (auto-numbered)

**Example questions (use AskUserQuestion):**
```
1. What's the primary goal?
   A. [Option based on feature]
   B. [Option]
   C. Other

2. What's the scope?
   A. Just this component
   B. System-wide
   C. Backend only
   D. Frontend only
```

### Phase 3: PRD

Convert the spec into `ralph/prd.json`:

1. Read the spec from `specs/spec-{NNN}-{feature-name}.md`
2. Break into small user stories (one context window each)
3. Order by dependency (database → backend → frontend)
4. Save both:
   - `ralph/prd.json` - For execution (contains US-001, US-002, etc.)
   - `tasks/prd-{NNN}-{feature-name}.md` - PRD documentation (same number as spec)

**prd.json format:**
```json
{
  "projectName": "[from CLAUDE.md or directory]",
  "featureName": "[feature name]",
  "branchName": "feature/[kebab-case]",
  "description": "[from spec summary]",
  "specFile": "specs/spec-{NNN}-{feature-name}.md",
  "userStories": [
    {
      "id": "US-001",
      "title": "[action-oriented title]",
      "priority": 1,
      "description": "As a [user], I want [feature] so that [benefit]",
      "acceptanceCriteria": [
        "Specific criterion from spec",
        "Quality checks pass"
      ],
      "passes": false
    }
  ]
}
```

**Story sizing:**
- Each story = ONE context window (~15 min work)
- Database changes → priority 1
- Backend logic → priority 2
- Frontend UI → priority 3
- Integration → priority 4

### Phase 4: Execute

**Use the Bash tool** to run the Ralph loop:

```bash
cd ralph && ./ralph.sh
```

This spawns fresh Claude Code instances in a loop until all stories have `passes: true`.

**Important:** The ralph.sh script runs `claude --print --dangerously-skip-permissions` which creates new, fresh context windows with full autonomous permissions. You (Claude) should run this script using the Bash tool, and it will autonomously complete all stories.

---

## Quick Example

**User:** ralph add dark mode

**Claude:**
1. Reads codebase, finds theme-related files
2. Asks via AskUserQuestion:
   - Theme storage? (localStorage / database / CSS only)
   - Scope? (settings page / whole app)
3. Creates `specs/spec-025-dark-mode.md` (SPEC-025)
4. Creates `ralph/prd.json` + `tasks/prd-025-dark-mode.md` (PRD-025) with:
   - US-001: Add theme preference to settings
   - US-002: Create ThemeProvider component
   - US-003: Add toggle to settings page
   - US-004: Apply theme to all components
5. **Uses Bash tool** to run `cd ralph && ./ralph.sh`
6. ralph.sh spawns fresh Claude instances that implement each story
7. Reports completion when all stories pass

---

## File Locations

| File | Purpose |
|------|---------|
| `specs/spec-{NNN}-{feature}.md` | SPEC-{NNN}: Specification |
| `tasks/prd-{NNN}-{feature}.md` | PRD-{NNN}: Product Requirements |
| `ralph/prd.json` | US-001, US-002, etc.: User Stories for execution |
| `ralph/progress.txt` | Iteration memory |
| `ralph/config.json` | Project quality commands |

---

## Using AskUserQuestion

Always use the AskUserQuestion tool for clarifications. Format:

```
Questions should be:
- 2-4 at a time max
- Reference actual code when possible
- Provide options (A, B, C, D)
- Allow "Other" for custom answers
```

User can respond like "1A, 2B" for speed.

---

## When Spec Isn't Needed

For very simple, clear requests, you can skip spec:
- "ralph fix the typo in Button.tsx"
- "ralph add console.log to debug X"

For these, go straight to PRD → Loop.

---

## Tips

- Keep stories small - split if complex
- Reference spec in story descriptions
- Ralph commits after each story
- Check `ralph/progress.txt` for learnings
