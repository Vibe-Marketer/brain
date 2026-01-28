---
description: Review PRD, user flow, prompt, or agent spec against One-Click Promise principles
argument-hint: <file-path or paste content>
---

<objective>
Review the provided artifact against the One-Click Promise principles to identify unnecessary friction, missing defaults, and automation opportunities.
</objective>

<process>
1. Load the skill at `.claude/skills/one-click-review/SKILL.md`
2. Read the principles reference at `.claude/skills/one-click-review/references/principles.md`
3. If $ARGUMENTS is a file path, read the file
4. If $ARGUMENTS is pasted content, use it directly
5. Follow the skill's review process exactly
6. Output the structured review format from the skill
</process>

<success_criteria>
- Decision Test applied to every user action in the artifact
- All 10 principles checked
- Specific, actionable fixes provided
- Findings ranked by impact
</success_criteria>
