---
name: one-click-review
description: Reviews PRDs, user flows, prompts, and agent specs against the One-Click Promise principles. Use when evaluating whether an artifact minimizes user friction, uses smart defaults, and respects cognitive budget.
---

<objective>
Analyze artifacts against the One-Click Promise philosophy to identify unnecessary complexity, missing defaults, excessive user decisions, and opportunities for automation. Output specific violations with actionable improvements.
</objective>

<scope>
**What to review:**
- Product Requirements Documents (PRDs)
- User flows and interaction designs
- Prompts and AI agent behavior specs
- Onboarding sequences
- Form designs and data collection flows
- Error handling and recovery flows

**What this skill does NOT cover:**
- Code quality or architecture review
- Visual design aesthetics
- Technical implementation details
</scope>

<process>
1. **Read the reference** - Load `references/principles.md` to have the full framework

2. **Identify the artifact type** - PRD, user flow, prompt, agent spec, or other

3. **Apply the Decision Test first** - For each user action required:
   > "Would a thoughtful person regret it if we just did this for them?"
   - **No** → Flag as automation opportunity
   - **Yes** → Acceptable decision point, but check if it can be a confirmation vs. open question

4. **Scan for principle violations** - Check each of the 10 principles against the artifact

5. **For AI/agent artifacts** - Also apply the 7 Agent Guidelines

6. **Output the review** using this structure:

```
## One-Click Review

**Artifact:** [name/description]
**Type:** [PRD | User Flow | Prompt | Agent Spec | Other]

### Decision Test Results
[List each user action and whether it passes the test]

### Violations Found
[For each violation:]
- **Principle X:** [principle name]
  - **Where:** [specific location in artifact]
  - **Issue:** [what's wrong]
  - **Fix:** [specific improvement]

### Automation Opportunities
[Things that could be done for the user without asking]

### Quick Wins
[Easiest changes with highest impact]

### Summary
[One paragraph: overall assessment and priority recommendations]
```
</process>

<evaluation_lens>
When reviewing, ask these questions:

- Where is the user being asked something we could figure out ourselves?
- What fields have no default when one could be inferred?
- Where does jargon appear instead of plain language?
- What multi-step processes could be single actions?
- Where do errors require user problem-solving vs. auto-resolution?
- What decisions are being asked that the user doesn't care about?
- Is confirmation used instead of interrogation where possible?
</evaluation_lens>

<success_criteria>
A complete review:
- Applies the Decision Test to every user action
- Checks all 10 principles (not just the obvious ones)
- Provides specific, actionable fixes (not vague suggestions)
- Identifies at least one automation opportunity if any exist
- Ranks findings by impact
- Uses plain language in the review itself (practicing what it preaches)
</success_criteria>
