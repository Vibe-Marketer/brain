# ADR Quick Reference

```text
┌─────────────────────────────────────────┐
│         VIBEY ADR QUICK REF            │
├─────────────────────────────────────────┤
│ WHEN: Big technical choice made         │
│ WHERE: docs/adr/adr-XXX-title.md       │
│ HOW LONG: 10-15 minutes max            │
│                                         │
│ SECTIONS:                               │
│ 1. Context (the problem)               │
│ 2. Decision (what we chose)            │
│ 3. Consequences (pros/cons/neutral)    │
│                                         │
│ WRITE IF:                               │
│ ✓ Affects 3+ future features           │
│ ✓ New dev would ask "why?"             │
│ ✓ Hard to reverse (>4 hours work)      │
│                                         │
│ DON'T WRITE IF:                         │
│ ✗ UI/styling choices                   │
│ ✗ Bug fixes                            │
│ ✗ Easy to change later                 │
└─────────────────────────────────────────┘
```

## 15-Minute ADR Workflow

1. **[2 min]** Copy template, number it, add title
2. **[3 min]** Brain dump context (bullet points OK initially)
3. **[2 min]** Write decision sentence + rationale
4. **[4 min]** List consequences (use AI if stuck)
5. **[2 min]** Clean up, save, commit
6. **[2 min]** Update README index

## AI Assist Prompt

If you get stuck, paste this to your AI:

```text
I'm documenting this technical decision for my SaaS:

Decision: [what you decided]
Why: [1-2 sentence reason]

Help me write:
1. A Context section (what problem/constraints led here)
2. A Consequences section (2-3 pros, 2-3 cons, 1-2 neutral)

Keep it concise and specific to a vibe-coding workflow.
```
