#!/bin/bash
# Ralph - Autonomous AI Agent Loop
# Runs Claude Code repeatedly until all PRD stories are complete
#
# Usage: ./ralph.sh [max_iterations]
#
# Requirements:
# - Claude Code CLI installed (claude command)
# - jq installed (for JSON parsing)
# - prd.json in this directory with user stories

set -e

MAX_ITERATIONS=${1:-10}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PRD_FILE="$SCRIPT_DIR/prd.json"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
ARCHIVE_DIR="$SCRIPT_DIR/archive"
LAST_BRANCH_FILE="$SCRIPT_DIR/.last-branch"

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

# Check dependencies
check_deps() {
  if ! command -v claude &> /dev/null; then
    log_error "Claude Code CLI not found. Install with: npm install -g @anthropic-ai/claude-code"
    exit 1
  fi
  if ! command -v jq &> /dev/null; then
    log_error "jq not found. Install with: brew install jq (macOS) or apt install jq (Linux)"
    exit 1
  fi
}

# Archive previous run if branch changed
archive_if_branch_changed() {
  if [ -f "$PRD_FILE" ] && [ -f "$LAST_BRANCH_FILE" ]; then
    CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
    LAST_BRANCH=$(cat "$LAST_BRANCH_FILE" 2>/dev/null || echo "")

    if [ -n "$CURRENT_BRANCH" ] && [ -n "$LAST_BRANCH" ] && [ "$CURRENT_BRANCH" != "$LAST_BRANCH" ]; then
      DATE=$(date +%Y-%m-%d)
      FOLDER_NAME=$(echo "$LAST_BRANCH" | sed 's|^ralph/||' | sed 's|/|-|g')
      ARCHIVE_FOLDER="$ARCHIVE_DIR/$DATE-$FOLDER_NAME"

      log_info "Archiving previous run: $LAST_BRANCH"
      mkdir -p "$ARCHIVE_FOLDER"
      [ -f "$PRD_FILE" ] && cp "$PRD_FILE" "$ARCHIVE_FOLDER/"
      [ -f "$PROGRESS_FILE" ] && cp "$PROGRESS_FILE" "$ARCHIVE_FOLDER/"
      log_success "Archived to: $ARCHIVE_FOLDER"

      # Reset progress file
      init_progress_file
    fi
  fi
}

# Track current branch
track_branch() {
  if [ -f "$PRD_FILE" ]; then
    CURRENT_BRANCH=$(jq -r '.branchName // empty' "$PRD_FILE" 2>/dev/null || echo "")
    if [ -n "$CURRENT_BRANCH" ]; then
      echo "$CURRENT_BRANCH" > "$LAST_BRANCH_FILE"
    fi
  fi
}

# Initialize progress file
init_progress_file() {
  cat > "$PROGRESS_FILE" << 'EOF'
# Ralph Progress Log

## Codebase Patterns
<!-- Add reusable patterns discovered during implementation -->

---

EOF
  echo "Started: $(date)" >> "$PROGRESS_FILE"
  echo "" >> "$PROGRESS_FILE"
}

# Check for remaining stories
get_remaining_count() {
  if [ -f "$PRD_FILE" ]; then
    jq '[.userStories[] | select(.passes == false)] | length' "$PRD_FILE" 2>/dev/null || echo "0"
  else
    echo "0"
  fi
}

# Main execution
main() {
  check_deps

  echo ""
  echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}  Ralph - Autonomous AI Agent Loop${NC}"
  echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
  echo ""

  # Check for PRD
  if [ ! -f "$PRD_FILE" ]; then
    log_error "No prd.json found in $SCRIPT_DIR"
    log_info "Create one with: claude -p 'Run /prd to create a PRD for [your feature]'"
    log_info "Or copy prd.json.example and customize it"
    exit 1
  fi

  # Show PRD info
  PROJECT=$(jq -r '.projectName // "Unknown"' "$PRD_FILE")
  FEATURE=$(jq -r '.featureName // "Unknown"' "$PRD_FILE")
  TOTAL_STORIES=$(jq '.userStories | length' "$PRD_FILE")
  REMAINING=$(get_remaining_count)

  log_info "Project: $PROJECT"
  log_info "Feature: $FEATURE"
  log_info "Stories: $REMAINING remaining of $TOTAL_STORIES total"
  log_info "Max iterations: $MAX_ITERATIONS"
  echo ""

  # Archive if branch changed
  archive_if_branch_changed
  track_branch

  # Initialize progress file if needed
  if [ ! -f "$PROGRESS_FILE" ]; then
    init_progress_file
  fi

  # Main loop
  for i in $(seq 1 $MAX_ITERATIONS); do
    REMAINING=$(get_remaining_count)

    if [ "$REMAINING" -eq 0 ]; then
      echo ""
      log_success "All stories complete! Nothing to do."
      exit 0
    fi

    echo ""
    echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BOLD}  Iteration $i of $MAX_ITERATIONS ($REMAINING stories remaining)${NC}"
    echo -e "${BOLD}═══════════════════════════════════════════════════════${NC}"
    echo ""

    # Run Claude Code with the prompt from project root
    # Fresh context each iteration (no --continue)
    # Must run from PROJECT_ROOT so paths like ralph/prd.json work
    OUTPUT=$(cd "$PROJECT_ROOT" && cat "$SCRIPT_DIR/prompt.md" | claude --print --dangerously-skip-permissions 2>&1 | tee /dev/stderr) || true

    # Check for completion signal
    if echo "$OUTPUT" | grep -q "<promise>COMPLETE</promise>"; then
      echo ""
      log_success "Ralph completed all stories!"
      log_info "Finished at iteration $i of $MAX_ITERATIONS"
      exit 0
    fi

    # Brief pause between iterations
    sleep 2
  done

  echo ""
  log_warn "Reached max iterations ($MAX_ITERATIONS)"
  REMAINING=$(get_remaining_count)
  log_info "$REMAINING stories still incomplete"
  log_info "Run again with: ./ralph.sh $((MAX_ITERATIONS * 2))"
  exit 1
}

main "$@"
