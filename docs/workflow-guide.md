# Optimal Claude Code Workflow Guide

**Goal**: Maximize speed and accuracy by using the right tool for each situation.

---

## THE GOLDEN RULE: Start Simple, Escalate When Needed

Most tasks don't need complex workflows. Use this escalation ladder:

```
Level 1: Direct Request     → Just ask Claude directly (80% of tasks)
Level 2: Slash Command      → Use when you need specialized analysis
Level 3: Multi-Agent        → Use for complex, multi-step projects
```

---

## QUICK REFERENCE: What To Use When

### For Speed

| Task Type | FAST Approach | SLOW (Avoid Unless Needed) |
|-----------|---------------|---------------------------|
| Simple edit | Direct request | /sc:implement |
| Bug fix | Describe error directly | /sc:troubleshoot (use for complex only) |
| New feature | Direct request + TodoWrite | /sc:brainstorm → /sc:design → /sc:implement |
| Code review | `/code-review` | Multiple review commands |
| UI work | Direct + Playwright verify | Full /design-review |

### Decision Tree: Which Command?

```
Is this a quick fix (<10 min)?
  YES → Just ask directly, no commands needed
  NO  → Continue...

Do I need to understand unfamiliar code first?
  YES → Use Task(Explore) agent OR /codebase-analyst
  NO  → Continue...

Is this UI/frontend work?
  YES → Implement directly, then verify with Playwright
        If major UI → /conversion-brain-commands:brain-ui-consistency-review
  NO  → Continue...

Is this a multi-step feature (>3 files)?
  YES → Ask Claude to plan with TodoWrite, then execute
        If very complex → /sc:implement or PRP workflow
  NO  → Continue...

Ready to merge/PR?
  YES → /code-review (quick) or /security-review (if auth/data)
  NO  → Keep working
```

---

## FAST WORKFLOWS BY TASK TYPE

### 1. Quick Bug Fix (5-15 min)

```
YOU: "There's an error in [file] where [describe issue]"
CLAUDE: Reads file, fixes it, done.
```

No commands needed. Just describe the problem clearly.

### 2. Small Feature (15-60 min)

```
YOU: "Add [feature] to [location]"
CLAUDE:
  1. Uses TodoWrite to break down steps
  2. Implements each step
  3. Marks complete as it goes
```

**Speed tip**: Let Claude use TodoWrite - it keeps things organized without overhead.

### 3. Larger Feature (1-4 hours)

```
YOU: "I want to build [complex feature]"

Option A (Faster - Direct with Planning):
  → Claude uses TodoWrite for breakdown
  → Implements step by step
  → You verify at checkpoints

Option B (More Structured - PRP Workflow):
  → /prp:1-story-task-create [description]
  → Review the generated PRP
  → /prp:3-story-task-execute [prp-file]
```

### 4. UI/Design Work

```
FAST PATH:
1. Describe what you want
2. Claude implements
3. Claude uses Playwright to screenshot and verify
4. Quick check against brand guidelines

THOROUGH PATH (before PR):
→ /conversion-brain-commands:brain-ui-consistency-review [path]
```

### 5. Code Review (Before Merge)

```
QUICK (most PRs):
→ /code-review

SECURITY-SENSITIVE (auth, payments, user data):
→ /security-review

UI CHANGES:
→ /design-review-agent (requires dev server running)
```

---

## SUPERCLAUDE COMMANDS: WHEN TO ACTUALLY USE THEM

### High-Value Commands (Use Often)

| Command | When | Speed Impact |
|---------|------|--------------|
| `/sc:recommend` | Unsure what to use | Saves decision time |
| `/sc:implement` | Complex feature with many files | Coordinates well |
| `/sc:troubleshoot` | Debugging complex issues | Systematic diagnosis |
| `/sc:analyze --focus security` | Before deploying auth changes | Catches vulnerabilities |

### Medium-Value Commands (Use Sometimes)

| Command | When | Speed Impact |
|---------|------|--------------|
| `/sc:brainstorm` | Requirements unclear | Good for discovery |
| `/sc:design` | Need architecture decisions | Prevents rework |
| `/sc:research` | Unfamiliar technology | Comprehensive research |
| `/sc:test` | Need test coverage | Automated test generation |

### Low-Value for Speed (Use Rarely)

| Command | Why Skip | Alternative |
|---------|----------|-------------|
| `/sc:pm` | Often overkill | Direct requests |
| `/sc:spawn` | Complex orchestration | Break into smaller tasks |
| `/sc:spec-panel` | Multi-expert panels | Direct code review |

---

## PROJECT-SPECIFIC COMMANDS: CONVERSION BRAIN

### Essential (Know These)

| Command | Use Case | Speed |
|---------|----------|-------|
| `/code-review` | Before any PR | Fast |
| `/security-review` | Auth/data changes | Medium |
| `/codebase-analyst` | Find patterns | Medium |
| `/library-researcher` | New library docs | Medium |

### Conversion Brain Specific

| Command | Use Case |
|---------|----------|
| `/conversion-brain-commands:brain-prime-simple` | Quick context loading |
| `/conversion-brain-commands:brain-ui-consistency-review [path]` | Verify brand compliance |
| `/conversion-brain-commands:brain-alpha-review` | Project-specific code review |
| `/conversion-brain-commands:brain-rca [issue]` | Root cause analysis |

---

## SPEED OPTIMIZATION TIPS

### 1. Parallel Execution
When asking for multiple independent things, Claude can do them in parallel:
```
"Read these 3 files and tell me how they connect"
→ Claude reads all 3 in parallel (faster than sequential)
```

### 2. Be Specific Upfront
```
SLOW: "Fix the bug"
FAST: "Fix the null error in src/hooks/useAuth.ts line 45 where user.id is accessed before checking if user exists"
```

### 3. Use TodoWrite for Multi-Step Tasks
It keeps Claude organized and shows you progress. Worth the small overhead.

### 4. Skip Unnecessary Reviews
- Quick typo fix? No review needed
- Internal refactor? Maybe just /code-review
- User-facing auth change? Full /security-review

### 5. Context Priming (Start of Session)
If starting fresh on Conversion Brain:
```
/conversion-brain-commands:brain-prime-simple
```
Gets Claude up to speed in ~30 seconds.

---

## WORKFLOW EXAMPLES

### Example 1: "Add a new API endpoint"

```
YOU: "Add an endpoint to fetch user preferences"

CLAUDE:
1. TodoWrite: Plan the steps
2. Create Edge Function (supabase/functions/fetch-user-preferences/)
3. Add to api-client.ts (fetchUserPreferences)
4. Test the endpoint
5. Mark complete

Time: 15-30 min, no special commands needed
```

### Example 2: "Something's broken in production"

```
YOU: "Users are getting 500 errors on the settings page"

FAST PATH:
→ Claude investigates directly, checks logs, finds issue

IF COMPLEX:
→ /conversion-brain-commands:brain-rca "500 errors on settings page"
→ Generates systematic RCA report
```

### Example 3: "Build a new dashboard widget"

```
YOU: "Add a call volume chart to the analytics dashboard"

CLAUDE:
1. TodoWrite: Break down (design, implement, test)
2. Check brand guidelines for chart styling
3. Implement component
4. Use Playwright to screenshot and verify
5. Done

BEFORE PR:
→ /conversion-brain-commands:brain-ui-consistency-review src/components/analytics/
```

### Example 4: "I need to refactor the auth system"

```
This is complex - use structured approach:

1. /sc:analyze src/contexts/AuthContext.tsx --focus architecture
2. Review findings, plan approach
3. /sc:implement "refactor auth to [new pattern]"
   OR
   /prp:1-story-task-create "Refactor authentication system to..."
   Then execute the PRP
```

---

## WHEN THINGS GO WRONG

### Claude Seems Confused
```
→ Be more specific in your request
→ Break into smaller steps
→ Use /conversion-brain-commands:brain-prime-simple to reset context
```

### Task Taking Too Long
```
→ Is TodoWrite being used? (helps track progress)
→ Break into smaller pieces
→ Ask for checkpoint verification
```

### Quality Issues
```
→ Use /code-review before considering done
→ For UI: verify with Playwright screenshots
→ For security: /security-review
```

---

## SUMMARY: YOUR SPEED-OPTIMIZED WORKFLOW

```
1. START SIMPLE
   → Direct requests for most tasks
   → Let Claude use TodoWrite for organization

2. ESCALATE WHEN NEEDED
   → Complex debugging → /sc:troubleshoot
   → Multi-file features → /sc:implement or PRP
   → Unfamiliar code → Task(Explore) agent

3. VERIFY BEFORE MERGE
   → /code-review (always)
   → /security-review (auth/data)
   → UI consistency check (frontend)

4. CONTEXT MANAGEMENT
   → /brain-prime-simple at session start
   → Let TodoWrite track progress
   → Break complex work into sessions
```

**The fastest workflow is often the simplest one. Use commands to augment, not replace, direct communication.**
