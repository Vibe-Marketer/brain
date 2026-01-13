#!/bin/bash
# Ralph Setup - Prepares a project for Ralph autonomous development
# Run this once after copying ralph/ into a new project

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Ralph Setup${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
echo ""

# Check dependencies
log_info "Checking dependencies..."

if ! command -v claude &> /dev/null; then
  log_error "Claude Code CLI not found"
  echo "  Install with: npm install -g @anthropic-ai/claude-code"
  exit 1
fi
log_success "Claude Code CLI found: $(claude --version 2>/dev/null | head -1)"

if ! command -v jq &> /dev/null; then
  log_error "jq not found"
  echo "  Install with: brew install jq (macOS) or apt install jq (Linux)"
  exit 1
fi
log_success "jq found"

if ! command -v git &> /dev/null; then
  log_error "git not found"
  exit 1
fi
log_success "git found"

# Initialize git if needed
cd "$PROJECT_ROOT"
if [ ! -d ".git" ]; then
  log_warn "No git repository found. Initializing..."
  git init
  log_success "Git repository initialized"
else
  log_success "Git repository exists"
fi

# Detect project type and quality commands
log_info "Detecting project type..."

QUALITY_COMMANDS=""
BUILD_COMMANDS=""
TEST_COMMANDS=""

# Node.js / TypeScript
if [ -f "package.json" ]; then
  log_success "Detected: Node.js project"

  # Check for common scripts
  if jq -e '.scripts.typecheck' package.json > /dev/null 2>&1; then
    QUALITY_COMMANDS="npm run typecheck"
  elif jq -e '.scripts.tsc' package.json > /dev/null 2>&1; then
    QUALITY_COMMANDS="npm run tsc"
  fi

  if jq -e '.scripts.lint' package.json > /dev/null 2>&1; then
    QUALITY_COMMANDS="${QUALITY_COMMANDS:+$QUALITY_COMMANDS && }npm run lint"
  fi

  if jq -e '.scripts.test' package.json > /dev/null 2>&1; then
    TEST_COMMANDS="npm test"
  fi

  if jq -e '.scripts.build' package.json > /dev/null 2>&1; then
    BUILD_COMMANDS="npm run build"
  fi

# Python
elif [ -f "pyproject.toml" ] || [ -f "setup.py" ] || [ -f "requirements.txt" ]; then
  log_success "Detected: Python project"

  if [ -f "pyproject.toml" ]; then
    if grep -q "mypy" pyproject.toml 2>/dev/null; then
      QUALITY_COMMANDS="mypy ."
    fi
    if grep -q "ruff" pyproject.toml 2>/dev/null; then
      QUALITY_COMMANDS="${QUALITY_COMMANDS:+$QUALITY_COMMANDS && }ruff check ."
    elif grep -q "flake8" pyproject.toml 2>/dev/null; then
      QUALITY_COMMANDS="${QUALITY_COMMANDS:+$QUALITY_COMMANDS && }flake8 ."
    fi
    if grep -q "pytest" pyproject.toml 2>/dev/null; then
      TEST_COMMANDS="pytest"
    fi
  fi

# Go
elif [ -f "go.mod" ]; then
  log_success "Detected: Go project"
  QUALITY_COMMANDS="go vet ./..."
  TEST_COMMANDS="go test ./..."
  BUILD_COMMANDS="go build ./..."

# Rust
elif [ -f "Cargo.toml" ]; then
  log_success "Detected: Rust project"
  QUALITY_COMMANDS="cargo check"
  TEST_COMMANDS="cargo test"
  BUILD_COMMANDS="cargo build"

# Ruby
elif [ -f "Gemfile" ]; then
  log_success "Detected: Ruby project"
  if grep -q "rubocop" Gemfile 2>/dev/null; then
    QUALITY_COMMANDS="bundle exec rubocop"
  fi
  if grep -q "rspec" Gemfile 2>/dev/null; then
    TEST_COMMANDS="bundle exec rspec"
  fi

# Java/Kotlin (Gradle)
elif [ -f "build.gradle" ] || [ -f "build.gradle.kts" ]; then
  log_success "Detected: Gradle project"
  QUALITY_COMMANDS="./gradlew check"
  TEST_COMMANDS="./gradlew test"
  BUILD_COMMANDS="./gradlew build"

# Java (Maven)
elif [ -f "pom.xml" ]; then
  log_success "Detected: Maven project"
  QUALITY_COMMANDS="mvn verify -DskipTests"
  TEST_COMMANDS="mvn test"
  BUILD_COMMANDS="mvn package"

else
  log_warn "Could not auto-detect project type"
  log_info "You may need to configure quality commands manually in ralph/config.json"
fi

# Create config file
CONFIG_FILE="$SCRIPT_DIR/config.json"
cat > "$CONFIG_FILE" << EOF
{
  "qualityCommands": "${QUALITY_COMMANDS:-echo 'No quality checks configured'}",
  "testCommands": "${TEST_COMMANDS:-echo 'No tests configured'}",
  "buildCommands": "${BUILD_COMMANDS:-echo 'No build configured'}",
  "defaultBranch": "main"
}
EOF
log_success "Created ralph/config.json"

# Migrate AGENTS.md to CLAUDE.md if it exists
if [ -f "$PROJECT_ROOT/AGENTS.md" ] && [ ! -f "$PROJECT_ROOT/CLAUDE.md" ]; then
  log_info "Found AGENTS.md, migrating to CLAUDE.md..."
  mv "$PROJECT_ROOT/AGENTS.md" "$PROJECT_ROOT/CLAUDE.md"
  if git rev-parse --git-dir > /dev/null 2>&1; then
    git add "$PROJECT_ROOT/CLAUDE.md"
    git commit -m "chore: migrate AGENTS.md to CLAUDE.md" 2>/dev/null || true
  fi
  log_success "Migrated AGENTS.md to CLAUDE.md"
fi

# Create root CLAUDE.md if it doesn't exist
if [ ! -f "$PROJECT_ROOT/CLAUDE.md" ]; then
  PROJECT_NAME=$(basename "$PROJECT_ROOT")
  cat > "$PROJECT_ROOT/CLAUDE.md" << EOF
# ${PROJECT_NAME} - Claude Patterns

## Overview
<!-- Brief description of this project -->

## Tech Stack
<!-- List key technologies, frameworks, and tools -->

## Code Patterns
<!-- Document patterns future iterations should follow -->

## Quality Commands
\`\`\`bash
${QUALITY_COMMANDS:-# Configure your quality check commands}
${TEST_COMMANDS:+$TEST_COMMANDS}
${BUILD_COMMANDS:+$BUILD_COMMANDS}
\`\`\`

## Gotchas
<!-- Non-obvious things to watch out for -->

## Ralph Integration
This project uses Ralph for autonomous development. See \`ralph/README.md\`.

To run Ralph:
\`\`\`bash
cd ralph && ./ralph.sh
\`\`\`

## Last Updated
$(date +%Y-%m-%d) - Initial setup
EOF
  log_success "Created root CLAUDE.md"
else
  log_success "Root CLAUDE.md already exists"
fi

# Initialize progress.txt
if [ ! -f "$SCRIPT_DIR/progress.txt" ]; then
  cat > "$SCRIPT_DIR/progress.txt" << EOF
# Ralph Progress Log

## Codebase Patterns
<!-- Patterns discovered during implementation will be added here -->

---

Initialized: $(date)
EOF
  log_success "Created ralph/progress.txt"
fi

# Create specs and tasks directories if they don't exist
mkdir -p "$PROJECT_ROOT/specs"
mkdir -p "$PROJECT_ROOT/tasks"
log_success "Created specs/ and tasks/ directories"

# Symlink skills to .claude/skills/ so Claude Code can find them
mkdir -p "$PROJECT_ROOT/.claude/skills"
for skill in "$SCRIPT_DIR/skills"/*; do
  if [ -d "$skill" ]; then
    skill_name=$(basename "$skill")
    if [ ! -e "$PROJECT_ROOT/.claude/skills/$skill_name" ]; then
      ln -s "../../ralph/skills/$skill_name" "$PROJECT_ROOT/.claude/skills/$skill_name"
    fi
  fi
done
log_success "Linked skills to .claude/skills/"

# Summary
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  Setup Complete${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
echo ""
echo "Detected quality commands:"
echo "  ${QUALITY_COMMANDS:-None detected - configure in ralph/config.json}"
echo ""
echo "Next steps:"
echo "  1. Review and edit CLAUDE.md with project-specific patterns"
echo "  2. Review ralph/config.json and adjust commands if needed"
echo ""
echo "To use Ralph, just say:"
echo "  ralph add [feature]"
echo ""
echo "Or manually:"
echo "  /prd [feature]     - Create PRD only"
echo "  cd ralph && ./ralph.sh  - Run the loop"
echo ""
