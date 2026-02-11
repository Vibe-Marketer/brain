# Ralph - Autonomous AI Agent

Drop this folder into any project. Tell Claude "ralph [feature]" and watch it build.

## Usage

```
You: ralph add dark mode to settings

Claude: [asks 2-3 quick questions]
Claude: [creates PRD with stories]
Claude: [runs autonomous loop]
Claude: Done! Dark mode implemented in 4 commits.
```

That's it. No manual setup required.

---

## How to Install

```bash
# Copy ralph/ into your project
cp -r ralph/ /path/to/your/project/
```

Then just talk to Claude:
- "ralph add user authentication"
- "ralph implement search functionality"
- "ralph plan and build a dashboard"

---

## What Happens

1. **Auto-Setup** - Detects your project type, creates config
2. **Quick Questions** - 2-3 clarifying questions (answer like "1A, 2B")
3. **PRD Created** - Stories broken into small, implementable chunks
4. **Autonomous Loop** - Ralph implements each story, commits, repeats
5. **Done** - All stories complete, feature built

---

## Requirements

- **Claude Code CLI**: `npm install -g @anthropic-ai/claude-code`
- **jq**: `brew install jq` (macOS) or `apt install jq` (Linux)
- **Git**: For version control

---

## Supported Projects

Auto-detects and configures for:
- Node.js / TypeScript
- Python
- Go
- Rust
- Ruby
- Java / Kotlin

---

## Files

```
ralph/
├── ralph.sh          # Main loop
├── setup.sh          # Auto-setup (runs automatically)
├── prompt.md         # Instructions per iteration
├── config.json       # Quality commands (created by setup)
├── prd.json          # Stories (created when you say "ralph [feature]")
├── progress.txt      # Memory between iterations
└── skills/           # Available skills
```

---

## Manual Commands

```bash
# Run Ralph manually (after prd.json exists)
cd ralph && ./ralph.sh

# Run with more iterations
cd ralph && ./ralph.sh 25

# Check remaining stories
jq '.userStories[] | select(.passes == false)' ralph/prd.json

# Watch progress
tail -f ralph/progress.txt
```

---

## How It Works

```
┌──────────────────────────────────────────────┐
│  "ralph add dark mode"                       │
└──────────────────┬───────────────────────────┘
                   ▼
┌──────────────────────────────────────────────┐
│  1. Auto-setup (if needed)                   │
│  2. Ask clarifying questions                 │
│  3. Create prd.json with stories             │
└──────────────────┬───────────────────────────┘
                   ▼
┌──────────────────────────────────────────────┐
│  ralph.sh loop:                              │
│                                              │
│  for each iteration:                         │
│    claude --print < prompt.md                │
│      → Pick next story                       │
│      → Implement it                          │
│      → Run quality checks                    │
│      → Commit                                │
│      → Mark story done                       │
│                                              │
│  until: all stories pass                     │
└──────────────────────────────────────────────┘
```

Each iteration is a fresh Claude instance. Memory persists via files.

---

## Tips

1. **Keep it simple** - "ralph add X" is usually enough
2. **Answer quickly** - "1A, 2B" style answers speed things up
3. **Stories are small** - Each fits in one context window
4. **Review commits** - Ralph commits frequently, review before push

---

## Philosophy

> "Ralph is deterministically bad in an undeterministic world. Better to fail predictably than succeed unpredictably."
> — Geoffrey Huntley

- **Iteration over perfection** - Let the loop refine the work
- **Small stories compound** - Each makes the next easier
- **Memory through files** - Git, progress.txt, CLAUDE.md persist knowledge

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `claude: command not found` | `npm install -g @anthropic-ai/claude-code` |
| `jq: command not found` | `brew install jq` or `apt install jq` |
| Stories too big | They'll be split automatically |
| Stuck | Check `ralph/progress.txt` for errors |

---

## Credits

Based on the **Ralph Wiggum** pattern by [Geoffrey Huntley](https://ghuntley.com/ralph/).
