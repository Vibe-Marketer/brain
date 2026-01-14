#!/bin/bash
# Ralph - Autonomous AI Agent Loop
# Runs Claude Code repeatedly until all PRD stories are complete
#
# Usage:
#   ./ralph.sh [max_iterations]     # Run normally
#   ./ralph.sh --resume             # Resume from last crashed state
#   ./ralph.sh --status             # Show current status dashboard
#
# Features:
# - Works with PRD .md files directly from prd/ folder
# - Full session logging to logs/YYYY-MM-DD-HHMMSS.log
# - Auto-purge old logs (keeps 5 most recent)
# - Resume capability to pick up from crashes
# - Persistent status dashboard header
#
# Requirements:
# - Claude Code CLI installed (claude command)
# - jq installed (for JSON parsing)
# - prd/ folder with PRD-*.md files

set -e

RESUME=false
SHOW_STATUS=false
WATCH_MODE=false
if [[ "$1" == "--resume" ]]; then
  RESUME=true
  shift
elif [[ "$1" == "--status" ]]; then
  SHOW_STATUS=true
  shift
elif [[ "$1" == "--watch" ]]; then
  WATCH_MODE=true
  shift
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PRD_DIR="$SCRIPT_DIR/prd"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"
ARCHIVE_DIR="$SCRIPT_DIR/archive"
LAST_BRANCH_FILE="$SCRIPT_DIR/.last-branch"
COMPLETED_PRDS_FILE="$SCRIPT_DIR/.completed-prds.txt"
LOG_DIR="$SCRIPT_DIR/logs"
STATE_FILE="$LOG_DIR/state.json"

calculate_iterations() {
  if [ ! -d "$PRD_DIR" ]; then
    echo 10
    return
  fi

  local total_prds=$(ls "$PRD_DIR"/PRD-*.md 2>/dev/null | wc -l)

  if [ -z "$total_prds" ] || [ "$total_prds" -eq 0 ]; then
    echo 10
    return
  fi

  local completed=$(cat "$COMPLETED_PRDS_FILE" 2>/dev/null | grep -v '^$' | wc -l)
  local remaining_prds=$((total_prds - completed))

  if [ "$remaining_prds" -le 0 ]; then echo 0; return; fi

  local iterations=$((remaining_prds + 10))
  echo $iterations
}

auto_iterations=$(calculate_iterations)
if [ -n "$1" ]; then
  MAX_ITERATIONS=$1
elif [ "$RESUME" == true ]; then
  if [ -f "$STATE_FILE" ]; then
    MAX_ITERATIONS=$(jq -r '.maxIterations' "$STATE_FILE" 2>/dev/null || echo 10)
  else
    MAX_ITERATIONS=$auto_iterations
  fi
else
  MAX_ITERATIONS=$auto_iterations
fi

TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)
RUN_LOG_FILE="$LOG_DIR/$TIMESTAMP.log"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${YELLOW}[INFO]${NC} $1" | tee -a "$RUN_LOG_FILE"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" | tee -a "$RUN_LOG_FILE"; }
log_done() { echo -e "${GREEN}[DONE]${NC} $1" | tee -a "$RUN_LOG_FILE"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1" | tee -a "$RUN_LOG_FILE"; }
log_header()  { echo -e "${BOLD}$1${NC}"; }
log_dashboard() { echo -e "${CYAN}$1${NC}"; }

BOLD='\033[1m'
CYAN='\033[0;36m'

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

get_next_prd() {
  local completed=$(cat "$COMPLETED_PRDS_FILE" 2>/dev/null | grep -v '^$' | sort)

  for prd_file in "$PRD_DIR"/PRD-*.md; do
    if [ -f "$prd_file" ]; then
      local prd_name=$(basename "$prd_file" .md)
      if ! echo "$completed" | grep -q "^${prd_name}$"; then
        echo "$prd_file"
        return 0
      fi
    fi
  done
  return 1
}

get_prd_id() {
  local prd_file="$1"
  basename "$prd_file" .md
}

get_prd_title() {
  local prd_file="$1"
  head -1 "$prd_file" | sed 's/^# PRD-[0-9]*: //'
}

get_remaining_count() {
  local next_prd=$(get_next_prd)
  if [ -z "$next_prd" ]; then
    echo "0 PRDs remaining"
  else
    local total=$(ls "$PRD_DIR"/PRD-*.md 2>/dev/null | wc -l)
    local completed=$(cat "$COMPLETED_PRDS_FILE" 2>/dev/null | grep -v '^$' | wc -l)
    local remaining_prds=$((total - completed))
    echo "$remaining_prds PRDs remaining"
  fi
}

get_total_count() {
  ls "$PRD_DIR"/PRD-*.md 2>/dev/null | wc -l
}

get_total_ac() {
  grep -h "^- \[ \]" "$PRD_DIR"/PRD-*.md 2>/dev/null | wc -l
}

get_current_story() {
  local next_prd=$(get_next_prd)
  if [ -n "$next_prd" ]; then
    get_prd_id "$next_prd"
  else
    echo "none"
  fi
}

display_story_status() {
  local completed=$(cat "$COMPLETED_PRDS_FILE" 2>/dev/null | grep -v '^$' | sort)
  local total=$(get_total_count)
  local completed_count=$(echo "$completed" | grep -v '^$' | wc -l)
  local remaining=$((total - completed_count))

  echo "  PRD Status: $completed_count/$total completed, $remaining remaining"
  echo ""
  echo "  Completed PRDs:"
  if [ -n "$completed" ]; then
    echo "$completed" | sed 's/^/    - /'
  else
    echo "    (none yet)"
  fi
}

draw_progress_bar() {
  local width=40
  local total=$1
  local current=$2
  local label=$3

  if [ "$total" -eq 0 ]; then
    printf "%-30s [%s] 0%%" "$label" "$(printf '#%.0s' $(seq 1 $width) | tr ' ' '.')"
    return
  fi

  local pct=$((current * 100 / total))
  local filled=$((width * current / total))
  local empty=$((width - filled))

  local bar=$(printf '#%.0s' $(seq 1 $filled) 2>/dev/null || echo "")
  [ ${#bar} -lt $filled ] && bar=$(printf '#%.0s' $(seq 1 $filled))
  local dots=$(printf '.%.0s' $(seq 1 $empty) 2>/dev/null || echo "")
  [ ${#dots} -lt $empty ] && dots=$(printf '.%.0s' $(seq 1 $empty))

  printf "%-30s [%s%s] %d%%" "$label" "$bar" "$dots" "$pct"
}

get_progress_stats() {
  local total=$(get_total_count)
  local completed=$(cat "$COMPLETED_PRDS_FILE" 2>/dev/null | grep -v '^$' | wc -l)
  local remaining=$((total - completed))

  local total_ac=$(grep -h "^- \[ \]" "$PRD_DIR"/PRD-*.md 2>/dev/null | wc -l)
  local done_ac=$(grep -h "^- \[x\]" "$PRD_DIR"/PRD-*.md 2>/dev/null | wc -l)

  echo "$total|$completed|$remaining|$total_ac|$done_ac"
}

watch_progress() {
  local delay=3
  local last_completed=-1

  echo ""
  log_info "Watching progress... (Ctrl+C to stop)"
  echo ""

  while true; do
    stats=$(get_progress_stats)
    total=$(echo "$stats" | cut -d'|' -f1)
    completed=$(echo "$stats" | cut -d'|' -f2)
    remaining=$(echo "$stats" | cut -d'|' -f3)
    total_ac=$(echo "$stats" | cut -d'|' -f4)
    done_ac=$(echo "$stats" | cut -d'|' -f5)

    if [ "$completed" != "$last_completed" ]; then
      echo -e "${GREEN}[UPDATE]${NC} Progress changed: $completed PRDs complete"
      last_completed=$completed
    fi

    printf "\033[2J\033[H"

    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  Ralph Progress Watch${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
    echo ""

    if [ -n "$total" ] && [ "$total" -gt 0 ]; then
      draw_progress_bar $total $completed "PRDs Complete"
      echo ""
      echo ""

      if [ -n "$total_ac" ] && [ "$total_ac" -gt 0 ]; then
        draw_progress_bar $total_ac $done_ac "Acceptance Criteria"
        echo ""
        echo ""
      fi

      next_prd=$(get_next_prd)
      if [ -n "$next_prd" ]; then
        prd_id=$(get_prd_id "$next_prd")
        prd_title=$(get_prd_title "$next_prd")
        echo "  Current: $prd_id"
        echo "  $prd_title"
      fi

      echo ""
      echo "  Completed: $completed / $total PRDs"
      echo "  Remaining: $remaining PRDs"
    else
      echo "  No PRDs found in $PRD_DIR"
    fi

    echo ""
    log_info "Refreshing in ${delay}s... (Ctrl+C to exit)"

    sleep $delay
  done
}

load_state() {
  if [ -f "$STATE_FILE" ]; then
    local iter=$(jq -r '.currentIteration' "$STATE_FILE" 2>/dev/null || echo "0")
    local remaining=$(jq -r '.remainingStories' "$STATE_FILE" 2>/dev/null || echo "?")
    log_info "Loaded state: iteration $iter, $remaining stories remaining"
  fi
}

save_state() {
  local iteration=${1:-1}
  local current_story=$(get_current_story)
  local remaining=$(get_remaining_count)

  mkdir -p "$LOG_DIR"
  cat > "$STATE_FILE" << EOF
{
  "currentIteration": $iteration,
  "maxIterations": $MAX_ITERATIONS,
  "status": "running",
  "startTime": "$(date -Iseconds)",
  "lastUpdate": "$(date -Iseconds)",
  "remainingStories": $remaining,
  "currentStory": "$current_story"
}
EOF
}

mkdir -p "$LOG_DIR"
mkdir -p "$ARCHIVE_DIR"
touch "$COMPLETED_PRDS_FILE"

if [ "$SHOW_STATUS" == true ]; then
  check_deps
  load_state || true
  echo ""

  log_dashboard "═══════════════════════════════════════════════════════"
  log_dashboard "  Ralph Status Dashboard"
  log_dashboard "═══════════════════════════════════════════════════════"
  echo ""

  stats=$(get_progress_stats)
  total=$(echo "$stats" | cut -d'|' -f1)
  completed=$(echo "$stats" | cut -d'|' -f2)
  remaining=$(echo "$stats" | cut -d'|' -f3)
  total_ac=$(echo "$stats" | cut -d'|' -f4)
  done_ac=$(echo "$stats" | cut -d'|' -f5)

  if [ -n "$total" ] && [ "$total" -gt 0 ]; then
    echo "  Progress:"
    echo ""
    draw_progress_bar $total $completed "    PRDs"
    echo ""
    echo ""

    if [ -n "$total_ac" ] && [ "$total_ac" -gt 0 ]; then
      draw_progress_bar $total_ac $done_ac "    AC"
      echo ""
      echo ""
    fi

    next_prd=$(get_next_prd)
    if [ -n "$next_prd" ]; then
      prd_id=$(get_prd_id "$next_prd")
      prd_title=$(get_prd_title "$next_prd")
      echo "  Current PRD: $prd_id"
      echo "  $prd_title"
      echo ""
    fi

    echo "  Stats: $completed/$total PRDs complete, $remaining remaining"
  else
    echo "  No PRDs found in $PRD_DIR"
  fi

  echo ""
  log_info "Log files in logs/:"
  ls -1t "$LOG_DIR"/*.log 2>/dev/null | head -5 | while read -r log; do
    echo "  - $(basename "$log")"
  done

  if [ -f "$STATE_FILE" ]; then
    echo ""
    log_info "Current state:"
    calc_iterations=$(calculate_iterations)
    jq -r '"  Iteration: \(.currentIteration)/\(.maxIterations)", "  Auto-calculated: \(.currentIteration)/'${calc_iterations}'", "  Status: \(.status)", "  Current: \(.currentStory)"' "$STATE_FILE" 2>/dev/null || true
  fi

  calc_iterations=$(calculate_iterations)
  echo ""
  log_info "Next run will use: $calc_iterations iterations (based on remaining PRDs + 10)"
  echo ""
  echo "  Options:"
  echo "    ./ralph.sh              - Run next iteration"
  echo "    ./ralph.sh --watch      - Watch progress live"
  echo "    ./ralph.sh --resume     - Resume from crash"
  echo "    ./ralph.sh --status     - Show this dashboard"

  next_prd=$(get_next_prd)
  if [ -z "$next_prd" ]; then
    log_done "All PRDs completed!"
  fi
  exit 0
fi

if [ "$WATCH_MODE" == true ]; then
  watch_progress
  exit 0
fi

main() {
  check_deps

  echo ""
  log_header "═══════════════════════════════════════════════════════"
  log_header "  Ralph - Autonomous AI Agent Loop"
  log_header "═══════════════════════════════════════════════════════"
  echo ""

  if [ ! -d "$PRD_DIR" ]; then
    log_error "No prd/ folder found in $SCRIPT_DIR"
    exit 1
  fi

  local next_prd=$(get_next_prd)
  if [ -z "$next_prd" ]; then
    log_done "All PRDs completed! Check .completed-prds.txt"
    echo ""
    display_story_status
    exit 0
  fi

  local prd_id=$(get_prd_id "$next_prd")
  local prd_title=$(get_prd_title "$next_prd")
  local total=$(get_total_count)
  local remaining=$(get_remaining_count)

  log_dashboard "═══════════════════════════════════════════════════════"
  log_dashboard "  PRD: $prd_id"
  log_dashboard "═══════════════════════════════════════════════════════"
  log_info "Project: $PROJECT_ROOT"
  log_info "Feature: $prd_title"
  log_info "PRDs remaining: $remaining of $total"
  log_info "Max iterations: $MAX_ITERATIONS"
  log_info "Resume enabled: $RESUME"
  log_info "State file: $STATE_FILE"
  log_info "Log file: $RUN_LOG_FILE"
  echo ""

  save_state 1

  log_info "Switching to branch for: $prd_id"

  local branch_name=$(echo "$prd_id" | tr '[:upper:]' '[:lower:]')

  if [ -f "$LAST_BRANCH_FILE" ]; then
    local last_branch=$(cat "$LAST_BRANCH_FILE")
    if [ "$last_branch" != "$branch_name" ] && [ "$RESUME" == false ]; then
      log_info "Archiving last run files..."
      mkdir -p "$ARCHIVE_DIR/$(date +%Y-%m-%d)"
      if [ -f "$STATE_FILE" ]; then
        cp "$STATE_FILE" "$ARCHIVE_DIR/$(date +%Y-%m-%d)/state.json"
      fi
    fi
  fi

  if git show-ref --verify --quiet refs/heads/$branch_name; then
    log_info "Switching to existing branch: $branch_name"
    git checkout $branch_name 2>/dev/null || git checkout -b $branch_name
  else
    log_info "Creating new branch: $branch_name"
    git checkout -b $branch_name 2>/dev/null || git checkout $branch_name
  fi

  echo "$branch_name" > "$LAST_BRANCH_FILE"

  log_info "Running Claude Code for: $prd_id"

  cd "$PROJECT_ROOT"
  claude --dangerously-skip-permissions -p "Run the ralph-executor skill to implement all acceptance criteria in $next_prd. Read the PRD file, implement all incomplete acceptance criteria, update the .md file to mark completed AC with [x], and create a marker file when all AC are complete. Output a summary of what was implemented." 2>&1 | tee -a "$RUN_LOG_FILE"

  local exit_code=${PIPESTATUS[0]}

  cd "$SCRIPT_DIR"

  if [ -f "$SCRIPT_DIR/.prd_complete_${prd_id}" ]; then
    log_done "$prd_id completed!"
    echo "$prd_id" >> "$COMPLETED_PRDS_FILE"
    rm -f "$SCRIPT_DIR/.prd_complete_${prd_id}"

    log_info "Checking for more PRDs..."
    next=$(get_next_prd)
    if [ -z "$next" ]; then
      log_done "All PRDs completed!"
      echo ""
      display_story_status
      exit 0
    fi
  fi

  if [ $exit_code -eq 0 ]; then
    log_info "Iteration completed successfully"
  else
    log_error "Iteration failed with exit code: $exit_code"
    log_info "Resume with: ./ralph.sh --resume"
  fi

  save_state 2

  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  Progress Summary${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo ""

  stats=$(get_progress_stats)
  total=$(echo "$stats" | cut -d'|' -f1)
  completed=$(echo "$stats" | cut -d'|' -f2)
  remaining=$(echo "$stats" | cut -d'|' -f3)
  total_ac=$(echo "$stats" | cut -d'|' -f4)
  done_ac=$(echo "$stats" | cut -d'|' -f5)

  if [ -n "$total" ] && [ "$total" -gt 0 ]; then
    draw_progress_bar $total $completed "  PRDs"
    echo ""
    echo ""

    if [ -n "$total_ac" ] && [ "$total_ac" -gt 0 ]; then
      draw_progress_bar $total_ac $done_ac "  AC"
      echo ""
      echo ""
    fi

    next_prd=$(get_next_prd)
    if [ -n "$next_prd" ]; then
      prd_id=$(get_prd_id "$next_prd")
      echo "  Next: $prd_id"
    fi
  fi

  echo ""
  echo "  Options:"
  echo "    ./ralph.sh              - Run next iteration"
  echo "    ./ralph.sh --watch      - Watch progress live (recommended!)"
  echo "    ./ralph.sh --resume     - Resume from crash"
  echo "    ./ralph.sh --status     - Show dashboard"
  echo ""
}

main
