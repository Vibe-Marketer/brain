# Ralph - Autonomous AI Agent

A drop-in autonomous coding agent that implements features using Claude Code CLI.

## Quick Start

```bash
# 1. Copy into your project
cp -r ralph/ /path/to/your/project/

# 2. Run setup
cd /path/to/your/project/ralph && ./setup.sh

# 3. Create PRD and run
claude -p "Run /prd for [your feature]"
./ralph.sh
```

## How It Works

Ralph spawns fresh Claude Code CLI instances in a loop:

```bash
for i in 1..MAX; do
    cat prompt.md | claude --print --dangerously-skip-permissions
done
```

Each iteration:
1. Reads `prd.json` to find the next story
2. Reads `config.json` for quality check commands
3. Reads `progress.txt` and `CLAUDE.md` for context
4. Implements one story
5. Runs quality checks
6. Commits and updates state
7. Outputs `<promise>COMPLETE</promise>` when all done

## Files

| File | Purpose |
|------|---------|
| `ralph.sh` | Main loop - spawns Claude instances |
| `setup.sh` | One-time setup - detects project, creates config |
| `prompt.md` | Instructions for each iteration |
| `config.json` | Project-specific quality commands |
| `prd.json` | User stories to implement |
| `progress.txt` | Memory between iterations |
| `skills/` | Available skills (/prd, /dev-browser, etc.) |

## Creating PRDs

Use the `/prd` skill:
```bash
claude -p "Run /prd for adding user authentication"
```

Or manually create `prd.json`:
```json
{
  "projectName": "My App",
  "featureName": "Auth",
  "branchName": "feature/auth",
  "userStories": [
    {
      "id": "US-001",
      "title": "Add users table",
      "priority": 1,
      "acceptanceCriteria": ["Migration runs", "typecheck passes"],
      "passes": false
    }
  ]
}
```

## Configuration

`config.json` (created by setup.sh):
```json
{
  "qualityCommands": "npm run typecheck && npm run lint",
  "testCommands": "npm test",
  "buildCommands": "npm run build",
  "defaultBranch": "main"
}
```

Edit this to match your project's tooling.

## Memory System

**Short-term (progress.txt):**
- Learnings from current feature
- Reset when starting new feature

**Long-term (CLAUDE.md files):**
- Project patterns throughout codebase
- Persist across features

**Git history:**
- Code changes
- Commit messages

## Skills Included

| Skill | Purpose |
|-------|---------|
| `/prd` | Generate PRDs and prd.json |
| `/dev-browser` | Browser automation, screenshots, UI testing |
| `/frontend-design` | High-quality UI components |
| `/compound-engineering` | Plan->Work->Review->Compound workflow |
| `/pdf` | PDF extraction and manipulation |
| `/docx` | Word document handling |

## Troubleshooting

**Stories not completing:** Split into smaller stories
**Quality checks failing:** Edit `config.json` with correct commands
**Wrong branch:** Check `branchName` in prd.json
**Stuck:** Check `progress.txt` for errors

## Architecture

```
ralph.sh
   │
   ├── Loop iteration 1
   │   └── claude --print < prompt.md
   │       ├── Read: prd.json, config.json, progress.txt
   │       ├── Implement US-001
   │       ├── Run quality checks
   │       └── Commit & update state
   │
   ├── Loop iteration 2
   │   └── claude --print < prompt.md
   │       └── Implement US-002...
   │
   └── Exit when <promise>COMPLETE</promise> detected
```

Each iteration is **stateless** - fresh Claude instance, no memory.
All context comes from files on disk.
