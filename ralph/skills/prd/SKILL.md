---
name: prd
description: "Generate a Product Requirements Document (PRD) for a new feature. Use when planning a feature, starting a new project, or when asked to create a PRD. Triggers on: /prd, create prd, write prd for, plan this feature, requirements for, spec out."
---

# PRD Generator

Create detailed Product Requirements Documents that are clear, actionable, and suitable for autonomous implementation with Ralph.

---

## The Job

1. Receive a feature description from the user
2. Ask 3-5 essential clarifying questions (with lettered options)
3. Generate a structured PRD based on answers
4. Save BOTH formats:
   - `ralph/prd.json` - For Ralph autonomous execution (contains US-001, US-002, etc.)
   - `tasks/prd-{NNN}-{feature-name}.md` - Human-readable PRD documentation

To get the next number (or match existing spec number):
```bash
# If spec exists, use its number. Otherwise find next available.
NEXT=$(ls specs/ 2>/dev/null | grep -E '^spec-[0-9]{3}-' | sort -r | head -1 | sed 's/spec-//' | cut -c1-3)
[ -z "$NEXT" ] && NEXT=$(ls tasks/ 2>/dev/null | grep -E '^prd-[0-9]{3}-' | sort -r | head -1 | sed 's/prd-//' | cut -c1-3 | awk '{printf "%03d", $1+1}')
[ -z "$NEXT" ] && NEXT="001"
```

**Important:** Do NOT start implementing. Just create the PRD.

---

## Step 1: Clarifying Questions

Ask only critical questions where the initial prompt is ambiguous. Focus on:

- **Problem/Goal:** What problem does this solve?
- **Core Functionality:** What are the key actions?
- **Scope/Boundaries:** What should it NOT do?
- **Success Criteria:** How do we know it's done?

### Format Questions Like This:

```
1. What is the primary goal of this feature?
   A. Improve user onboarding experience
   B. Increase user retention
   C. Reduce support burden
   D. Other: [please specify]

2. Who is the target user?
   A. New users only
   B. Existing users only
   C. All users
   D. Admin users only

3. What's the scope?
   A. Minimal viable version
   B. Full-featured implementation
   C. Just the backend/API
   D. Just the UI
```

This lets users respond with "1A, 2C, 3B" for quick iteration.

---

## Step 2: Create User Stories

Each story must be:
- **Small enough** to complete in one Claude context window (~15-20 min of work)
- **Self-contained** with clear acceptance criteria
- **Ordered by dependency** (database first, then backend, then UI)

### Right-sized Stories (Good)
- Add a database column + migration
- Create a single UI component
- Implement one API endpoint
- Add a filter to an existing list

### Too Big (Split These)
- "Build the entire dashboard" -> Split into: schema, queries, components, filters
- "Add authentication" -> Split into: schema, middleware, login UI, signup UI

**Rule of thumb:** If you can't describe the change in 2-3 sentences, it's too big.

---

## Step 3: Order by Dependencies

Typical order:
1. Schema/database changes (no dependencies) - priority 1
2. Server actions / backend logic - priority 2
3. UI components - priority 3
4. Integration / polish - priority 4

Lower priority number = executed first.

---

## Step 4: Save Both Formats

### A. Save `ralph/prd.json` (for Ralph execution)

```json
{
  "projectName": "[From context or ask]",
  "featureName": "[Feature being built]",
  "branchName": "feature/[kebab-case-name]",
  "description": "[One paragraph description]",
  "userStories": [
    {
      "id": "US-001",
      "title": "Short action-oriented title",
      "priority": 1,
      "description": "As a [user], I want [feature] so that [benefit].",
      "acceptanceCriteria": [
        "Specific verifiable criterion",
        "Another criterion",
        "npm run typecheck passes"
      ],
      "passes": false
    }
  ]
}
```

### B. Save `tasks/prd-{NNN}-{feature-name}.md` (human-readable)

Full markdown PRD with all sections (see PRD Structure below).

---

## PRD Structure (Markdown)

### 1. Introduction/Overview
Brief description of the feature and the problem it solves.

### 2. Goals
Specific, measurable objectives (bullet list).

### 3. User Stories
Each story needs:
- **Title:** Short descriptive name
- **Description:** "As a [user], I want [feature] so that [benefit]"
- **Acceptance Criteria:** Verifiable checklist of what "done" means

**Format:**
```markdown
### US-001: [Title]
**Description:** As a [user], I want [feature] so that [benefit].

**Acceptance Criteria:**
- [ ] Specific verifiable criterion
- [ ] Another criterion
- [ ] npm run typecheck passes
- [ ] **[UI stories only]** Verify in browser using dev-browser skill
```

**Important:**
- Acceptance criteria must be verifiable, not vague. "Works correctly" is bad. "Button shows confirmation dialog before deleting" is good.
- **For any story with UI changes:** Always include "Verify in browser using dev-browser skill" as acceptance criteria.

### 4. Functional Requirements
Numbered list of specific functionalities:
- "FR-1: The system must allow users to..."
- "FR-2: When a user clicks X, the system must..."

### 5. Non-Goals (Out of Scope)
What this feature will NOT include. Critical for managing scope.

### 6. Design Considerations (Optional)
- UI/UX requirements
- Link to mockups if available
- Relevant existing components to reuse

### 7. Technical Considerations (Optional)
- Known constraints or dependencies
- Integration points with existing systems

### 8. Open Questions
Remaining questions or areas needing clarification.

---

## Step 5: Initialize Progress File

If `ralph/progress.txt` doesn't exist or is from a different feature, create it:

```markdown
# Ralph Progress Log

## Codebase Patterns
<!-- Patterns discovered during implementation will be added here -->

---

Started: [current date]
Feature: [feature name]
```

---

## Step 6: Confirm Setup

Show the user what was created:

```
Created:
- ralph/prd.json (for Ralph execution)
- tasks/prd-{NNN}-{feature-name}.md (documentation)

Project: [name]
Feature: [feature]
Branch: [branch name]

Stories (in execution order):
1. US-001: [title]
2. US-002: [title]
...

To run Ralph:
  cd ralph && ./ralph.sh

To run with more iterations:
  cd ralph && ./ralph.sh 20
```

---

## Acceptance Criteria Guidelines

Every story MUST include verifiable criteria:

**Good (verifiable):**
- "Add `priority` column to tasks table with default 'medium'"
- "Filter dropdown has options: All, High, Medium, Low"
- "npm run typecheck passes"
- "npm test passes"

**Bad (vague):**
- "Works correctly"
- "Good UX"
- "Handles edge cases"

**Always include:**
- `npm run typecheck passes` (or equivalent for the project)
- For UI changes: specific visual/behavioral requirements + "Verify in browser using dev-browser skill"

---

## Example Output

### ralph/prd.json

```json
{
  "projectName": "TaskFlow",
  "featureName": "Task Priority System",
  "branchName": "feature/task-priority",
  "description": "Add priority levels (high/medium/low) to tasks with visual indicators and filtering.",
  "userStories": [
    {
      "id": "US-001",
      "title": "Add priority field to database",
      "priority": 1,
      "description": "As a developer, I need to store task priority so it persists across sessions.",
      "acceptanceCriteria": [
        "Add priority column: 'high' | 'medium' | 'low' (default 'medium')",
        "Migration runs successfully",
        "npm run typecheck passes"
      ],
      "passes": false
    },
    {
      "id": "US-002",
      "title": "Display priority badge on task cards",
      "priority": 2,
      "description": "As a user, I want to see task priority at a glance.",
      "acceptanceCriteria": [
        "Task card shows colored badge (red=high, yellow=medium, gray=low)",
        "Badge visible without interaction",
        "npm run typecheck passes",
        "Verify in browser using dev-browser skill"
      ],
      "passes": false
    }
  ]
}
```

### tasks/prd-001-task-priority.md

```markdown
# PRD: Task Priority System

## Introduction
Add priority levels to tasks so users can focus on what matters most...

[Full markdown PRD content]
```

---

## Checklist

Before finishing:

- [ ] Asked clarifying questions with lettered options
- [ ] Stories are small (one context window each)
- [ ] Stories ordered by dependency (lower priority = earlier)
- [ ] Every story has verifiable acceptance criteria
- [ ] Every story has "typecheck passes" criterion
- [ ] UI stories have "Verify in browser" criterion
- [ ] Saved `ralph/prd.json`
- [ ] Saved `tasks/prd-{NNN}-{feature-name}.md`
- [ ] Initialized `ralph/progress.txt` if needed
- [ ] Showed user how to run Ralph
