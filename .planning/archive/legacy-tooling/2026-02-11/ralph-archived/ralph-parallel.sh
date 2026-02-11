#!/bin/bash
# Ralph Parallel Runner
# Spawns multiple Ralph instances to work on PRDs in parallel
#
# Usage:
#   ./ralph-parallel.sh [num_workers]
#   ./ralph-parallel.sh 3          # Run 3 parallel workers
#   ./ralph-parallel.sh            # Default: 5 workers

MAX_WORKERS=${1:-5}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRD_DIR="$SCRIPT_DIR/prd"
COMPLETED_PRDS_FILE="$SCRIPT_DIR/.completed-prds.txt"
IN_PROGRESS_FILE="$SCRIPT_DIR/.in-progress-prds.txt"
LOCK_DIR="$SCRIPT_DIR/.ralph-locks"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info() { echo -e "${YELLOW}[INFO]${NC} $1"; }
log_done() { echo -e "${GREEN}[DONE]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

mkdir -p "$LOCK_DIR"
touch "$COMPLETED_PRDS_FILE"
touch "$IN_PROGRESS_FILE"

get_next_unclaimed_prd() {
  local completed=$(cat "$COMPLETED_PRDS_FILE" 2>/dev/null | grep -v '^$' | sort)
  local in_progress=$(cat "$IN_PROGRESS_FILE" 2>/dev/null | grep -v '^$' | sort)

  for prd_file in "$PRD_DIR"/PRD-*.md; do
    if [ -f "$prd_file" ]; then
      local prd_name=$(basename "$prd_file" .md)
      if ! echo "$completed" | grep -q "^${prd_name}$" && \
         ! echo "$in_progress" | grep -q "^${prd_name}$"; then
        echo "$prd_file"
        return 0
      fi
    fi
  done
  return 1
}

claim_prd() {
  local prd_file="$1"
  local prd_name=$(basename "$prd_file" .md)
  echo "$prd_name" >> "$IN_PROGRESS_FILE"
  echo "$prd_name"
}

release_prd() {
  local prd_name="$1"
  local temp=$(mktemp)
  grep -v "^${prd_name}$" "$IN_PROGRESS_FILE" > "$temp" 2>/dev/null
  mv "$temp" "$IN_PROGRESS_FILE"
}

mark_complete() {
  local prd_name="$1"
  local temp=$(mktemp)
  grep -v "^${prd_name}$" "$IN_PROGRESS_FILE" > "$temp" 2>/dev/null
  mv "$temp" "$IN_PROGRESS_FILE"
  echo "$prd_name" >> "$COMPLETED_PRDS_FILE"
}

get_total_prds() {
  ls "$PRD_DIR"/PRD-*.md 2>/dev/null | wc -l
}

get_completed_count() {
  cat "$COMPLETED_PRDS_FILE" 2>/dev/null | grep -v '^$' | wc -l
}

get_in_progress_count() {
  cat "$IN_PROGRESS_FILE" 2>/dev/null | grep -v '^$' | wc -l
}

draw_progress_bar() {
  local width=30
  local total=$1
  local current=$2
  local label=$3

  if [ "$total" -eq 0 ]; then
    printf "%-25s [%s] 0%%" "$label" "$(printf '#%.0s' $(seq 1 $width) | tr ' ' '.')"
    return
  fi

  local pct=$((current * 100 / total))
  local filled=$((width * current / total))
  [ $filled -gt $width ] && filled=$width
  local empty=$((width - filled))

  local bar=$(printf '#%.0s' $(seq 1 $filled) 2>/dev/null || echo "")
  [ ${#bar} -lt $filled ] && bar=$(printf '#%.0s' $(seq 1 $filled))
  local dots=$(printf '.%.0s' $(seq 1 $empty) 2>/dev/null || echo "")
  [ ${#dots} -lt $empty ] && dots=$(printf '.%.0s' $(seq 1 $empty))

  printf "%-25s [%s%s] %d%%" "$label" "$bar" "$dots" "$pct"
}

worker_loop() {
  local worker_id=$1
  local worker_log="$SCRIPT_DIR/logs/worker-${worker_id}.log"

  log_info "Worker $worker_id started"

  while true; do
    prd_file=$(get_next_unclaimed_prd)

    if [ -z "$prd_file" ]; then
      log_info "Worker $worker_id: no more PRDs to claim"
      break
    fi

    prd_name=$(claim_prd "$prd_file")
    log_info "Worker $worker_id: claimed $prd_name"

    cd "$SCRIPT_DIR"
    ./ralph.sh 1 >> "$worker_log" 2>&1

    if [ -f "$SCRIPT_DIR/.prd_complete_${prd_name}" ]; then
      mark_complete "$prd_name"
      log_done "Worker $worker_id: completed $prd_name"
      rm -f "$SCRIPT_DIR/.prd_complete_${prd_name}"
    else
      release_prd "$prd_name"
      log_info "Worker $worker_id: released $prd_name (not complete)"
    fi

    sleep 1
  done

  log_info "Worker $worker_id finished"
}

cleanup() {
  log_info "Cleaning up..."
  rm -rf "$LOCK_DIR"
}

trap cleanup EXIT

check_dependencies() {
  if [ ! -d "$PRD_DIR" ]; then
    log_error "No prd/ folder found in $SCRIPT_DIR"
    exit 1
  fi

  if ! command -v claude &> /dev/null; then
    log_error "Claude Code CLI not found"
    exit 1
  fi
}

show_banner() {
  echo ""
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  Ralph Parallel Runner${NC}"
  echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
  echo ""
}

show_status() {
  local total=$(get_total_prds)
  local completed=$(get_completed_count)
  local in_progress=$(get_in_progress_count)
  local remaining=$((total - completed - in_progress))

  echo ""
  draw_progress_bar $total $completed "  Completed PRDs"
  echo ""
  draw_progress_bar $total $in_progress "  In Progress"
  echo ""
  draw_progress_bar $total $remaining "  Remaining"
  echo ""
  echo ""
  echo "  Workers Active: $active_workers / $MAX_WORKERS"
  echo "  Total PRDs: $total"
  echo "  Completed: $completed"
  echo "  In Progress: $in_progress"
  echo "  Remaining: $remaining"
}

run_parallel() {
  show_banner

  log_info "Starting $MAX_WORKERS parallel workers..."
  log_info "Press Ctrl+C to stop all workers"
  echo ""

  local pids=()

  for i in $(seq 1 $MAX_WORKERS); do
    worker_loop $i &
    pids+=($!)
  done

  active_workers=$MAX_WORKERS

  echo ""
  log_info "Workers started: ${pids[*]}"
  echo ""

  while true; clear; do
    show_status
    echo ""
    log_info "Workers running: ${pids[*]}"

    sleep 2

    all_done=true
    for pid in "${pids[@]}"; do
      if kill -0 $pid 2>/dev/null; then
        all_done=false
        break
      fi
    done

    if [ "$all_done" == true ]; then
      break
    fi
  done

  show_status
  echo ""

  total=$(get_total_prds)
  completed=$(get_completed_count)

  if [ "$completed" -ge "$total" ]; then
    log_done "All PRDs completed!"
  else
    log_info "Partial completion: $completed / $total PRDs done"
    log_info "Run './ralph-parallel.sh' again to continue"
  fi
}

check_dependencies
run_parallel
